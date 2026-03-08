
-- Add usage tracking column to profiles
ALTER TABLE public.profiles ADD COLUMN total_runs integer NOT NULL DEFAULT 0;

-- Create trigger to auto-increment total_runs on each new run
CREATE OR REPLACE FUNCTION public.increment_user_runs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET total_runs = total_runs + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_run_insert
AFTER INSERT ON public.runs
FOR EACH ROW
EXECUTE FUNCTION public.increment_user_runs();
