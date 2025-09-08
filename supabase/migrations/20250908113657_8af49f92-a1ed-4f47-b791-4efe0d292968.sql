-- 1) Remove FK to auth.users so we can create guest profiles without auth users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2) Add guest management columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guest_number integer,
  ADD COLUMN IF NOT EXISTS occupied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS occupied_by_name text;

-- 3) Ensure guest_number is unique among guest accounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_guest_number_unique
  ON public.profiles (guest_number)
  WHERE guest_account = true;

-- 4) RPC to occupy a guest account (sets it to occupied with a name). SECURITY DEFINER so it can run from kiosk without auth.
CREATE OR REPLACE FUNCTION public.occupy_guest_account(_guest_id uuid, _guest_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET occupied = true,
      occupied_by_name = _guest_name,
      updated_at = now()
  WHERE id = _guest_id
    AND guest_account = true
    AND active = true
    AND occupied = false;

  IF FOUND THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

-- 5) RPC to free a guest account (clears occupancy)
CREATE OR REPLACE FUNCTION public.free_guest_account(_guest_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET occupied = false,
      occupied_by_name = NULL,
      updated_at = now()
  WHERE id = _guest_id
    AND guest_account = true;

  IF FOUND THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;