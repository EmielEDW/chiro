-- Add trigger for handling consumption stock reversals
CREATE OR REPLACE FUNCTION public.handle_consumption_reversal_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only process adjustments that are reversals for consumptions
  IF NEW.reason LIKE 'Foutje teruggedraaid:%' AND NEW.delta_cents > 0 THEN
    -- This is a consumption refund, stock will be handled separately in the application
    NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on adjustments for reversal handling
CREATE TRIGGER handle_consumption_reversal_stock_trigger
  AFTER INSERT ON public.adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_consumption_reversal_stock();

-- Update the consumptions source enum to include new values
ALTER TYPE consumption_source ADD VALUE IF NOT EXISTS 'qr';

-- Ensure stock_transactions table has proper transaction types
-- Add reversal transaction type support
COMMENT ON COLUMN public.stock_transactions.transaction_type IS 'Type of stock transaction: sale, purchase, adjustment, reversal, restock';