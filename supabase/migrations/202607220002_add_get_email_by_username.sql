-- Function: get email by display_name (for username login support)
-- SECURITY DEFINER so browser client can look up auth.users via profiles
create or replace function public.get_email_by_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.display_name = p_username
  limit 1;
$$;