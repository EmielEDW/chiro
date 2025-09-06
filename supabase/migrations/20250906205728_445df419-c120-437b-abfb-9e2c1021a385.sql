-- Update RLS policy to allow all users to view consumptions for leaderboard
DROP POLICY IF EXISTS "Users can view own consumptions" ON public.consumptions;

-- Create new policy that allows all authenticated users to view all consumptions
-- This enables leaderboard functionality where users can see everyone's rankings
CREATE POLICY "Users can view all consumptions for leaderboard" 
ON public.consumptions 
FOR SELECT 
TO authenticated
USING (true);

-- Keep the admin policy as is
-- The "Admins can view all consumptions" policy already exists and will continue to work