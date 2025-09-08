-- Update RLS policy for consumptions to allow guest accounts
DROP POLICY IF EXISTS "allow_guest_consumptions" ON public.consumptions;

CREATE POLICY "allow_guest_consumptions" ON public.consumptions
FOR INSERT 
WITH CHECK (
  -- Allow if user is the one creating the consumption
  auth.uid() = user_id 
  OR 
  -- Allow for guest accounts (when no authentication but valid guest profile)
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_id 
    AND profiles.guest_account = true 
    AND profiles.occupied = true 
    AND profiles.active = true
  ))
);