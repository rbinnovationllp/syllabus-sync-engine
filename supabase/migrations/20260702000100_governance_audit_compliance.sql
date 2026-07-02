-- Platform governance, audit trail, AI review confirmations, and compliance records.

create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  user_role text,
  school_name text,
  action text not null,
  entity_type text,
  entity_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_org_created_idx
  on public.platform_audit_logs(org_id, created_at desc);

create index if not exists platform_audit_logs_user_created_idx
  on public.platform_audit_logs(user_id, created_at desc);

create index if not exists platform_audit_logs_action_created_idx
  on public.platform_audit_logs(action, created_at desc);

create table if not exists public.content_review_confirmations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  output_type text not null,
  output_id text,
  title text,
  statement text not null,
  action text not null default 'download',
  created_at timestamptz not null default now()
);

create index if not exists content_review_confirmations_org_created_idx
  on public.content_review_confirmations(org_id, created_at desc);

alter table public.platform_audit_logs enable row level security;
alter table public.content_review_confirmations enable row level security;

drop policy if exists "Service role manages platform audit logs" on public.platform_audit_logs;
create policy "Service role manages platform audit logs"
on public.platform_audit_logs
for all
to service_role
using (true)
with check (true);

drop policy if exists "Admins read platform audit logs" on public.platform_audit_logs;
create policy "Admins read platform audit logs"
on public.platform_audit_logs
for select
to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'super_admin')
  )
  or exists (
    select 1 from public.org_members om
    where om.user_id = auth.uid()
      and om.org_id = platform_audit_logs.org_id
      and om.role::text in ('owner', 'admin', 'super_admin')
  )
);

drop policy if exists "Service role manages content review confirmations" on public.content_review_confirmations;
create policy "Service role manages content review confirmations"
on public.content_review_confirmations
for all
to service_role
using (true)
with check (true);

drop policy if exists "Org admins read content review confirmations" on public.content_review_confirmations;
create policy "Org admins read content review confirmations"
on public.content_review_confirmations
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.org_members om
    where om.user_id = auth.uid()
      and om.org_id = content_review_confirmations.org_id
      and om.role::text in ('owner', 'admin', 'super_admin')
  )
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'super_admin')
  )
);

