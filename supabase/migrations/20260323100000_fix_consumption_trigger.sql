BEGIN;

-- FIX: De vorige migratie (20260316210000) heeft per ongeluk SECURITY DEFINER
-- en de guest-account handling verwijderd uit handle_consumption_stock().
--
-- Gevolgen:
-- 1. Zonder SECURITY DEFINER draait de trigger als de gewone user,
--    waardoor UPDATE op items silently faalt door RLS → stock wordt NIET verminderd
-- 2. Zonder guest-handling crasht de trigger voor gastaccounts door een FK-violation
--    op stock_transactions.created_by → auth.users(id)
-- 3. Toegevoegd: server-side saldo-check om te voorkomen dat users onder 0 gaan

CREATE OR REPLACE FUNCTION public.handle_consumption_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_category text;
  component_record RECORD;
  current_stock integer;
  transaction_created_by uuid;
  user_balance integer;
  user_is_guest boolean;
  user_allow_credit boolean;
BEGIN
  -- Bepaal of het een gastaccount is
  SELECT
    COALESCE(guest_account, false),
    COALESCE(allow_credit, false)
  INTO user_is_guest, user_allow_credit
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Server-side saldo check (alleen voor niet-gasten zonder krediet)
  IF NOT user_is_guest AND NOT user_allow_credit THEN
    SELECT public.calculate_user_balance(NEW.user_id) INTO user_balance;
    IF user_balance < NEW.price_cents THEN
      RAISE EXCEPTION 'Onvoldoende saldo';
    END IF;
  END IF;

  -- Get the category and stock of the consumed item
  SELECT category, COALESCE(stock_quantity, 0)
  INTO item_category, current_stock
  FROM public.items WHERE id = NEW.item_id;

  -- Bepaal created_by voor stock_transactions
  -- Gastaccounts bestaan niet in auth.users, dus NULL gebruiken
  IF user_is_guest THEN
    transaction_created_by := NULL;
  ELSE
    transaction_created_by := NEW.user_id;
  END IF;

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
        transaction_created_by
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
    VALUES (NEW.item_id, -1, 'sale', 'Automatic stock decrease from consumption', transaction_created_by);
  END IF;

  RETURN NEW;
END;
$$;

-- Voeg UNIQUE constraint toe op client_id om dubbele consumptions te voorkomen
-- (idempotency enforcement bij network retries)
ALTER TABLE public.consumptions
ADD CONSTRAINT consumptions_client_id_unique UNIQUE (client_id);

COMMIT;
