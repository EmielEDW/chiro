-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('personal', 'announcement')),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Admins can manage all notifications
CREATE POLICY "Admins can manage all notifications"
  ON public.notifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can view their own notifications and announcements
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR (type = 'announcement' AND user_id IS NULL)
  );

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR (type = 'announcement' AND user_id IS NULL)
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR (type = 'announcement' AND user_id IS NULL)
  );

-- Create index for faster queries
CREATE INDEX notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX notifications_created_at_idx ON public.notifications(created_at DESC);
CREATE INDEX notifications_read_idx ON public.notifications(read) WHERE read = false;