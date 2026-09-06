create table if not exists public.ai_education_premium_teaching_plans (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 grade text not null check (grade in ('1','2','3','4','5','6','7','8','9','10','11','12')), academic_year text not null, term text, week_no integer check (week_no is null or week_no between 1 and 60),
 topic text not null, learning_objective text, previous_learning text, session_type text not null default 'lesson' check (session_type in ('lesson','annual')),
 context_hash text not null, output jsonb not null, skill_version text not null, model text not null, usage jsonb not null default '{}'::jsonb,
 generated_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(org_id, context_hash)
);
create index if not exists ai_education_premium_plans_org_grade_idx on public.ai_education_premium_teaching_plans(org_id,grade,created_at desc);
alter table public.ai_education_premium_teaching_plans enable row level security;
create policy "Org members read AI Education Premium plans" on public.ai_education_premium_teaching_plans for select to authenticated using (public.is_org_member(org_id));
