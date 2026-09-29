CREATE TABLE public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  plan text,
  feature text,
  provider_used text,
  model text,
  success boolean NOT NULL DEFAULT false,
  failover_count integer NOT NULL DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own ai usage" ON public.ai_usage_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ai_usage_log_user_created_idx ON public.ai_usage_log (user_id, created_at DESC);