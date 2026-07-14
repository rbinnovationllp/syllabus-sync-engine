-- Storage management controls for School Super Admin dashboards.
-- Adds archive metadata and threshold tracking without changing S3 object access.

alter table public.school_storage_objects
  add column if not exists academic_year_id uuid references public.academic_years(id) on delete set null;

alter table public.school_storage_objects
  add column if not exists archived_at timestamptz;

alter table public.school_storage_objects
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.school_storage_objects
  add column if not exists archive_reason text;

alter table public.school_storage_objects
  add column if not exists archive_storage_class text not null default 'standard';

alter table public.school_storage_objects
  add column if not exists compressed_size_bytes bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_storage_objects_archive_storage_class_check'
  ) then
    alter table public.school_storage_objects
      add constraint school_storage_objects_archive_storage_class_check
      check (archive_storage_class in ('standard', 'archive', 'deep_archive'));
  end if;
end $$;

create index if not exists school_storage_objects_org_archive_idx
  on public.school_storage_objects(org_id, archived_at, academic_year_id, created_at desc);

create table if not exists public.organization_storage_usage_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  threshold integer not null check (threshold in (80, 90, 100)),
  used_bytes bigint not null default 0,
  quota_bytes bigint not null default 0,
  alert_date date not null default current_date,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists organization_storage_usage_alerts_once_per_day_idx
  on public.organization_storage_usage_alerts(org_id, threshold, alert_date);

alter table public.organization_storage_usage_alerts enable row level security;

drop policy if exists "Org members read storage usage alerts" on public.organization_storage_usage_alerts;
create policy "Org members read storage usage alerts"
on public.organization_storage_usage_alerts
for select
to authenticated
using (public.is_org_member(org_id));

drop policy if exists "Service role manages storage usage alerts" on public.organization_storage_usage_alerts;
create policy "Service role manages storage usage alerts"
on public.organization_storage_usage_alerts
for all
to service_role
using (true)
with check (true);
