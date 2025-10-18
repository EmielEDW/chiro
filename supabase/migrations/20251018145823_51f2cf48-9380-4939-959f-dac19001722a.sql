-- Create stock audits table
CREATE TABLE public.stock_audits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create stock audit items table
CREATE TABLE public.stock_audit_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES public.stock_audits(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  expected_quantity INTEGER NOT NULL,
  actual_quantity INTEGER NOT NULL,
  difference INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_audits
CREATE POLICY "Admins can manage stock audits"
ON public.stock_audits
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- RLS Policies for stock_audit_items
CREATE POLICY "Admins can manage stock audit items"
ON public.stock_audit_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Create indexes
CREATE INDEX idx_stock_audits_created_by ON public.stock_audits(created_by);
CREATE INDEX idx_stock_audits_status ON public.stock_audits(status);
CREATE INDEX idx_stock_audit_items_audit_id ON public.stock_audit_items(audit_id);
CREATE INDEX idx_stock_audit_items_item_id ON public.stock_audit_items(item_id);