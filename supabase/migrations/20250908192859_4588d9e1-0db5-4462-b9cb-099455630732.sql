-- Fix guest accounts visibility on auth page by adjusting RLS on profiles
-- 1) Make the admin policy permissive so it doesn't restrict SELECTs
-- 2) Add a public SELECT policy limited to available guest accounts

-- Drop the restrictive admin policy if it exists
DROP POLICY IF EXISTS admin_manage_all_profiles ON public.profiles;

-- Recreate admin policy as PERMISSIVE for full management access
CREATE POLICY admin_manage_all_profiles
ON public.profiles
AS PERMISSIVE
FOR ALL
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- Allow anyone (including anon) to view available guest accounts
CREATE POLICY public_can_view_available_guest_accounts
ON public.profiles
AS PERMISSIVE
FOR SELECT
USING (guest_account = true AND active = true AND occupied = false);
