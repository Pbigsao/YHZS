
update public.profiles
set role = 'super_admin'
where role::text = 'admin';

update public.profiles
set role = 'admin'
where role::text = 'reviewer';

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public
as $$ select public.current_role() in ('admin', 'super_admin') $$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public
as $$ select public.current_role() = 'super_admin' $$;

create or replace function public.set_member_role(target_user uuid, target_role public.app_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'super_admin' then
    raise exception 'Super administrator role required';
  end if;
  if target_user = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  update public.profiles set role = target_role, updated_at = now() where id = target_user;
end;
$$;

grant execute on function public.set_member_role(uuid, public.app_role) to authenticated;
