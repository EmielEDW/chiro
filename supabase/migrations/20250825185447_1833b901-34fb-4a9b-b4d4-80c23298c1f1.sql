-- 1. Drop the vulnerable admin upgrade function
DROP FUNCTION IF EXISTS public.upgrade_to_admin(uuid, text);

-- 2. Create secure admin role grant function (admin-only)
CREATE OR REPLACE FUNCTION public.grant_user_role(_target_user_id uuid, _new_role user_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only admins can grant roles
  IF get_current_user_role() != 'admin' THEN
    RETURN false;
  END IF;

  -- Update target user's role
  UPDATE public.profiles
  SET role = _new_role, updated_at = now()
  WHERE id = _target_user_id;

  -- Log the role change
  INSERT INTO public.audit_logs (entity, entity_id, action, actor_id, diff_json)
  VALUES (
    'profiles',
    _target_user_id,
    'role_change',
    auth.uid(),
    json_build_object('new_role', _new_role, 'changed_by', auth.uid())
  );

  RETURN true;
END;
$function$;

-- 3. Fix transaction reversals integrity with trigger
CREATE OR REPLACE FUNCTION public.validate_transaction_reversal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify the original transaction belongs to the user
  IF NEW.original_transaction_type = 'consumption' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.consumptions 
      WHERE id = NEW.original_transaction_id 
      AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Cannot reverse transaction that does not belong to you';
    END IF;
  END IF;

  -- Check if already reversed
  IF EXISTS (
    SELECT 1 FROM public.transaction_reversals 
    WHERE original_transaction_id = NEW.original_transaction_id
  ) THEN
    RAISE EXCEPTION 'Transaction already reversed';
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger for transaction reversal validation
DROP TRIGGER IF EXISTS validate_reversal_trigger ON public.transaction_reversals;
CREATE TRIGGER validate_reversal_trigger
  BEFORE INSERT ON public.transaction_reversals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_transaction_reversal();

-- 4. Restrict stock transactions to admin/treasurer only
DROP POLICY IF EXISTS "Users can view stock transactions" ON public.stock_transactions;
CREATE POLICY "Admin and treasurer can view stock transactions"
ON public.stock_transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('admin', 'treasurer')
  )
);

-- 5. Clean up redundant policies on profiles
DROP POLICY IF EXISTS "admin_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;