CREATE TABLE public.subscriptions (
  user_id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'plus', 'pro')),
  status text NOT NULL DEFAULT 'none' CHECK (status IN ('none', 'pending', 'active', 'past_due', 'cancelled', 'halted')),
  runs_used integer NOT NULL DEFAULT 0 CHECK (runs_used >= 0),
  run_limit integer NOT NULL DEFAULT 5 CHECK (run_limit >= 0),
  cycle_start timestamptz,
  cycle_end timestamptz,
  grace_period_end timestamptz,
  razorpay_customer_id text,
  razorpay_subscription_id text UNIQUE,
  pending_plan text CHECK (pending_plan IS NULL OR pending_plan IN ('plus', 'pro')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.run_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_key uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('full_pipeline', 'single_test')),
  plan_at_use text NOT NULL CHECK (plan_at_use IN ('free', 'plus', 'pro')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, action_key)
);
GRANT SELECT ON public.run_usage_events TO authenticated;
GRANT ALL ON public.run_usage_events TO service_role;
ALTER TABLE public.run_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON public.run_usage_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX run_usage_events_user_created_idx ON public.run_usage_events (user_id, created_at DESC);

CREATE TABLE public.payment_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.subscription_state_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  source text NOT NULL,
  previous_plan text,
  new_plan text,
  previous_status text,
  new_status text,
  event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.subscription_state_changes TO service_role;
ALTER TABLE public.subscription_state_changes ENABLE ROW LEVEL SECURITY;
CREATE INDEX subscription_state_changes_user_created_idx ON public.subscription_state_changes (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.initialize_subscription(_user_id uuid)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.subscriptions;
  _historical integer;
BEGIN
  SELECT LEAST(COALESCE(total_runs, 0), 5) INTO _historical FROM public.profiles WHERE id = _user_id;
  INSERT INTO public.subscriptions (user_id, runs_used, run_limit)
  VALUES (_user_id, COALESCE(_historical, 0), 5)
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO _row FROM public.subscriptions WHERE user_id = _user_id;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_subscription(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_subscription(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_run_quota(_user_id uuid, _action_key uuid, _action_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub public.subscriptions;
  _existing public.run_usage_events;
  _historical integer;
BEGIN
  IF _action_type NOT IN ('full_pipeline', 'single_test') THEN
    RAISE EXCEPTION 'Invalid action type';
  END IF;

  SELECT * INTO _existing FROM public.run_usage_events WHERE user_id = _user_id AND action_key = _action_key;
  IF FOUND THEN
    SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _user_id;
    RETURN jsonb_build_object('allowed', true, 'already_consumed', true, 'plan', _sub.plan, 'status', _sub.status, 'runs_used', _sub.runs_used, 'run_limit', _sub.run_limit, 'remaining', GREATEST(_sub.run_limit - _sub.runs_used, 0));
  END IF;

  SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    SELECT LEAST(COALESCE(total_runs, 0), 5) INTO _historical FROM public.profiles WHERE id = _user_id;
    INSERT INTO public.subscriptions (user_id, runs_used, run_limit) VALUES (_user_id, COALESCE(_historical, 0), 5) RETURNING * INTO _sub;
  END IF;

  IF _sub.status = 'past_due' AND _sub.grace_period_end IS NOT NULL AND _sub.grace_period_end <= now() THEN
    UPDATE public.subscriptions SET plan = 'free', status = 'halted', runs_used = 5, run_limit = 5, cycle_start = NULL, cycle_end = NULL, pending_plan = NULL, updated_at = now() WHERE user_id = _user_id RETURNING * INTO _sub;
  END IF;

  IF _sub.plan = 'free' AND _sub.status IN ('cancelled', 'halted') THEN
    _sub.runs_used := GREATEST(_sub.runs_used, 5);
  END IF;

  IF _sub.runs_used >= _sub.run_limit THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'RUN_LIMIT_REACHED', 'plan', _sub.plan, 'status', _sub.status, 'runs_used', _sub.runs_used, 'run_limit', _sub.run_limit, 'remaining', 0, 'grace_period_end', _sub.grace_period_end);
  END IF;

  INSERT INTO public.run_usage_events (user_id, action_key, action_type, plan_at_use) VALUES (_user_id, _action_key, _action_type, _sub.plan);
  UPDATE public.subscriptions SET runs_used = runs_used + 1, updated_at = now() WHERE user_id = _user_id RETURNING * INTO _sub;
  RETURN jsonb_build_object('allowed', true, 'already_consumed', false, 'plan', _sub.plan, 'status', _sub.status, 'runs_used', _sub.runs_used, 'run_limit', _sub.run_limit, 'remaining', GREATEST(_sub.run_limit - _sub.runs_used, 0), 'grace_period_end', _sub.grace_period_end);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_run_quota(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_run_quota(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.verify_run_action(_user_id uuid, _action_key uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.run_usage_events WHERE user_id = _user_id AND action_key = _action_key)
$$;
REVOKE ALL ON FUNCTION public.verify_run_action(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_run_action(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_subscription_state(
  _user_id uuid,
  _plan text,
  _status text,
  _run_limit integer,
  _cycle_start timestamptz,
  _cycle_end timestamptz,
  _grace_period_end timestamptz,
  _razorpay_customer_id text,
  _razorpay_subscription_id text,
  _reset_runs boolean,
  _source text,
  _event_id text DEFAULT NULL
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _previous public.subscriptions;
  _current public.subscriptions;
BEGIN
  IF _plan NOT IN ('free', 'plus', 'pro') OR _status NOT IN ('none', 'pending', 'active', 'past_due', 'cancelled', 'halted') THEN
    RAISE EXCEPTION 'Invalid subscription state';
  END IF;
  SELECT * INTO _previous FROM public.subscriptions WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.initialize_subscription(_user_id); SELECT * INTO _previous FROM public.subscriptions WHERE user_id = _user_id FOR UPDATE; END IF;
  UPDATE public.subscriptions SET
    plan = _plan,
    status = _status,
    run_limit = _run_limit,
    runs_used = CASE WHEN _reset_runs THEN 0 ELSE runs_used END,
    cycle_start = _cycle_start,
    cycle_end = _cycle_end,
    grace_period_end = _grace_period_end,
    razorpay_customer_id = COALESCE(_razorpay_customer_id, razorpay_customer_id),
    razorpay_subscription_id = COALESCE(_razorpay_subscription_id, razorpay_subscription_id),
    pending_plan = NULL,
    updated_at = now()
  WHERE user_id = _user_id RETURNING * INTO _current;
  INSERT INTO public.subscription_state_changes (user_id, source, previous_plan, new_plan, previous_status, new_status, event_id)
  VALUES (_user_id, _source, _previous.plan, _current.plan, _previous.status, _current.status, _event_id);
  RETURN _current;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_subscription_state(uuid, text, text, integer, timestamptz, timestamptz, timestamptz, text, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_state(uuid, text, text, integer, timestamptz, timestamptz, timestamptz, text, text, boolean, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_subscription_pending(_user_id uuid, _plan text, _subscription_id text)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row public.subscriptions;
BEGIN
  IF _plan NOT IN ('plus', 'pro') THEN RAISE EXCEPTION 'Invalid paid plan'; END IF;
  PERFORM public.initialize_subscription(_user_id);
  UPDATE public.subscriptions SET status = 'pending', pending_plan = _plan, razorpay_subscription_id = _subscription_id, updated_at = now() WHERE user_id = _user_id RETURNING * INTO _row;
  RETURN _row;
END;
$$;
REVOKE ALL ON FUNCTION public.set_subscription_pending(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_subscription_pending(uuid, text, text) TO service_role;