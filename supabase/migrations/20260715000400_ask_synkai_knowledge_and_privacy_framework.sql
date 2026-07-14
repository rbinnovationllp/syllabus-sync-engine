-- Ask SynkAI managed knowledge base and school data privacy/security framework.

create table if not exists public.ask_synkai_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  title text not null,
  category text not null default 'platform',
  content text not null,
  content_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  critical boolean not null default false,
  validation_status text not null default 'validated' check (validation_status in ('validated', 'needs_review', 'failed')),
  validation_notes text,
  indexed_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ask_synkai_knowledge_status_idx
  on public.ask_synkai_knowledge_sources(status, critical, indexed_at desc);

alter table public.ask_synkai_knowledge_sources enable row level security;

drop policy if exists "Super admins read Ask SynkAI knowledge" on public.ask_synkai_knowledge_sources;
create policy "Super admins read Ask SynkAI knowledge"
on public.ask_synkai_knowledge_sources
for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Super admins manage Ask SynkAI knowledge" on public.ask_synkai_knowledge_sources;
create policy "Super admins manage Ask SynkAI knowledge"
on public.ask_synkai_knowledge_sources
for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Service role manages Ask SynkAI knowledge" on public.ask_synkai_knowledge_sources;
create policy "Service role manages Ask SynkAI knowledge"
on public.ask_synkai_knowledge_sources
for all
to service_role
using (true)
with check (true);

create table if not exists public.ask_synkai_knowledge_sync_runs (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid references auth.users(id) on delete set null,
  trigger_type text not null default 'manual',
  status text not null default 'success' check (status in ('success', 'partial', 'failed')),
  sources_indexed integer not null default 0,
  approved_count integer not null default 0,
  pending_count integer not null default 0,
  rejected_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.ask_synkai_knowledge_sync_runs enable row level security;

drop policy if exists "Super admins read Ask SynkAI sync runs" on public.ask_synkai_knowledge_sync_runs;
create policy "Super admins read Ask SynkAI sync runs"
on public.ask_synkai_knowledge_sync_runs
for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Service role manages Ask SynkAI sync runs" on public.ask_synkai_knowledge_sync_runs;
create policy "Service role manages Ask SynkAI sync runs"
on public.ask_synkai_knowledge_sync_runs
for all
to service_role
using (true)
with check (true);

create table if not exists public.school_data_security_framework (
  id uuid primary key default gen_random_uuid(),
  framework_key text not null unique,
  title text not null,
  assurance_statement text not null,
  controls jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.school_data_security_framework enable row level security;

drop policy if exists "Authenticated users read active security framework" on public.school_data_security_framework;
create policy "Authenticated users read active security framework"
on public.school_data_security_framework
for select
to authenticated
using (status = 'active');

drop policy if exists "Super admins manage security framework" on public.school_data_security_framework;
create policy "Super admins manage security framework"
on public.school_data_security_framework
for all
to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Service role manages security framework" on public.school_data_security_framework;
create policy "Service role manages security framework"
on public.school_data_security_framework
for all
to service_role
using (true)
with check (true);

insert into public.school_data_security_framework (
  framework_key,
  title,
  assurance_statement,
  controls,
  status
) values (
  'school-data-privacy-security-confidentiality',
  'School Data Privacy, Security & Confidentiality Framework',
  'All school data stored within Syllabus Synk is protected using industry-standard security practices, access controls, encryption, monitoring, and backup systems. Each school''s data remains isolated and confidential. The platform is designed to prevent unauthorized access, cross-school visibility, and accidental disclosure of information. School data remains the property of the respective institution.',
  '{
    "data_ownership": "Academic, administrative, student, teacher, examination, and operational data remains the property of the respective school. Syllabus Synk acts as technology custodian only.",
    "commercial_use": "School data will not be sold, shared, distributed, or used commercially without explicit authorization.",
    "tenant_isolation": "School records are logically separated by organization and protected by role-aware access checks and row-level security policies where implemented.",
    "role_based_access": "Teachers see assigned classes and subjects; coordinators, principals, and School Super Admins receive administrative access according to responsibility.",
    "company_admin_access": "Company administrator access is limited to authorized support, troubleshooting, maintenance, and must be recorded in audit logs.",
    "encryption": "Sensitive data is protected in transit and at rest using industry-standard cloud, database, and storage security practices.",
    "audit_logging": "Critical actions such as access, modifications, exports, permission changes, and administrative actions should be logged.",
    "backup_recovery": "Regular backups and recovery procedures are required to minimize data loss from accidental deletion, technical failure, or disaster.",
    "secure_exports": "Exports must be permission-controlled, scoped to authorized data, and audit-tracked for large or sensitive transfers.",
    "future_security": "Future modules must preserve confidentiality, integrity, availability, accountability, and regulatory alignment."
  }'::jsonb,
  'active'
) on conflict (framework_key) do update set
  title = excluded.title,
  assurance_statement = excluded.assurance_statement,
  controls = excluded.controls,
  status = excluded.status,
  updated_at = now();
