-- CurriculumOS V2 Phase 1 foundation
-- Adds editable AI output storage and audit history for Principal Dashboard,
-- Teacher Copilot, Content Studio, and Assessment Generator.

create table if not exists public.v2_ai_outputs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  year_id uuid references public.academic_years(id) on delete set null,
  user_id uuid not null,
  module text not null check (module in ('principal_dashboard', 'teacher_copilot', 'content_studio', 'assessment_generator')),
  resource_type text not null,
  title text not null,
  content text not null,
  grade text,
  subject text,
  params jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'approved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_ai_output_edits (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references public.v2_ai_outputs(id) on delete cascade,
  user_id uuid not null,
  edit_summary text not null default 'Manual edit saved',
  created_at timestamptz not null default now()
);

create index if not exists v2_ai_outputs_org_module_idx on public.v2_ai_outputs(org_id, module, updated_at desc);
create index if not exists v2_ai_outputs_year_idx on public.v2_ai_outputs(year_id, updated_at desc);
create index if not exists v2_ai_output_edits_output_idx on public.v2_ai_output_edits(output_id, created_at desc);

alter table public.v2_ai_outputs enable row level security;
alter table public.v2_ai_output_edits enable row level security;

drop policy if exists "Org members read v2 outputs" on public.v2_ai_outputs;
create policy "Org members read v2 outputs" on public.v2_ai_outputs
  for select to authenticated
  using (public.is_org_member(org_id));

drop policy if exists "Org members insert v2 outputs" on public.v2_ai_outputs;
create policy "Org members insert v2 outputs" on public.v2_ai_outputs
  for insert to authenticated
  with check (public.is_org_member(org_id) and user_id = auth.uid());

drop policy if exists "Org members update v2 outputs" on public.v2_ai_outputs;
create policy "Org members update v2 outputs" on public.v2_ai_outputs
  for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

drop policy if exists "Org admins archive v2 outputs" on public.v2_ai_outputs;
create policy "Org admins archive v2 outputs" on public.v2_ai_outputs
  for delete to authenticated
  using (
    exists (
      select 1 from public.org_members m
      where m.org_id = v2_ai_outputs.org_id
        and m.user_id = auth.uid()
        and m.role in ('admin'::public.app_role, 'super_admin'::public.app_role)
    )
  );

drop policy if exists "Org members read v2 output edits" on public.v2_ai_output_edits;
create policy "Org members read v2 output edits" on public.v2_ai_output_edits
  for select to authenticated
  using (
    exists (
      select 1 from public.v2_ai_outputs o
      where o.id = v2_ai_output_edits.output_id
        and public.is_org_member(o.org_id)
    )
  );

drop policy if exists "Org members insert v2 output edits" on public.v2_ai_output_edits;
create policy "Org members insert v2 output edits" on public.v2_ai_output_edits
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.v2_ai_outputs o
      where o.id = v2_ai_output_edits.output_id
        and public.is_org_member(o.org_id)
    )
  );

grant all on public.v2_ai_outputs to authenticated;
grant all on public.v2_ai_output_edits to authenticated;
grant all on public.v2_ai_outputs to service_role;
grant all on public.v2_ai_output_edits to service_role;
