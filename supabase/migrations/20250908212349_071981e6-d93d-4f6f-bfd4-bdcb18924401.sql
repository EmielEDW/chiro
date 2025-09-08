-- Allow guests to create transaction reversals for their own consumptions
-- Update RLS policy to include guests
DROP POLICY IF EXISTS "Users can create own reversals" ON public.transaction_reversals;

CREATE POLICY "Users can create own reversals" ON public.transaction_reversals
FOR INSERT
WITH CHECK (
  -- Regular authenticated users
  (auth.uid() = user_id AND auth.uid() = reversed_by)
  OR
  -- Guest accounts (no auth but valid guest profile)
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = user_id 
    AND profiles.guest_account = true 
    AND profiles.occupied = true 
    AND profiles.active = true
  ) AND user_id = reversed_by)
);

-- Allow guests to view their own reversals
DROP POLICY IF EXISTS "Users can view own reversals" ON public.transaction_reversals;

CREATE POLICY "Users can view own reversals" ON public.transaction_reversals
FOR SELECT
USING (
  -- Regular authenticated users
  auth.uid() = user_id
  OR
  -- Guest accounts
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = user_id 
    AND profiles.guest_account = true 
    AND profiles.occupied = true 
    AND profiles.active = true
  ))
);