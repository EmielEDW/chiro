-- Update handle_new_user to support guest signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    email,
    role,
    guest_account,
    allow_credit,
    username,
    chiro_role
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email,
    'user',
    COALESCE((NEW.raw_user_meta_data ->> 'guest')::boolean, false),
    COALESCE((NEW.raw_user_meta_data ->> 'guest')::boolean, false),
    NULLIF(LOWER(NEW.raw_user_meta_data ->> 'username'), ''),
    NULLIF(NEW.raw_user_meta_data ->> 'chiro_role', '')
  );
  RETURN NEW;
END;
$$;