CREATE OR REPLACE FUNCTION public.cleanup_deleted_profile_data()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.chat_messages WHERE user_id = OLD.id;
  DELETE FROM public.runs WHERE user_id = OLD.id;
  DELETE FROM public.run_usage_events WHERE user_id = OLD.id;
  DELETE FROM public.subscription_state_changes WHERE user_id = OLD.id;
  DELETE FROM public.subscriptions WHERE user_id = OLD.id;
  DELETE FROM public.ai_usage_log WHERE user_id = OLD.id;
  DELETE FROM public.rate_limits WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.cleanup_deleted_profile_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_deleted_profile_data() TO service_role;
CREATE TRIGGER cleanup_deleted_profile_data AFTER DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_profile_data();
COMMENT ON FUNCTION public.cleanup_deleted_profile_data() IS 'Enforces account-deletion privacy commitments when its profile is deleted, including via account cascade; preserves payments for accounting.';