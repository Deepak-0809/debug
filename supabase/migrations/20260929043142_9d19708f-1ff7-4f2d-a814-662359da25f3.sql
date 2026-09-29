ALTER TABLE public.run_usage_events
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'charged',
  ADD COLUMN IF NOT EXISTS charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.runs(id) ON DELETE SET NULL;
UPDATE public.run_usage_events SET charged_at = created_at WHERE charged_at IS NULL AND state = 'charged';
CREATE INDEX IF NOT EXISTS run_usage_events_user_state_idx ON public.run_usage_events(user_id, state, created_at);

CREATE OR REPLACE FUNCTION public.reserve_run_quota(_user_id uuid, _action_key uuid, _action_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _sub public.subscriptions; _existing public.run_usage_events; _held integer;
BEGIN
  IF _action_type NOT IN ('full_pipeline','single_test') THEN RAISE EXCEPTION 'Invalid action type'; END IF;
  SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.initialize_subscription(_user_id); SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _user_id FOR UPDATE; END IF;
  SELECT * INTO _existing FROM public.run_usage_events WHERE user_id = _user_id AND action_key = _action_key;
  IF FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'already_reserved', true, 'plan', _sub.plan, 'status', _sub.status, 'runs_used', _sub.runs_used, 'run_limit', _sub.run_limit, 'remaining', GREATEST(_sub.run_limit - _sub.runs_used, 0));
  END IF;
  IF _sub.status = 'past_due' AND _sub.grace_period_end IS NOT NULL AND _sub.grace_period_end <= now() THEN
    UPDATE public.subscriptions SET plan='free', status='halted', runs_used=GREATEST(runs_used,5), run_limit=5, cycle_start=NULL, cycle_end=NULL, pending_plan=NULL, updated_at=now() WHERE user_id=_user_id RETURNING * INTO _sub;
  END IF;
  SELECT count(*) INTO _held FROM public.run_usage_events WHERE user_id=_user_id AND state='reserved' AND created_at > now() - interval '30 minutes';
  IF _sub.runs_used + _held >= _sub.run_limit THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'RUN_LIMIT_REACHED', 'plan', _sub.plan, 'status', _sub.status, 'runs_used', _sub.runs_used, 'run_limit', _sub.run_limit, 'remaining', GREATEST(_sub.run_limit - _sub.runs_used, 0), 'grace_period_end', _sub.grace_period_end);
  END IF;
  INSERT INTO public.run_usage_events(user_id, action_key, action_type, plan_at_use, state) VALUES (_user_id, _action_key, _action_type, _sub.plan, 'reserved');
  RETURN jsonb_build_object('allowed', true, 'already_reserved', false, 'plan', _sub.plan, 'status', _sub.status, 'runs_used', _sub.runs_used, 'run_limit', _sub.run_limit, 'remaining', GREATEST(_sub.run_limit - _sub.runs_used, 0));
END; $$;

CREATE OR REPLACE FUNCTION public.charge_run_quota(_user_id uuid, _action_key uuid, _run_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _sub public.subscriptions; _ev public.run_usage_events;
BEGIN
  SELECT * INTO _sub FROM public.subscriptions WHERE user_id=_user_id FOR UPDATE;
  SELECT * INTO _ev FROM public.run_usage_events WHERE user_id=_user_id AND action_key=_action_key FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('charged', false, 'code', 'NOT_RESERVED'); END IF;
  IF _ev.state = 'charged' THEN
    RETURN jsonb_build_object('charged', true, 'already_charged', true, 'runs_used', _sub.runs_used, 'run_limit', _sub.run_limit, 'remaining', GREATEST(_sub.run_limit - _sub.runs_used, 0));
  END IF;
  UPDATE public.run_usage_events SET state='charged', charged_at=now(), plan_at_use=_sub.plan, run_id=COALESCE(_run_id, run_id) WHERE id=_ev.id;
  UPDATE public.subscriptions SET runs_used = LEAST(runs_used + 1, GREATEST(run_limit, runs_used + 1)), updated_at=now() WHERE user_id=_user_id RETURNING * INTO _sub;
  RETURN jsonb_build_object('charged', true, 'already_charged', false, 'plan', _sub.plan, 'runs_used', _sub.runs_used, 'run_limit', _sub.run_limit, 'remaining', GREATEST(_sub.run_limit - _sub.runs_used, 0));
END; $$;

CREATE OR REPLACE FUNCTION public.verify_run_action(_user_id uuid, _action_key uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.run_usage_events WHERE user_id=_user_id AND action_key=_action_key
    AND (state='charged' OR created_at > now() - interval '30 minutes'))
$$;

REVOKE ALL ON FUNCTION public.reserve_run_quota(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.charge_run_quota(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_run_action(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_run_quota(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.charge_run_quota(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_run_action(uuid,uuid) TO service_role;