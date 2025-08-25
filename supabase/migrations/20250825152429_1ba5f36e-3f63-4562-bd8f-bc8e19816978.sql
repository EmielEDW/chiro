-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'treasurer', 'admin');
CREATE TYPE topup_status AS ENUM ('pending', 'paid', 'failed', 'cancelled');
CREATE TYPE consumption_source AS ENUM ('tap', 'qr', 'admin');

-- Create users table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'user',
  chiro_role TEXT,
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  allow_credit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create items table
CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT true,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  stock_quantity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create top_ups table
CREATE TABLE public.top_ups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  status topup_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create consumptions table
CREATE TABLE public.consumptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  price_cents INTEGER NOT NULL,
  note TEXT,
  source consumption_source NOT NULL DEFAULT 'tap',
  client_id TEXT, -- for idempotency
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create adjustments table
CREATE TABLE public.adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  diff_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.top_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for events
CREATE POLICY "Users can view active events" ON public.events FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage events" ON public.events FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for items
CREATE POLICY "Users can view active items" ON public.items FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage items" ON public.items FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for top_ups
CREATE POLICY "Users can view own top_ups" ON public.top_ups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own top_ups" ON public.top_ups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all top_ups" ON public.top_ups FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'treasurer')
  )
);

-- RLS Policies for consumptions
CREATE POLICY "Users can view own consumptions" ON public.consumptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own consumptions" ON public.consumptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all consumptions" ON public.consumptions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'treasurer')
  )
);

-- RLS Policies for adjustments
CREATE POLICY "Users can view own adjustments" ON public.adjustments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Treasurers and admins can manage adjustments" ON public.adjustments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'treasurer')
  )
);

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_top_ups_updated_at
  BEFORE UPDATE ON public.top_ups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to calculate user balance
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indices for better performance
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_top_ups_user_id ON public.top_ups(user_id);
CREATE INDEX idx_top_ups_status ON public.top_ups(status);
CREATE INDEX idx_consumptions_user_id ON public.consumptions(user_id);
CREATE INDEX idx_consumptions_item_id ON public.consumptions(item_id);
CREATE INDEX idx_consumptions_event_id ON public.consumptions(event_id);
CREATE INDEX idx_consumptions_created_at ON public.consumptions(created_at);
CREATE INDEX idx_adjustments_user_id ON public.adjustments(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

-- Insert default items
INSERT INTO public.items (name, price_cents, active, is_default) VALUES
('Water', 75, true, true),
('Fris', 125, true, true),
('Bier', 175, true, true),
('Koffie', 100, true, true),
('Thee', 100, true, true);