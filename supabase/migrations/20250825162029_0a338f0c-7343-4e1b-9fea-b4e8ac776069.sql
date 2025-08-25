-- Add drink categories and stock management
CREATE TYPE drink_category AS ENUM ('frisdrank_pils_chips', 'energy_kriek', 'mixed_drink');

-- Update items table for new features
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS category drink_category,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create user favorites table
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, item_id)
);

-- Enable RLS on favorites
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Policies for favorites
CREATE POLICY "Users can manage their own favorites" 
ON public.user_favorites 
FOR ALL 
USING (auth.uid() = user_id);

-- Add stock tracking to items
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS stock_alert_threshold INTEGER DEFAULT 10;

-- Create stock transactions table for tracking inventory changes
CREATE TABLE IF NOT EXISTS public.stock_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  quantity_change INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'sale', 'adjustment', 'waste')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on stock transactions
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for stock transactions
CREATE POLICY "Admins can manage stock transactions" 
ON public.stock_transactions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE id = auth.uid() AND role = ANY(ARRAY['admin'::user_role, 'treasurer'::user_role])
));

CREATE POLICY "Users can view stock transactions" 
ON public.stock_transactions 
FOR SELECT 
USING (true);

-- Insert default drink categories with correct pricing
INSERT INTO public.items (name, price_cents, category, active, is_default, description) VALUES
('Frisdrank', 75, 'frisdrank_pils_chips', true, true, 'Cola, Fanta, Sprite, Water'),
('Pils', 75, 'frisdrank_pils_chips', true, true, 'Jupiler, Stella Artois'),
('Chips', 75, 'frisdrank_pils_chips', true, true, 'Diverse chips smaken'),
('Red Bull', 125, 'energy_kriek', true, true, 'Energy drink'),
('Kriek', 125, 'energy_kriek', true, true, 'Kriekenbier'),
('Mixed Drink', 300, 'mixed_drink', true, true, 'Cocktails en mixed drinks')
ON CONFLICT DO NOTHING;

-- Update trigger for stock transactions when consumptions are created
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for stock updates
DROP TRIGGER IF EXISTS consumption_stock_trigger ON public.consumptions;
CREATE TRIGGER consumption_stock_trigger
  AFTER INSERT ON public.consumptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_consumption_stock();