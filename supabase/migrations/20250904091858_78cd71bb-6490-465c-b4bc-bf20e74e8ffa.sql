-- Drop all existing adjustment policies first
DROP POLICY IF EXISTS "Users can view own adjustments" ON public.adjustments;
DROP POLICY IF EXISTS "Treasurers and admins can manage adjustments" ON public.adjustments;
DROP POLICY IF EXISTS "Users can create own adjustments" ON public.adjustments;
DROP POLICY IF EXISTS "Users can update own adjustments" ON public.adjustments;
DROP POLICY IF EXISTS "Users can delete own adjustments" ON public.adjustments;
DROP POLICY IF EXISTS "Admins can view all adjustments" ON public.adjustments;
DROP POLICY IF EXISTS "Admins can manage all adjustments" ON public.adjustments;

-- Create new policies for adjustments - allow users to manage their own
CREATE POLICY "Users can view own adjustments"
ON public.adjustments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own adjustments"
ON public.adjustments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own adjustments"
ON public.adjustments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own adjustments"
ON public.adjustments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Keep admin access for oversight
CREATE POLICY "Admins can manage all adjustments"
ON public.adjustments
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'::user_role
));

-- Update stock transactions - remove treasurer restrictions
DROP POLICY IF EXISTS "Admins can manage stock transactions" ON public.stock_transactions;
DROP POLICY IF EXISTS "Admin and treasurer can view stock transactions" ON public.stock_transactions;

CREATE POLICY "Admins can manage stock transactions"
ON public.stock_transactions
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'::user_role
));

-- Update top_ups - remove treasurer restrictions  
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