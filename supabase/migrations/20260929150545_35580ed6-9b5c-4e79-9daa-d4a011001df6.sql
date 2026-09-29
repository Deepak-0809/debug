ALTER TABLE public.subscriptions ALTER COLUMN run_limit SET DEFAULT 3;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, auth_provider, username)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.raw_app_meta_data->>'provider' IS NOT NULL THEN NEW.raw_app_meta_data->>'provider' ELSE 'email' END,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 4))
  );
  INSERT INTO public.subscriptions (user_id, plan, status, runs_used, run_limit)
  VALUES (NEW.id, 'free', 'none', 0, 3) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.initialize_subscription(_user_id uuid)
 RETURNS subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _row public.subscriptions; _historical integer;
BEGIN
  SELECT LEAST(COALESCE(total_runs, 0), 3) INTO _historical FROM public.profiles WHERE id = _user_id;
  INSERT INTO public.subscriptions (user_id, runs_used, run_limit) VALUES (_user_id, COALESCE(_historical, 0), 3) ON CONFLICT (user_id) DO NOTHING;
  PERFORM public.expire_subscription_if_due(_user_id);
  UPDATE public.subscriptions SET run_limit = 3, updated_at = now() WHERE user_id = _user_id AND plan = 'free' AND run_limit <> 3;
  UPDATE public.subscriptions SET single_tests_used=0, single_tests_period_start=now(), updated_at=now()
    WHERE user_id=_user_id AND plan='free' AND single_tests_period_start <= now() - interval '1 month';
  SELECT * INTO _row FROM public.subscriptions WHERE user_id = _user_id;
  RETURN _row;
END; $function$;

CREATE OR REPLACE FUNCTION public.expire_subscription_if_due(_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _prev public.subscriptions; _new public.subscriptions;
BEGIN
  SELECT * INTO _prev FROM public.subscriptions WHERE user_id=_user_id FOR UPDATE;
  IF NOT FOUND OR _prev.plan = 'free' THEN RETURN; END IF;
  IF (_prev.status = 'past_due' AND _prev.grace_period_end IS NOT NULL AND _prev.grace_period_end <= now())
     OR (_prev.cycle_end IS NOT NULL AND _prev.cycle_end + interval '1 day' <= now())
     OR _prev.status IN ('cancelled','halted') THEN
    UPDATE public.subscriptions SET plan='free',
      status = CASE WHEN _prev.status='past_due' THEN 'halted' ELSE 'cancelled' END,
      run_limit=3, cycle_start=NULL, cycle_end=NULL, grace_period_end=NULL, pending_plan=NULL, updated_at=now()
    WHERE user_id=_user_id RETURNING * INTO _new;
    INSERT INTO public.subscription_state_changes(user_id, source, previous_plan, new_plan, previous_status, new_status)
    VALUES (_user_id, 'period_expired', _prev.plan, 'free', _prev.status, _new.status);
  END IF;
END $function$;

DROP FUNCTION IF EXISTS public.consume_run_quota(uuid, uuid, text);

UPDATE public.subscriptions SET run_limit = 3, updated_at = now() WHERE plan = 'free';