CREATE OR REPLACE FUNCTION public.expire_subscription_if_due(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _prev public.subscriptions; _new public.subscriptions;
BEGIN
  SELECT * INTO _prev FROM public.subscriptions WHERE user_id=_user_id FOR UPDATE;
  IF NOT FOUND OR _prev.plan = 'free' THEN RETURN; END IF;
  IF (_prev.status = 'past_due' AND _prev.grace_period_end IS NOT NULL AND _prev.grace_period_end <= now())
     OR (_prev.cycle_end IS NOT NULL AND _prev.cycle_end + interval '1 day' <= now())
     OR _prev.status IN ('cancelled','halted') THEN
    UPDATE public.subscriptions SET plan='free',
      status = CASE WHEN _prev.status='past_due' THEN 'halted' ELSE 'cancelled' END,
      run_limit=5, cycle_start=NULL, cycle_end=NULL, grace_period_end=NULL, pending_plan=NULL, updated_at=now()
    WHERE user_id=_user_id RETURNING * INTO _new;
    INSERT INTO public.subscription_state_changes(user_id, source, previous_plan, new_plan, previous_status, new_status)
    VALUES (_user_id, 'period_expired', _prev.plan, 'free', _prev.status, _new.status);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.initialize_subscription(_user_id uuid)
 RETURNS subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _row public.subscriptions; _historical integer;
BEGIN
  SELECT LEAST(COALESCE(total_runs, 0), 5) INTO _historical FROM public.profiles WHERE id = _user_id;
  INSERT INTO public.subscriptions (user_id, runs_used, run_limit) VALUES (_user_id, COALESCE(_historical, 0), 5) ON CONFLICT (user_id) DO NOTHING;
  PERFORM public.expire_subscription_if_due(_user_id);
  UPDATE public.subscriptions SET single_tests_used=0, single_tests_period_start=now(), updated_at=now()
    WHERE user_id=_user_id AND plan='free' AND single_tests_period_start <= now() - interval '1 month';
  SELECT * INTO _row FROM public.subscriptions WHERE user_id = _user_id;
  RETURN _row;
END; $function$;

CREATE OR REPLACE FUNCTION public.reserve_run_quota(_user_id uuid, _action_key uuid, _action_type text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _sub public.subscriptions; _existing public.run_usage_events; _held integer; _limit integer;
BEGIN
  IF _action_type NOT IN ('full_pipeline','single_test') THEN RAISE EXCEPTION 'Invalid action type'; END IF;
  PERFORM public.initialize_subscription(_user_id);
  SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _user_id FOR UPDATE;
  SELECT * INTO _existing FROM public.run_usage_events WHERE user_id = _user_id AND action_key = _action_key;
  IF FOUND THEN
    RETURN public.usage_json(_sub) || jsonb_build_object('allowed', true, 'already_reserved', true, 'action_type', _existing.action_type);
  END IF;
  SELECT count(*) INTO _held FROM public.run_usage_events WHERE user_id=_user_id AND state='reserved' AND action_type=_action_type AND created_at > now() - interval '30 minutes';
  IF _action_type = 'full_pipeline' THEN
    IF _sub.runs_used + _held >= _sub.run_limit THEN
      RETURN public.usage_json(_sub) || jsonb_build_object('allowed', false, 'code', 'RUN_LIMIT_REACHED', 'action_type', _action_type);
    END IF;
  ELSE
    _limit := public.single_test_limit(_sub.plan);
    IF _limit IS NOT NULL AND _sub.single_tests_used + _held >= _limit THEN
      RETURN public.usage_json(_sub) || jsonb_build_object('allowed', false, 'code', 'RUN_LIMIT_REACHED', 'action_type', _action_type);
    END IF;
  END IF;
  INSERT INTO public.run_usage_events(user_id, action_key, action_type, plan_at_use, state) VALUES (_user_id, _action_key, _action_type, _sub.plan, 'reserved');
  RETURN public.usage_json(_sub) || jsonb_build_object('allowed', true, 'already_reserved', false, 'action_type', _action_type);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.expire_subscription_if_due(uuid), public.initialize_subscription(uuid), public.reserve_run_quota(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_subscription_if_due(uuid), public.initialize_subscription(uuid), public.reserve_run_quota(uuid,uuid,text) TO service_role;