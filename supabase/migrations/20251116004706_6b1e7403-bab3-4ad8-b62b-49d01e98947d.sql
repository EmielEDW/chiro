-- Add new columns to notifications table for enhanced functionality
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT 'announcement',
ADD COLUMN IF NOT EXISTS payment_amount_cents integer,
ADD COLUMN IF NOT EXISTS payment_status text,
ADD COLUMN IF NOT EXISTS requires_acknowledgment boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS acknowledged_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Add check constraint for action_type
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_action_type_check 
CHECK (action_type IN ('announcement', 'payment_request', 'reminder', 'alert', 'info'));

-- Add check constraint for payment_status
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_payment_status_check 
CHECK (payment_status IS NULL OR payment_status IN ('pending', 'paid', 'cancelled'));

-- Create index for faster queries on unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read) WHERE read = false;

-- Create index for payment requests
CREATE INDEX IF NOT EXISTS idx_notifications_payment_status ON public.notifications(payment_status) WHERE payment_status IS NOT NULL;