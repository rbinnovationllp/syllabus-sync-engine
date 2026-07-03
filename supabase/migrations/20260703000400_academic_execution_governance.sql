-- Academic execution monitoring, school governance, permissions, sessions, and recycle-bin foundation.

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.school_super_admin_declarations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  super_admin_name text not null,
  designation text not null,
  email text not null,
  mobile text,
  authorized_at timestamptz not null default now(),
  authorization_notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists school_super_admin_one_active_per_org
  on public.school_super_admin_declarations(org_id)
  where active;

create table if not exists public.school_module_permissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null,
  can_view boolean not null default true,
  can_generate boolean not null default false,
  can_edit boolean not null default false,
  can_approve boolean not null default false,
  can_download boolean not null default false,
  can_delete boolean not null default false,
  can_manage boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, user_id, module)
);

create table if not exists public.teaching_progress_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  teacher_assignment_id uuid references public.teacher_assignments(id) on delete set null,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  grade text not null,
  section text,
  subject text not null,
  planned_date date,
  actual_date date not null default current_date,
  planned_topic text,
  actual_chapter text,
  actual_topics text not null,
  status text not null check (status in ('completed', 'partially_completed', 'not_covered')),
  periods_taken numeric(5,2) not null default 1,
  remarks text,
  evidence_url text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists teaching_progress_org_year_idx
  on public.teaching_progress_logs(org_id, academic_year_id, actual_date desc);
create index if not exists teaching_progress_teacher_idx
  on public.teaching_progress_logs(teacher_user_id, actual_date desc);
create index if not exists teaching_progress_subject_idx
  on public.teaching_progress_logs(academic_year_id, grade, subject);

create table if not exists public.user_session_registry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete set null,
  session_label text,
  device_info text,
  ip_address inet,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null
);

create index if not exists user_session_registry_user_idx
  on public.user_session_registry(user_id, last_seen_at desc);

create table if not exists public.school_recycle_bin (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  source_table text not null,
  source_id uuid not null,
  record_label text,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '30 days'),
  restored_at timestamptz,
  restored_by uuid references auth.users(id) on delete set null,
  purged_at timestamptz,
  purged_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists school_recycle_bin_org_idx
  on public.school_recycle_bin(org_id, deleted_at desc);

alter table public.school_super_admin_declarations enable row level security;
alter table public.school_module_permissions enable row level security;
alter table public.teaching_progress_logs enable row level security;
alter table public.user_session_registry enable row level security;
alter table public.school_recycle_bin enable row level security;

create or replace function public.is_org_admin(_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members om
    where om.org_id = _org_id
      and om.user_id = auth.uid()
      and om.role in ('admin', 'super_admin')
  )
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'super_admin'::public.app_role
  );
$$;

create or replace function public.is_org_member(_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members om
    where om.org_id = _org_id
      and om.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'super_admin'::public.app_role
  );
$$;

drop policy if exists "Org admins manage school super admin declarations" on public.school_super_admin_declarations;
create policy "Org admins manage school super admin declarations"
on public.school_super_admin_declarations
for all
to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Org admins manage module permissions" on public.school_module_permissions;
create policy "Org admins manage module permissions"
on public.school_module_permissions
for all
to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Org members read module permissions" on public.school_module_permissions;
create policy "Org members read module permissions"
on public.school_module_permissions
for select
to authenticated
using (public.is_org_member(org_id));

drop policy if exists "Teachers manage own progress logs" on public.teaching_progress_logs;
create policy "Teachers manage own progress logs"
on public.teaching_progress_logs
for all
to authenticated
using (teacher_user_id = auth.uid() and deleted_at is null)
with check (teacher_user_id = auth.uid());

drop policy if exists "Org admins read all progress logs" on public.teaching_progress_logs;
create policy "Org admins read all progress logs"
on public.teaching_progress_logs
for select
to authenticated
using (public.is_org_admin(org_id));

drop policy if exists "Org admins update progress logs" on public.teaching_progress_logs;
create policy "Org admins update progress logs"
on public.teaching_progress_logs
for update
to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Users read own sessions" on public.user_session_registry;
create policy "Users read own sessions"
on public.user_session_registry
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Org admins read org sessions" on public.user_session_registry;
create policy "Org admins read org sessions"
on public.user_session_registry
for select
to authenticated
using (org_id is not null and public.is_org_admin(org_id));

drop policy if exists "Service role manages sessions" on public.user_session_registry;
create policy "Service role manages sessions"
on public.user_session_registry
for all
to service_role
using (true)
with check (true);

drop policy if exists "Org admins manage recycle bin" on public.school_recycle_bin;
create policy "Org admins manage recycle bin"
on public.school_recycle_bin
for all
to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop trigger if exists touch_school_super_admin_declarations_updated_at on public.school_super_admin_declarations;
create trigger touch_school_super_admin_declarations_updated_at
before update on public.school_super_admin_declarations
for each row execute function public.update_updated_at_column();

drop trigger if exists touch_school_module_permissions_updated_at on public.school_module_permissions;
create trigger touch_school_module_permissions_updated_at
before update on public.school_module_permissions
for each row execute function public.update_updated_at_column();

drop trigger if exists touch_teaching_progress_logs_updated_at on public.teaching_progress_logs;
create trigger touch_teaching_progress_logs_updated_at
before update on public.teaching_progress_logs
for each row execute function public.update_updated_at_column();

