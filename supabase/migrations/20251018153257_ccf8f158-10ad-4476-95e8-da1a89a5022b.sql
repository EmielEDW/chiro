-- Create restock_sessions table for bulk stock replenishment
CREATE TABLE public.restock_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'completed'
);

-- Create restock_items table for individual item changes in a restock session
CREATE TABLE public.restock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restock_session_id UUID NOT NULL REFERENCES public.restock_sessions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  quantity_change INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restock_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for restock_sessions
CREATE POLICY "Admins can manage restock sessions"
ON public.restock_sessions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for restock_items
CREATE POLICY "Admins can manage restock items"
ON public.restock_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create indexes for better performance
CREATE INDEX idx_restock_items_session ON public.restock_items(restock_session_id);
CREATE INDEX idx_restock_items_item ON public.restock_items(item_id);
CREATE INDEX idx_restock_sessions_created_by ON public.restock_sessions(created_by);