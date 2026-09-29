CREATE OR REPLACE FUNCTION public.reserve_run_quota(_user_id uuid, _action_key uuid, _action_type text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _sub public.subscriptions; _existing public.run_usage_events; _limit integer;
BEGIN
  IF _action_type NOT IN ('full_pipeline','single_test') THEN RAISE EXCEPTION 'Invalid action type'; END IF;
  PERFORM public.initialize_subscription(_user_id);
  SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _user_id FOR UPDATE;
  SELECT * INTO _existing FROM public.run_usage_events WHERE user_id = _user_id AND action_key = _action_key;
  IF FOUND THEN
    RETURN public.usage_json(_sub) || jsonb_build_object('allowed', true, 'already_reserved', true, 'action_type', _existing.action_type);
  END IF;
  -- Only completed (charged) runs count; failed/abandoned attempts never block new ones.
  IF _action_type = 'full_pipeline' THEN
    IF _sub.runs_used >= _sub.run_limit THEN
      RETURN public.usage_json(_sub) || jsonb_build_object('allowed', false, 'code', 'RUN_LIMIT_REACHED', 'action_type', _action_type);
    END IF;
  ELSE
    _limit := public.single_test_limit(_sub.plan);
    IF _limit IS NOT NULL AND _sub.single_tests_used >= _limit THEN
      RETURN public.usage_json(_sub) || jsonb_build_object('allowed', false, 'code', 'RUN_LIMIT_REACHED', 'action_type', _action_type);
    END IF;
  END IF;
  INSERT INTO public.run_usage_events(user_id, action_key, action_type, plan_at_use, state) VALUES (_user_id, _action_key, _action_type, _sub.plan, 'reserved');
  RETURN public.usage_json(_sub) || jsonb_build_object('allowed', true, 'already_reserved', false, 'action_type', _action_type);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.reserve_run_quota(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_run_quota(uuid,uuid,text) TO service_role;