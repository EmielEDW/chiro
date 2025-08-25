-- Fix function security issues by setting search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.calculate_user_balance(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  balance INTEGER := 0;
BEGIN
  -- Sum all paid top-ups
  SELECT COALESCE(SUM(amount_cents), 0) INTO balance
  FROM public.top_ups
  WHERE user_id = user_uuid AND status = 'paid';
  
  -- Add adjustments
  balance := balance + COALESCE((
    SELECT SUM(delta_cents)
    FROM public.adjustments
    WHERE user_id = user_uuid
  ), 0);
  
  -- Subtract consumptions
  balance := balance - COALESCE((
    SELECT SUM(price_cents)
    FROM public.consumptions
    WHERE user_id = user_uuid
  ), 0);
  
  RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;