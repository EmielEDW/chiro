-- Check current policies first, then fix them properly

-- 1. Create security definer function to get current user role safely
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 2. Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 3. Create new secure policies
-- Users can only view their own profile data
CREATE POLICY "view_own_profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (but not change their role)
CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- Admins can view all profiles using security definer function
CREATE POLICY "admin_view_all_profiles" ON public.profiles
  FOR SELECT
  USING (public.get_current_user_role() = 'admin');

-- Admins can manage all profiles using security definer function  
CREATE POLICY "admin_manage_all_profiles" ON public.profiles
  FOR ALL
  USING (public.get_current_user_role() = 'admin');