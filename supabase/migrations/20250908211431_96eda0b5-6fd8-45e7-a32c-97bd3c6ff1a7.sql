-- Allow trigger to log stock transactions for guest consumptions
DROP POLICY IF EXISTS "allow_guest_stock_inserts" ON public.stock_transactions;

CREATE POLICY "allow_guest_stock_inserts" ON public.stock_transactions
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