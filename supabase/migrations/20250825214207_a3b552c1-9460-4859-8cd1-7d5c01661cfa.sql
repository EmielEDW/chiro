-- Fix the update_own_profile policy to allow role changes
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;

-- Create new policy that allows users to update their own profile including role changes
CREATE POLICY "update_own_profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);