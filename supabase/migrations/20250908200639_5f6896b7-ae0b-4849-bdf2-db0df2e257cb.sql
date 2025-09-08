-- Fix stock transaction trigger to use correct transaction_type values
-- The valid values are 'sale' and 'purchase', not 'consumption'

DROP TRIGGER IF EXISTS handle_consumption_stock_trigger ON public.consumptions;

CREATE OR REPLACE FUNCTION public.handle_consumption_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item_category text;
  component_record RECORD;
BEGIN
  -- Get the category of the consumed item
  SELECT category INTO item_category FROM public.items WHERE id = NEW.item_id;
  
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
      
      -- Log stock transaction for each component with correct transaction_type
      INSERT INTO public.stock_transactions (item_id, quantity_change, transaction_type, notes, created_by)
      VALUES (
        component_record.component_item_id, 
        -component_record.quantity, 
        'sale', -- Use 'sale' instead of 'consumption'
        'Component used in mixed drink: ' || (SELECT name FROM public.items WHERE id = NEW.item_id), 
        NEW.user_id
      );
    END LOOP;
  ELSE
    -- For regular items, decrease stock as before
    UPDATE public.items 
    SET stock_quantity = COALESCE(stock_quantity, 0) - 1 
    WHERE id = NEW.item_id;
    
    -- Log stock transaction for regular item with correct transaction_type
    INSERT INTO public.stock_transactions (item_id, quantity_change, transaction_type, notes, created_by)
    VALUES (NEW.item_id, -1, 'sale', 'Automatic stock decrease from consumption', NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER handle_consumption_stock_trigger
  AFTER INSERT ON public.consumptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_consumption_stock();