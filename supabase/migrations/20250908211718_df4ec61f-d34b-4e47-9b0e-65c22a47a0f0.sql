-- Fix RLS policies to allow triggers for guest consumptions
-- Remove the problematic guest stock policy
DROP POLICY IF EXISTS "allow_guest_stock_inserts" ON public.stock_transactions;

-- Update the consumption trigger policy to be more permissive for guest accounts
DROP POLICY IF EXISTS "allow_guest_consumptions" ON public.consumptions;

CREATE POLICY "allow_guest_consumptions" ON public.consumptions
FOR INSERT 
WITH CHECK (
  -- Allow if user is authenticated and matches
  auth.uid() = user_id 
  OR 
  -- Allow for any guest account (no auth required)
  (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = user_id 
    AND profiles.guest_account = true 
    AND profiles.occupied = true 
    AND profiles.active = true
  ))
);

-- Create a permissive policy for stock transactions created by the trigger
-- This allows the trigger to insert stock transactions for both regular users and guests
CREATE POLICY "allow_trigger_stock_inserts" ON public.stock_transactions
FOR INSERT
WITH CHECK (
  -- Allow if admin is creating it
  (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ))
  OR 
  -- Allow if user is creating their own transaction
  (auth.uid() = created_by)
  OR
  -- Allow for guest accounts (created by trigger)
  (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = created_by
    AND profiles.guest_account = true
    AND profiles.active = true
  ))
);