-- Fix infinite recursion and security issue in profiles table

-- 1. Create security definer function to get current user role safely
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 3. Create secure policies using the security definer function
-- Users can only view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (non-role fields)
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Admins can view all profiles using security definer function
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT
  USING (public.get_current_user_role() = 'admin');

-- Admins can manage all profiles using security definer function  
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL
  USING (public.get_current_user_role() = 'admin');