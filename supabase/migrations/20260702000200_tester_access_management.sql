-- Tester access management for company super admins.
-- Testers bypass subscription/payment feature gates while keeping normal auth and audit controls.

create table if not exists public.tester_access_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id) on delete set null,
  display_name text,
  access_scope text not null default 'full_platform' check (access_scope in ('full_platform', 'selected_modules')),
  module_flags jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('invited', 'active', 'revoked', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  notes text,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null
);

create unique index if not exists tester_access_grants_email_active_idx
  on public.tester_access_grants(lower(email))
  where status in ('invited', 'active');

create index if not exists tester_access_grants_user_status_idx
  on public.tester_access_grants(user_id, status, starts_at, ends_at);

create index if not exists tester_access_grants_email_status_idx
  on public.tester_access_grants(lower(email), status, starts_at, ends_at);

alter table public.tester_access_grants enable row level security;

drop policy if exists "Super admins manage tester access" on public.tester_access_grants;
create policy "Super admins manage tester access"
on public.tester_access_grants
for all
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'super_admin'
  )
);

drop policy if exists "Service role manages tester access" on public.tester_access_grants;
create policy "Service role manages tester access"
on public.tester_access_grants
for all
to service_role
using (true)
with check (true);

create or replace function public.is_active_tester(user_uuid uuid, feature text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tester_access_grants t
    left join auth.users u on u.id = user_uuid
    where
      (t.user_id = user_uuid or lower(t.email) = lower(coalesce(u.email, '')))
      and t.status in ('invited', 'active')
      and t.starts_at <= now()
      and (t.ends_at is null or t.ends_at > now())
      and (
        t.access_scope = 'full_platform'
        or feature is null
        or coalesce((t.module_flags ->> feature)::boolean, false) = true
      )
  );
$$;

revoke execute on function public.is_active_tester(uuid, text) from public, anon;
grant execute on function public.is_active_tester(uuid, text) to authenticated, service_role;
