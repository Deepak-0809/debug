ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS single_tests_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS single_tests_period_start timestamptz NOT NULL DEFAULT now();

UPDATE public.subscriptions SET single_tests_used = 0, single_tests_period_start = now();

CREATE OR REPLACE FUNCTION public.single_test_limit(_plan text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT CASE _plan WHEN 'free' THEN 20 WHEN 'plus' THEN 100 ELSE NULL END $$;

CREATE OR REPLACE FUNCTION public.usage_json(_sub public.subscriptions)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT jsonb_build_object('plan', _sub.plan, 'status', _sub.status,
  'runs_used', _sub.runs_used, 'run_limit', _sub.run_limit,
  'remaining', GREATEST(_sub.run_limit - _sub.runs_used, 0),
  'single_tests_used', _sub.single_tests_used,
  'single_test_limit', public.single_test_limit(_sub.plan),
  'single_tests_remaining', CASE WHEN public.single_test_limit(_sub.plan) IS NULL THEN NULL ELSE GREATEST(public.single_test_limit(_sub.plan) - _sub.single_tests_used, 0) END,
  'grace_period_end', _sub.grace_period_end) $$;

CREATE OR REPLACE FUNCTION public.reserve_run_quota(_user_id uuid, _action_key uuid, _action_type text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _sub public.subscriptions; _existing public.run_usage_events; _held integer; _limit integer;
BEGIN
  IF _action_type NOT IN ('full_pipeline','single_test') THEN RAISE EXCEPTION 'Invalid action type'; END IF;
  SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.initialize_subscription(_user_id); SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _user_id FOR UPDATE; END IF;
  -- Free plan: single tests reset every month
  IF _sub.plan = 'free' AND _sub.single_tests_period_start <= now() - interval '1 month' THEN
    UPDATE public.subscriptions SET single_tests_used = 0, single_tests_period_start = now(), updated_at = now() WHERE user_id=_user_id RETURNING * INTO _sub;
  END IF;
  SELECT * INTO _existing FROM public.run_usage_events WHERE user_id = _user_id AND action_key = _action_key;
  IF FOUND THEN
    RETURN public.usage_json(_sub) || jsonb_build_object('allowed', true, 'already_reserved', true, 'action_type', _existing.action_type);
  END IF;
  IF _sub.status = 'past_due' AND _sub.grace_period_end IS NOT NULL AND _sub.grace_period_end <= now() THEN
    UPDATE public.subscriptions SET plan='free', status='halted', runs_used=GREATEST(runs_used,5), run_limit=5, cycle_start=NULL, cycle_end=NULL, pending_plan=NULL, updated_at=now() WHERE user_id=_user_id RETURNING * INTO _sub;
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

CREATE OR REPLACE FUNCTION public.charge_run_quota(_user_id uuid, _action_key uuid, _run_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _sub public.subscriptions; _ev public.run_usage_events;
BEGIN
  SELECT * INTO _sub FROM public.subscriptions WHERE user_id=_user_id FOR UPDATE;
  SELECT * INTO _ev FROM public.run_usage_events WHERE user_id=_user_id AND action_key=_action_key FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('charged', false, 'code', 'NOT_RESERVED'); END IF;
  IF _ev.state = 'charged' THEN
    RETURN public.usage_json(_sub) || jsonb_build_object('charged', true, 'already_charged', true, 'action_type', _ev.action_type);
  END IF;
  UPDATE public.run_usage_events SET state='charged', charged_at=now(), plan_at_use=_sub.plan, run_id=COALESCE(_run_id, run_id) WHERE id=_ev.id;
  IF _ev.action_type = 'single_test' THEN
    UPDATE public.subscriptions SET single_tests_used = single_tests_used + 1, updated_at=now() WHERE user_id=_user_id RETURNING * INTO _sub;
  ELSE
    UPDATE public.subscriptions SET runs_used = runs_used + 1, updated_at=now() WHERE user_id=_user_id RETURNING * INTO _sub;
  END IF;
  RETURN public.usage_json(_sub) || jsonb_build_object('charged', true, 'already_charged', false, 'action_type', _ev.action_type);
END; $function$;

CREATE OR REPLACE FUNCTION public.reset_single_tests_on_cycle()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN
  IF NEW.runs_used = 0 AND OLD.runs_used <> 0 AND NEW.plan <> 'free' THEN
    NEW.single_tests_used := 0; NEW.single_tests_period_start := now();
  ELSIF NEW.plan IS DISTINCT FROM OLD.plan THEN
    NEW.single_tests_used := LEAST(NEW.single_tests_used, COALESCE(public.single_test_limit(NEW.plan), NEW.single_tests_used));
  END IF;
  IF NEW.cycle_start IS DISTINCT FROM OLD.cycle_start AND NEW.cycle_start IS NOT NULL THEN
    NEW.single_tests_used := 0; NEW.single_tests_period_start := now();
  END IF;
  RETURN NEW; END $$;

DROP TRIGGER IF EXISTS subscriptions_reset_single_tests ON public.subscriptions;
CREATE TRIGGER subscriptions_reset_single_tests BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.reset_single_tests_on_cycle();

REVOKE EXECUTE ON FUNCTION public.reserve_run_quota(uuid,uuid,text), public.charge_run_quota(uuid,uuid,uuid), public.usage_json(public.subscriptions), public.reset_single_tests_on_cycle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_run_quota(uuid,uuid,text), public.charge_run_quota(uuid,uuid,uuid) TO service_role;