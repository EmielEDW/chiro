-- Add notify_on_low_stock column to items table
ALTER TABLE public.items 
ADD COLUMN notify_on_low_stock boolean NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.items.notify_on_low_stock IS 'Whether to show low stock alerts for this item in admin dashboard';