-- Fix RLS for stock_transactions so non-admin users can register consumptions
-- Drop restrictive admin policy and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage stock transactions" ON public.stock_transactions;

-- Permissive policy: admins can do everything on stock_transactions
CREATE POLICY "Admins can manage stock transactions"
ON public.stock_transactions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Allow any authenticated user to insert stock transactions that they created (used by consumption trigger)
CREATE POLICY "Users can insert own stock transactions"
ON public.stock_transactions
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());
