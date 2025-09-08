-- Fix the search path security issue in the create_temp_guest_account function
CREATE OR REPLACE FUNCTION public.create_temp_guest_account(_guest_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  new_guest_id uuid;
  next_guest_number integer;
BEGIN
  -- Get the next available guest number
  SELECT COALESCE(MAX(guest_number), 0) + 1 
  INTO next_guest_number
  FROM public.profiles 
  WHERE guest_account = true;
  
  -- Create new temporary guest account
  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    guest_account,
    guest_number,
    occupied,
    occupied_by_name,
    active,
    allow_credit
  ) VALUES (
    gen_random_uuid(),
    'Gast #' || next_guest_number,
    'temp_guest_' || next_guest_number || '@chiro.temp',
    'user',
    true,
    next_guest_number,
    true,
    _guest_name,
    true,
    true  -- Allow credit so guests can go negative
  ) RETURNING id INTO new_guest_id;
  
  RETURN new_guest_id;
END;
$function$;