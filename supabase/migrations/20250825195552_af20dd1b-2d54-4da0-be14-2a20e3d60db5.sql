-- Create table for mixed drink components
CREATE TABLE public.mixed_drink_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mixed_drink_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  component_item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(mixed_drink_id, component_item_id)
);

-- Enable RLS
ALTER TABLE public.mixed_drink_components ENABLE ROW LEVEL SECURITY;

-- Create policies for mixed drink components
CREATE POLICY "Users can view mixed drink components" 
ON public.mixed_drink_components 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage mixed drink components" 
ON public.mixed_drink_components 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.role = 'admin'::user_role
));

-- Add trigger for updated_at
CREATE TRIGGER update_mixed_drink_components_updated_at
BEFORE UPDATE ON public.mixed_drink_components
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate mixed drink stock
CREATE OR REPLACE FUNCTION public.calculate_mixed_drink_stock(mixed_drink_item_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  min_stock INTEGER := 0;
  component_record RECORD;
BEGIN
  -- Check if this is a mixed drink
  IF NOT EXISTS (
    SELECT 1 FROM public.items 
    WHERE id = mixed_drink_item_id 
    AND category = 'mixed_drinks'
  ) THEN
    -- Not a mixed drink, return regular stock
    SELECT COALESCE(stock_quantity, 0) INTO min_stock
    FROM public.items 
    WHERE id = mixed_drink_item_id;
    RETURN min_stock;
  END IF;

  -- For mixed drinks, calculate based on components
  min_stock := 999999; -- Start with high number
  
  FOR component_record IN 
    SELECT c.quantity, i.stock_quantity
    FROM public.mixed_drink_components c
    JOIN public.items i ON i.id = c.component_item_id
    WHERE c.mixed_drink_id = mixed_drink_item_id
    AND i.active = true
  LOOP
    -- Calculate how many mixed drinks we can make with this component
    DECLARE
      possible_quantity INTEGER := COALESCE(component_record.stock_quantity, 0) / component_record.quantity;
    BEGIN
      IF possible_quantity < min_stock THEN
        min_stock := possible_quantity;
      END IF;
    END;
  END LOOP;
  
  -- If no components found, return 0
  IF min_stock = 999999 THEN
    min_stock := 0;
  END IF;
  
  RETURN min_stock;
END;
$$;

-- Create function to calculate mixed drink prices
CREATE OR REPLACE FUNCTION public.calculate_mixed_drink_prices(mixed_drink_item_id UUID)
RETURNS TABLE(calculated_purchase_price INTEGER, calculated_sell_price INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_purchase_price INTEGER := 0;
  total_sell_price INTEGER := 0;
  component_record RECORD;
BEGIN
  -- Check if this is a mixed drink
  IF NOT EXISTS (
    SELECT 1 FROM public.items 
    WHERE id = mixed_drink_item_id 
    AND category = 'mixed_drinks'
  ) THEN
    -- Not a mixed drink, return existing prices
    SELECT COALESCE(purchase_price_cents, 0), price_cents 
    INTO total_purchase_price, total_sell_price
    FROM public.items 
    WHERE id = mixed_drink_item_id;
    
    RETURN QUERY SELECT total_purchase_price, total_sell_price;
    RETURN;
  END IF;

  -- For mixed drinks, calculate based on components
  FOR component_record IN 
    SELECT c.quantity, i.price_cents, i.purchase_price_cents
    FROM public.mixed_drink_components c
    JOIN public.items i ON i.id = c.component_item_id
    WHERE c.mixed_drink_id = mixed_drink_item_id
    AND i.active = true
  LOOP
    total_purchase_price := total_purchase_price + (COALESCE(component_record.purchase_price_cents, 0) * component_record.quantity);
    total_sell_price := total_sell_price + (component_record.price_cents * component_record.quantity);
  END LOOP;
  
  RETURN QUERY SELECT total_purchase_price, total_sell_price;
END;
$$;