BEGIN;

-- Pre-flight: weiger te draaien als er nog mixed_drinks-data is
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.items WHERE category = 'mixed_drinks') THEN
    RAISE EXCEPTION 'Items met category=mixed_drinks bestaan nog, migratie afgebroken';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mixed_drink_components LIMIT 1) THEN
    RAISE EXCEPTION 'mixed_drink_components bevat nog rijen, migratie afgebroken';
  END IF;
END $$;

-- Herschrijf handle_consumption_stock zonder mixed_drinks-branch
CREATE OR REPLACE FUNCTION public.handle_consumption_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_stock integer;
  transaction_created_by uuid;
  user_balance integer;
  user_is_guest boolean;
  user_allow_credit boolean;
BEGIN
  SELECT
    COALESCE(guest_account, false),
    COALESCE(allow_credit, false)
  INTO user_is_guest, user_allow_credit
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF NOT user_is_guest AND NOT user_allow_credit THEN
    SELECT public.calculate_user_balance(NEW.user_id) INTO user_balance;
    IF user_balance < NEW.price_cents THEN
      RAISE EXCEPTION 'Onvoldoende saldo';
    END IF;
  END IF;

  SELECT COALESCE(stock_quantity, 0)
  INTO current_stock
  FROM public.items WHERE id = NEW.item_id;

  IF user_is_guest THEN
    transaction_created_by := NULL;
  ELSE
    transaction_created_by := NEW.user_id;
  END IF;

  IF current_stock <= 0 THEN
    RAISE EXCEPTION 'Onvoldoende voorraad';
  END IF;

  UPDATE public.items
  SET stock_quantity = COALESCE(stock_quantity, 0) - 1
  WHERE id = NEW.item_id;

  INSERT INTO public.stock_transactions (item_id, quantity_change, transaction_type, notes, created_by)
  VALUES (NEW.item_id, -1, 'sale', 'Automatic stock decrease from consumption', transaction_created_by);

  RETURN NEW;
END;
$$;

-- Drop RPC functies die niet meer gebruikt worden
DROP FUNCTION IF EXISTS public.calculate_mixed_drink_stock(uuid);
DROP FUNCTION IF EXISTS public.calculate_mixed_drink_prices(uuid);

-- Drop de tabel (FK's met ON DELETE CASCADE op items, dus geen orphans)
DROP TABLE public.mixed_drink_components;

COMMIT;
