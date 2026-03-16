BEGIN;

-- Update the consumption stock trigger to prevent negative stock
CREATE OR REPLACE FUNCTION public.handle_consumption_stock()
RETURNS TRIGGER AS $$
DECLARE
  item_category text;
  component_record RECORD;
  current_stock integer;
BEGIN
  -- Get the category and stock of the consumed item
  SELECT category, COALESCE(stock_quantity, 0)
  INTO item_category, current_stock
  FROM public.items WHERE id = NEW.item_id;

  -- If it's a mixed drink, check and decrease component stock
  IF item_category = 'mixed_drinks' THEN
    -- Check all components have enough stock first
    FOR component_record IN
      SELECT c.component_item_id, c.quantity, COALESCE(i.stock_quantity, 0) AS current_qty
      FROM public.mixed_drink_components c
      JOIN public.items i ON i.id = c.component_item_id
      WHERE c.mixed_drink_id = NEW.item_id
    LOOP
      IF component_record.current_qty < component_record.quantity THEN
        RAISE EXCEPTION 'Onvoldoende voorraad voor component van mixed drink';
      END IF;
    END LOOP;

    -- All checks passed, decrease stock
    FOR component_record IN
      SELECT c.component_item_id, c.quantity
      FROM public.mixed_drink_components c
      WHERE c.mixed_drink_id = NEW.item_id
    LOOP
      UPDATE public.items
      SET stock_quantity = COALESCE(stock_quantity, 0) - component_record.quantity
      WHERE id = component_record.component_item_id;

      INSERT INTO public.stock_transactions (item_id, quantity_change, transaction_type, notes, created_by)
      VALUES (
        component_record.component_item_id,
        -component_record.quantity,
        'sale',
        'Component used in mixed drink: ' || (SELECT name FROM public.items WHERE id = NEW.item_id),
        NEW.user_id
      );
    END LOOP;
  ELSE
    -- For regular items, check stock first
    IF current_stock <= 0 THEN
      RAISE EXCEPTION 'Onvoldoende voorraad';
    END IF;

    UPDATE public.items
    SET stock_quantity = COALESCE(stock_quantity, 0) - 1
    WHERE id = NEW.item_id;

    INSERT INTO public.stock_transactions (item_id, quantity_change, transaction_type, notes, created_by)
    VALUES (NEW.item_id, -1, 'sale', 'Automatic stock decrease from consumption', NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
