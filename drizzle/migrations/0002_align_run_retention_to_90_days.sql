CREATE OR REPLACE FUNCTION public.cleanup_old_runs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.test_cases
  WHERE run_id IN (SELECT id FROM public.runs WHERE created_at < now() - interval '90 days');
  DELETE FROM public.runs WHERE created_at < now() - interval '90 days';
END;
$$;
COMMENT ON FUNCTION public.cleanup_old_runs() IS 'Daily retention cleanup: removes runs older than 90 days; linked test cases and chat messages are deleted through ON DELETE CASCADE.';