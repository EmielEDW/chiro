-- Allow transaction reversals when the original user no longer exists
-- 1) Make user_id nullable
-- 2) Recreate FK with ON DELETE SET NULL so deletions don't block inserts

BEGIN;

-- Make user_id nullable
ALTER TABLE public.transaction_reversals
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing FK if present
ALTER TABLE public.transaction_reversals
  DROP CONSTRAINT IF EXISTS transaction_reversals_user_id_fkey;

-- Recreate FK to profiles(id) with ON DELETE SET NULL
ALTER TABLE public.transaction_reversals
  ADD CONSTRAINT transaction_reversals_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

COMMIT;