-- Fix RLS policies to allow triggers for guest consumptions
-- First drop all existing policies that might conflict
DROP POLICY IF EXISTS "allow_guest_stock_inserts" ON public.stock_transactions;
DROP POLICY IF EXISTS "allow_trigger_stock_inserts" ON public.stock_transactions;
DROP POLICY IF EXISTS "Users can insert own stock transactions" ON public.stock_transactions;

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

-- Recreate stock transactions policy to allow both users and guests
CREATE POLICY "Users can insert own stock transactions" ON public.stock_transactions
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Create a permissive policy for stock transactions created by triggers
CREATE POLICY "allow_trigger_stock_inserts" ON public.stock_transactions
FOR INSERT
WITH CHECK (
  -- Allow for guest accounts (created by trigger)
  (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = created_by
    AND profiles.guest_account = true
    AND profiles.active = true
  ))
);