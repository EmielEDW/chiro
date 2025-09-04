-- Remove treasurer restrictions - allow any authenticated user to manage their own adjustments (including late fees)
DROP POLICY IF EXISTS "Treasurers and admins can manage adjustments" ON public.adjustments;

-- Create new policy allowing users to create their own adjustments
CREATE POLICY "Users can create own adjustments"
ON public.adjustments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create new policy allowing users to update their own adjustments  
CREATE POLICY "Users can update own adjustments"
ON public.adjustments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create new policy allowing users to delete their own adjustments
CREATE POLICY "Users can delete own adjustments"
ON public.adjustments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Keep admin view access for oversight
CREATE POLICY "Admins can view all adjustments"
ON public.adjustments
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'::user_role
));

-- Keep admin management access for oversight
CREATE POLICY "Admins can manage all adjustments"
ON public.adjustments
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'::user_role
));

-- Update stock transactions policy to remove treasurer restriction
DROP POLICY IF EXISTS "Admins can manage stock transactions" ON public.stock_transactions;
DROP POLICY IF EXISTS "Admin and treasurer can view stock transactions" ON public.stock_transactions;

-- Allow admins to manage stock transactions (keep this for inventory management)
CREATE POLICY "Admins can manage stock transactions"
ON public.stock_transactions
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'::user_role
));

CREATE POLICY "Admins can view stock transactions"
ON public.stock_transactions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'::user_role
));

-- Update top_ups policy to remove treasurer restriction
DROP POLICY IF EXISTS "Admins can view all top_ups" ON public.top_ups;

CREATE POLICY "Admins can view all top_ups"
ON public.top_ups
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'::user_role
));