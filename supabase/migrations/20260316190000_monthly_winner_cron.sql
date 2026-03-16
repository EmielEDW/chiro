BEGIN;

-- Enable pg_cron extension (free on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function that calculates last month's top spender and notifies all active users
CREATE OR REPLACE FUNCTION public.notify_monthly_winner()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  winner_name TEXT;
  winner_total INTEGER;
  month_label TEXT;
  month_start TIMESTAMPTZ;
  month_end TIMESTAMPTZ;
  active_user RECORD;
BEGIN
  -- Calculate the previous month's boundaries
  month_start := date_trunc('month', now() - interval '1 month');
  month_end := date_trunc('month', now());
  month_label := to_char(month_start, 'TMMonth YYYY');

  -- Find top spender of last month, excluding reversed transactions
  SELECT p.name, COALESCE(SUM(c.price_cents), 0) AS total
  INTO winner_name, winner_total
  FROM public.consumptions c
  JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN public.transaction_reversals tr
    ON tr.original_transaction_id = c.id
    AND tr.original_transaction_type = 'consumption'
  WHERE c.created_at >= month_start
    AND c.created_at < month_end
    AND p.active = true
    AND tr.id IS NULL
  GROUP BY p.id, p.name
  ORDER BY total DESC
  LIMIT 1;

  -- If no consumptions last month, skip
  IF winner_name IS NULL THEN
    RETURN;
  END IF;

  -- Insert a notification for each active user
  INSERT INTO public.notifications (title, message, type, action_type, created_by, user_id)
  SELECT
    'Winnaar van ' || month_label,
    winner_name || ' is de winnaar van ' || month_label || ' met ' || chr(8364) || to_char(winner_total / 100.0, 'FM999G999D00') || '!',
    'broadcast',
    'announcement',
    active_user.id,
    active_user.id
  FROM public.profiles active_user
  WHERE active_user.active = true;

END;
$$;

-- Schedule: run on the 1st of every month at 08:00 UTC
SELECT cron.schedule(
  'monthly-leaderboard-winner',
  '0 8 1 * *',
  $$SELECT public.notify_monthly_winner()$$
);

COMMIT;
