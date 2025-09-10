-- Update the transaction reversal validation function to allow admins
CREATE OR REPLACE FUNCTION public.validate_transaction_reversal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if the person doing the reversal is an admin
  DECLARE
    reverser_role text;
  BEGIN
    SELECT role INTO reverser_role 
    FROM public.profiles 
    WHERE id = NEW.reversed_by;
    
    -- If the reverser is an admin, skip the ownership validation
    IF reverser_role = 'admin' THEN
      -- Still verify the transaction exists
      IF NEW.original_transaction_type = 'consumption' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.consumptions 
          WHERE id = NEW.original_transaction_id
        ) THEN
          RAISE EXCEPTION 'Transaction does not exist';
        END IF;
      END IF;
    ELSE
      -- For non-admins, verify the original transaction belongs to the user
      IF NEW.original_transaction_type = 'consumption' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.consumptions 
          WHERE id = NEW.original_transaction_id 
          AND user_id = NEW.user_id
        ) THEN
          RAISE EXCEPTION 'Cannot reverse transaction that does not belong to you';
        END IF;
      END IF;
    END IF;
  END;

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