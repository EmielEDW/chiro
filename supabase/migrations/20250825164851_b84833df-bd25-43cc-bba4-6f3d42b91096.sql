-- Create a SECURITY DEFINER function to safely upgrade a user to admin using a shared admin password
create or replace function public.upgrade_to_admin(_user_id uuid, _admin_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  required_password text := 'Drankenman123!';
begin
  -- Validate the provided admin password
  if _admin_password is null or _admin_password <> required_password then
    return false;
  end if;

  -- Upgrade the user's role to admin
  update public.profiles
    set role = 'admin'
  where id = _user_id;

  return true;
end;
$$;

-- Allow authenticated users to execute the function
grant execute on function public.upgrade_to_admin(uuid, text) to authenticated;