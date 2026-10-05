CREATE OR REPLACE FUNCTION public.initialize_subscription(_user_id uuid)
 RETURNS subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _row public.subscriptions;
BEGIN
  -- New rows always start at 0: only runs counted by charge_run_quota use the allowance.
  INSERT INTO public.subscriptions (user_id, runs_used, run_limit) VALUES (_user_id, 0, 5) ON CONFLICT (user_id) DO NOTHING;
  PERFORM public.expire_subscription_if_due(_user_id);
  UPDATE public.subscriptions SET run_limit = 5, updated_at = now() WHERE user_id = _user_id AND plan = 'free' AND run_limit <> 5;
  UPDATE public.subscriptions SET single_tests_used=0, single_tests_period_start=now(), updated_at=now()
    WHERE user_id=_user_id AND plan='free' AND single_tests_period_start <= now() - interval '1 month';
  SELECT * INTO _row FROM public.subscriptions WHERE user_id = _user_id;
  RETURN _row;
END; $function$;

UPDATE public.subscriptions SET runs_used = 0, updated_at = now()
WHERE user_id = '3b057d37-cf20-4c9f-9070-df05770b02ba' AND plan = 'free'
  AND NOT EXISTS (SELECT 1 FROM public.run_usage_events e WHERE e.user_id = subscriptions.user_id AND e.state = 'charged');