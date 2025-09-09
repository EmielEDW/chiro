-- Remove CASCADE deletion from consumptions to preserve transaction history when profiles are deleted
-- This ensures that when guest accounts are deleted, their consumptions remain for statistics

-- First, drop the existing foreign key constraint
ALTER TABLE public.consumptions DROP CONSTRAINT IF EXISTS consumptions_user_id_fkey;

-- Recreate the foreign key constraint without CASCADE, so consumptions are preserved
-- We'll set it to SET NULL so the consumption record stays but user_id becomes null
-- But we need to allow NULL values first
ALTER TABLE public.consumptions ALTER COLUMN user_id DROP NOT NULL;

-- Now add the foreign key with SET NULL behavior
ALTER TABLE public.consumptions 
ADD CONSTRAINT consumptions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;