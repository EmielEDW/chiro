-- Create table to track transaction reversals
CREATE TABLE public.transaction_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_transaction_id UUID NOT NULL,
  original_transaction_type TEXT NOT NULL CHECK (original_transaction_type IN ('consumption', 'topup')),
  reversal_reason TEXT NOT NULL,
  reversed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reversed_by UUID NOT NULL REFERENCES auth.users(id),
  
  CONSTRAINT unique_transaction_reversal UNIQUE (original_transaction_id, original_transaction_type)
);

-- Enable RLS
ALTER TABLE public.transaction_reversals ENABLE ROW LEVEL SECURITY;

-- Users can view their own reversals
CREATE POLICY "Users can view own reversals" 
ON public.transaction_reversals 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can create their own reversals (for self-service reversals)
CREATE POLICY "Users can create own reversals" 
ON public.transaction_reversals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND auth.uid() = reversed_by);

-- Admins can view all reversals
CREATE POLICY "Admins can view all reversals" 
ON public.transaction_reversals 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::user_role
));

-- Create indexes for performance
CREATE INDEX idx_transaction_reversals_user_id ON public.transaction_reversals(user_id);
CREATE INDEX idx_transaction_reversals_original_transaction ON public.transaction_reversals(original_transaction_id, original_transaction_type);