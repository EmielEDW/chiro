-- Fix the trigger to handle guest accounts properly
-- The issue is that stock_transactions.created_by references auth.users, 
-- but guest accounts don't exist in auth.users, only in profiles

CREATE OR REPLACE FUNCTION public.handle_consumption_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item_category text;
  component_record RECORD;
  transaction_created_by uuid;
BEGIN
  -- Get the category of the consumed item
  SELECT category INTO item_category FROM public.items WHERE id = NEW.item_id;
  
  -- Determine who should be recorded as creating the stock transaction
  -- For guest accounts, use NULL since they don't exist in auth.users
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = NEW.user_id 
    AND guest_account = true
  ) THEN
    transaction_created_by := NULL;  -- Guest accounts don't have auth records
  ELSE
    transaction_created_by := NEW.user_id;  -- Regular users
  END IF;
  
  -- If it's a mixed drink, decrease component stock
  IF item_category = 'mixed_drinks' THEN
    -- Decrease stock of each component
    FOR component_record IN 
      SELECT c.component_item_id, c.quantity
      FROM public.mixed_drink_components c
      WHERE c.mixed_drink_id = NEW.item_id
    LOOP
      -- Update component stock
      UPDATE public.items 
      SET stock_quantity = COALESCE(stock_quantity, 0) - component_record.quantity
      WHERE id = component_record.component_item_id;
      
      -- Log stock transaction for each component
      INSERT INTO public.stock_transactions (item_id, quantity_change, transaction_type, notes, created_by)
      VALUES (
        component_record.component_item_id, 
        -component_record.quantity, 
        'sale',
        'Component used in mixed drink: ' || (SELECT name FROM public.items WHERE id = NEW.item_id), 
        transaction_created_by
      );
    END LOOP;
  ELSE
    -- For regular items, decrease stock as before
    UPDATE public.items 
    SET stock_quantity = COALESCE(stock_quantity, 0) - 1 
    WHERE id = NEW.item_id;
    
    -- Log stock transaction for regular item
    INSERT INTO public.stock_transactions (item_id, quantity_change, transaction_type, notes, created_by)
    VALUES (NEW.item_id, -1, 'sale', 'Automatic stock decrease from consumption', transaction_created_by);
  END IF;
  
  RETURN NEW;
END;
$function$;