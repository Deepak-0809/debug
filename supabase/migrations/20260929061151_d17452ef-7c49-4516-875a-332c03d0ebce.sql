CREATE OR REPLACE FUNCTION public.set_subscription_pending(_user_id uuid, _plan text, _subscription_id text)
 RETURNS subscriptions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _row public.subscriptions;
BEGIN
  IF _plan NOT IN ('plus', 'pro') THEN RAISE EXCEPTION 'Invalid paid plan'; END IF;
  PERFORM public.initialize_subscription(_user_id);
  -- Opening a new checkout must never downgrade an active paid plan's status.
  UPDATE public.subscriptions SET
    status = CASE WHEN status IN ('active','past_due') THEN status ELSE 'pending' END,
    pending_plan = _plan, updated_at = now()
  WHERE user_id = _user_id RETURNING * INTO _row;
  RETURN _row;
END; $function$;
UPDATE public.subscriptions SET status='active' WHERE plan<>'free' AND status='pending' AND cycle_end > now();
UPDATE public.subscriptions SET status='none', pending_plan=NULL WHERE plan='free' AND status='pending';