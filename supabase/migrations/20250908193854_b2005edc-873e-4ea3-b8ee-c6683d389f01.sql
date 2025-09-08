-- Add RLS policy to allow guests to view their own occupied guest accounts
-- and to allow guest operations like creating consumptions

-- Allow viewing of occupied guest accounts (so guests can see their profile)
CREATE POLICY "guests_can_view_occupied_guest_accounts"
ON public.profiles
AS PERMISSIVE
FOR SELECT
USING (guest_account = true AND occupied = true);

-- Allow guests to create consumptions for any guest account
-- Since guests don't have auth.uid(), we need to allow consumption creation
-- for guest accounts specifically
CREATE POLICY "allow_guest_consumptions"
ON public.consumptions
AS PERMISSIVE
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = consumptions.user_id 
    AND profiles.guest_account = true 
    AND profiles.occupied = true
  )
);