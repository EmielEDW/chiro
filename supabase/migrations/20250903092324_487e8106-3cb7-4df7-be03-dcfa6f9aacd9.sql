-- Add cocktails category to the enum
ALTER TYPE drink_category ADD VALUE 'cocktails';

-- Create user_archived table for archiving drinks per user
CREATE TABLE public.user_archived (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_archived ENABLE ROW LEVEL SECURITY;

-- Create policies for user archived items
CREATE POLICY "Users can manage their own archived items" 
ON public.user_archived 
FOR ALL 
USING (auth.uid() = user_id);