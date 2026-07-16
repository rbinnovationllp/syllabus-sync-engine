-- Curriculum Mapping & Copyright-Safe Planning Framework.
-- Supports chapter-level mapping without requiring full private-publisher textbook uploads.

create table if not exists public.curriculum_standard_references (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('ncert', 'state_board', 'cbse_learning_outcomes', 'icse_curriculum', 'public_framework', 'school_custom')),
  board text,
  state text,
  grade text not null,
  subject text not null,
  chapter_name text not null,
  topic_names text[] not null default '{}',
  learning_objectives text[] not null default '{}',
  key_concepts text[] not null default '{}',
  suggested_periods numeric,
  source_url text,
  copyright_status text not null default 'public_reference' check (copyright_status in ('public_reference', 'official_open', 'school_provided', 'metadata_only')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists curriculum_standard_refs_lookup_idx
  on public.curriculum_standard_references(lower(coalesce(board, '')), lower(grade), lower(subject), active);

create table if not exists public.curriculum_mapping_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete cascade,
  grade text not null,
  subject text not null,
  board text,
  book_name text,
  publisher text,
  input_chapters jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'mapped', 'needs_review', 'approved', 'archived')),
  total_chapters int not null default 0,
  mapped_chapters int not null default 0,
  unique_chapters int not null default 0,
  average_confidence numeric not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists curriculum_mapping_runs_org_idx
  on public.curriculum_mapping_runs(org_id, academic_year_id, grade, subject, status);

create table if not exists public.curriculum_chapter_mappings (
  id uuid primary key default gen_random_uuid(),
  mapping_run_id uuid not null references public.curriculum_mapping_runs(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  chapter_name text not null,
  topic_names text[] not null default '{}',
  learning_objectives text[] not null default '{}',
  matched_reference_id uuid references public.curriculum_standard_references(id) on delete set null,
  matched_source text,
  matched_chapter_name text,
  matched_topic_names text[] not null default '{}',
  mapping_status text not null default 'unmapped' check (mapping_status in ('mapped', 'partial_match', 'unique', 'needs_information', 'approved')),
  confidence numeric not null default 0,
  estimated_periods numeric,
  revision_periods numeric,
  examination_weight text,
  information_needed text[] not null default '{}',
  school_notes text,
  teacher_confirmed boolean not null default false,
  copyright_handling text not null default 'metadata_only' check (copyright_handling in ('official_open', 'metadata_only', 'permitted_extract', 'school_authorized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists curriculum_chapter_mappings_run_idx
  on public.curriculum_chapter_mappings(mapping_run_id, mapping_status, confidence);

create table if not exists public.curriculum_unique_chapter_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  mapping_run_id uuid not null references public.curriculum_mapping_runs(id) on delete cascade,
  chapter_mapping_id uuid references public.curriculum_chapter_mappings(id) on delete cascade,
  chapter_name text not null,
  requested_fields text[] not null default array['chapter_summary', 'learning_objectives', 'topics_covered', 'key_concepts'],
  school_response jsonb not null default '{}'::jsonb,
  status text not null default 'requested' check (status in ('requested', 'submitted', 'accepted', 'closed')),
  rights_confirmation boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists curriculum_unique_requests_org_idx
  on public.curriculum_unique_chapter_requests(org_id, mapping_run_id, status);

grant select, insert, update on public.curriculum_mapping_runs to authenticated;
grant select, insert, update on public.curriculum_chapter_mappings to authenticated;
grant select, insert, update on public.curriculum_unique_chapter_requests to authenticated;
grant select on public.curriculum_standard_references to authenticated;
grant all on public.curriculum_mapping_runs to service_role;
grant all on public.curriculum_chapter_mappings to service_role;
grant all on public.curriculum_unique_chapter_requests to service_role;
grant all on public.curriculum_standard_references to service_role;

alter table public.curriculum_mapping_runs enable row level security;
alter table public.curriculum_chapter_mappings enable row level security;
alter table public.curriculum_unique_chapter_requests enable row level security;
alter table public.curriculum_standard_references enable row level security;

drop policy if exists "Org members read curriculum mapping runs" on public.curriculum_mapping_runs;
drop policy if exists "Org admins manage curriculum mapping runs" on public.curriculum_mapping_runs;
drop policy if exists "Org members read curriculum chapter mappings" on public.curriculum_chapter_mappings;
drop policy if exists "Org admins manage curriculum chapter mappings" on public.curriculum_chapter_mappings;
drop policy if exists "Org members read unique chapter requests" on public.curriculum_unique_chapter_requests;
drop policy if exists "Org admins manage unique chapter requests" on public.curriculum_unique_chapter_requests;
drop policy if exists "Authenticated users read active curriculum references" on public.curriculum_standard_references;

create policy "Org members read curriculum mapping runs"
  on public.curriculum_mapping_runs for select to authenticated
  using (exists (select 1 from public.org_members m where m.org_id = curriculum_mapping_runs.org_id and m.user_id = auth.uid()));

create policy "Org admins manage curriculum mapping runs"
  on public.curriculum_mapping_runs for all to authenticated
  using (exists (select 1 from public.org_members m where m.org_id = curriculum_mapping_runs.org_id and m.user_id = auth.uid() and m.role::text in ('admin','super_admin','coordinator')))
  with check (exists (select 1 from public.org_members m where m.org_id = curriculum_mapping_runs.org_id and m.user_id = auth.uid() and m.role::text in ('admin','super_admin','coordinator')));

create policy "Org members read curriculum chapter mappings"
  on public.curriculum_chapter_mappings for select to authenticated
  using (exists (select 1 from public.org_members m where m.org_id = curriculum_chapter_mappings.org_id and m.user_id = auth.uid()));

create policy "Org admins manage curriculum chapter mappings"
  on public.curriculum_chapter_mappings for all to authenticated
  using (exists (select 1 from public.org_members m where m.org_id = curriculum_chapter_mappings.org_id and m.user_id = auth.uid() and m.role::text in ('admin','super_admin','coordinator')))
  with check (exists (select 1 from public.org_members m where m.org_id = curriculum_chapter_mappings.org_id and m.user_id = auth.uid() and m.role::text in ('admin','super_admin','coordinator')));

create policy "Org members read unique chapter requests"
  on public.curriculum_unique_chapter_requests for select to authenticated
  using (exists (select 1 from public.org_members m where m.org_id = curriculum_unique_chapter_requests.org_id and m.user_id = auth.uid()));

create policy "Org admins manage unique chapter requests"
  on public.curriculum_unique_chapter_requests for all to authenticated
  using (exists (select 1 from public.org_members m where m.org_id = curriculum_unique_chapter_requests.org_id and m.user_id = auth.uid() and m.role::text in ('admin','super_admin','coordinator')))
  with check (exists (select 1 from public.org_members m where m.org_id = curriculum_unique_chapter_requests.org_id and m.user_id = auth.uid() and m.role::text in ('admin','super_admin','coordinator')));

create policy "Authenticated users read active curriculum references"
  on public.curriculum_standard_references for select to authenticated
  using (active = true);
