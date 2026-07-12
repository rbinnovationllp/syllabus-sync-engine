-- Permanent master super-admin bootstrap for the platform owner demo/admin account.
-- Passwords are intentionally not stored here; create or reset the password in Supabase Auth.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _is_master_admin boolean := lower(coalesce(new.email, '')) = 'rbinnovationllp@gmail.com';
  _display_name text := case
    when _is_master_admin then 'Rajesh Kumar Khare'
    else coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  end;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, _display_name)
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = case
      when _is_master_admin then excluded.display_name
      else coalesce(public.profiles.display_name, excluded.display_name)
    end,
    updated_at = now();

  if _is_master_admin then
    insert into public.user_roles (user_id, role)
    values (new.id, 'super_admin'::public.app_role)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_master_admin_sync on auth.users;
create trigger on_auth_user_master_admin_sync
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, email, display_name)
select id, email, 'Rajesh Kumar Khare'
from auth.users
where lower(email) = 'rbinnovationllp@gmail.com'
on conflict (id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  updated_at = now();

insert into public.user_roles (user_id, role)
select id, 'super_admin'::public.app_role
from auth.users
where lower(email) = 'rbinnovationllp@gmail.com'
on conflict do nothing;
