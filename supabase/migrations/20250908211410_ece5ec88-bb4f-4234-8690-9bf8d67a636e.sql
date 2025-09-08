-- Allow trigger to log stock transactions for guest consumptions
CREATE POLICY IF NOT EXISTS "allow_guest_stock_inserts" ON public.stock_transactions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = created_by
      AND p.guest_account = true
      AND p.occupied = true
      AND p.active = true
  )
);
