
-- Add unique username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Set existing users' username to 'Alok' (only first one gets it, rest get Alok_1, etc.)
-- For simplicity, set all existing to 'Alok' with a suffix
DO $$
DECLARE
  rec RECORD;
  counter INTEGER := 0;
BEGIN
  FOR rec IN SELECT id FROM public.profiles ORDER BY created_at ASC
  LOOP
    IF counter = 0 THEN
      UPDATE public.profiles SET username = 'Alok' WHERE id = rec.id;
    ELSE
      UPDATE public.profiles SET username = 'Alok_' || counter WHERE id = rec.id;
    END IF;
    counter := counter + 1;
  END LOOP;
END $$;
