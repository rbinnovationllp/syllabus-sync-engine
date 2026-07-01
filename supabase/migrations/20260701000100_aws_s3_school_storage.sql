-- AWS S3 backed school storage.
-- Supabase stores metadata and usage; AWS S3 stores the actual files.

create table if not exists public.school_storage_objects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  bucket text not null,
  object_key text not null unique,
  file_name text not null,
  content_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0),
  category text not null default 'document',
  status text not null default 'pending' check (status in ('pending', 'active', 'deleted')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz
);

create index if not exists school_storage_objects_org_status_idx
  on public.school_storage_objects(org_id, status, created_at desc);

create index if not exists school_storage_objects_uploaded_by_idx
  on public.school_storage_objects(uploaded_by, created_at desc);

alter table public.school_storage_objects enable row level security;

drop policy if exists "Org members can read their school storage metadata" on public.school_storage_objects;
create policy "Org members can read their school storage metadata"
on public.school_storage_objects
for select
to authenticated
using (
  exists (
    select 1
    from public.org_members om
    where om.org_id = school_storage_objects.org_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists "Service role manages school storage metadata" on public.school_storage_objects;
create policy "Service role manages school storage metadata"
on public.school_storage_objects
for all
to service_role
using (true)
with check (true);

create or replace function public.school_storage_used_bytes(target_org_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(size_bytes), 0)::bigint
  from public.school_storage_objects
  where org_id = target_org_id
    and status in ('pending', 'active');
$$;

revoke execute on function public.school_storage_used_bytes(uuid) from public, anon;
grant execute on function public.school_storage_used_bytes(uuid) to authenticated, service_role;
