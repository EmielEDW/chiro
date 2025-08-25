-- Fix search path for stock trigger function
CREATE OR REPLACE FUNCTION public.handle_consumption_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Decrease stock when item is consumed
  UPDATE public.items 
  SET stock_quantity = COALESCE(stock_quantity, 0) - 1 
  WHERE id = NEW.item_id;
  
  -- Log stock transaction
  INSERT INTO public.stock_transactions (item_id, quantity_change, transaction_type, notes, created_by)
  VALUES (NEW.item_id, -1, 'sale', 'Automatic stock decrease from consumption', NEW.user_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;