-- Add policy to allow all users to view basic profile info for leaderboard
CREATE POLICY "Users can view basic profile info for leaderboard" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);