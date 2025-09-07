-- Add guest account support
-- Add a guest_account field to profiles to distinguish guest accounts
ALTER TABLE public.profiles ADD COLUMN guest_account boolean NOT NULL DEFAULT false;

-- Update RLS policies to allow guest accounts to be created by admins
CREATE POLICY "Admins can create guest accounts" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'::user_role
  )
);