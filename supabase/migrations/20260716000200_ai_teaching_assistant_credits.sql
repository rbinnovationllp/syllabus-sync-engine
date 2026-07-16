-- AI Teaching Assistant credits, generation records, and reusable activity library.

create table if not exists public.ai_teaching_credit_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  period_month date not null,
  allocated_credits integer not null default 0 check (allocated_credits >= 0),
  used_credits integer not null default 0 check (used_credits >= 0),
  active boolean not null default true,
  allocated_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_teaching_credit_balance_valid check (used_credits <= allocated_credits),
  constraint ai_teaching_credit_allocations_unique unique (org_id, teacher_user_id, period_month)
);

create table if not exists public.ai_teaching_credit_pools (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_month date not null,
  monthly_base_credits integer not null default 100 check (monthly_base_credits >= 0),
  purchased_credits integer not null default 0 check (purchased_credits >= 0),
  allocated_credits integer not null default 0 check (allocated_credits >= 0),
  used_credits integer not null default 0 check (used_credits >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_teaching_credit_pools_unique unique (org_id, period_month),
  constraint ai_teaching_credit_pools_allocated_valid check (allocated_credits <= monthly_base_credits + purchased_credits)
);

create table if not exists public.ai_teaching_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  allocation_id uuid references public.ai_teaching_credit_allocations(id) on delete set null,
  generation_id uuid,
  transaction_type text not null check (transaction_type in ('allocation', 'increase', 'decrease', 'consume', 'refund', 'reuse')),
  credits integer not null,
  balance_after integer,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_teaching_generations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  teacher_user_id uuid not null references auth.users(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  grade text,
  subject text not null,
  chapter text,
  topic text not null,
  sub_topic text,
  learning_objective text,
  request_type text not null check (request_type in (
    'simple_activity',
    'detailed_activity_plan',
    'complete_teaching_toolkit',
    'project_based_learning_plan',
    'multi_day_activity_module',
    'explain_full_topic',
    'explain_selected_portion',
    'activity_support',
    'real_life_examples',
    'teacher_notes',
    'student_question_help',
    'beyond_textbook_explanation',
    'revision_summary'
  )),
  credits_spent integer not null default 0 check (credits_spent >= 0),
  prompt text not null,
  response text not null,
  provider text not null default 'offline_template',
  status text not null default 'generated' check (status in ('generated', 'bookmarked', 'archived')),
  bookmarked boolean not null default false,
  reuse_count integer not null default 0 check (reuse_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_teaching_library_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  generation_id uuid references public.ai_teaching_generations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  grade text,
  subject text not null,
  topic text not null,
  request_type text not null,
  content text not null,
  tags text[] not null default '{}'::text[],
  visibility text not null default 'school' check (visibility in ('private', 'school')),
  reuse_count integer not null default 0 check (reuse_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_teaching_allocations_org_month_idx
  on public.ai_teaching_credit_allocations(org_id, period_month, teacher_user_id);
create index if not exists ai_teaching_pools_org_month_idx
  on public.ai_teaching_credit_pools(org_id, period_month);
create index if not exists ai_teaching_transactions_teacher_idx
  on public.ai_teaching_credit_transactions(org_id, teacher_user_id, created_at desc);
create index if not exists ai_teaching_generations_teacher_idx
  on public.ai_teaching_generations(org_id, teacher_user_id, created_at desc);
create index if not exists ai_teaching_generations_search_idx
  on public.ai_teaching_generations(org_id, subject, grade, topic);
create index if not exists ai_teaching_library_search_idx
  on public.ai_teaching_library_items(org_id, subject, grade, topic);

grant select, insert, update on public.ai_teaching_credit_allocations to authenticated;
grant select, insert, update on public.ai_teaching_credit_pools to authenticated;
grant select, insert on public.ai_teaching_credit_transactions to authenticated;
grant select, insert, update on public.ai_teaching_generations to authenticated;
grant select, insert, update on public.ai_teaching_library_items to authenticated;
grant all on public.ai_teaching_credit_allocations to service_role;
grant all on public.ai_teaching_credit_pools to service_role;
grant all on public.ai_teaching_credit_transactions to service_role;
grant all on public.ai_teaching_generations to service_role;
grant all on public.ai_teaching_library_items to service_role;

alter table public.ai_teaching_credit_allocations enable row level security;
alter table public.ai_teaching_credit_pools enable row level security;
alter table public.ai_teaching_credit_transactions enable row level security;
alter table public.ai_teaching_generations enable row level security;
alter table public.ai_teaching_library_items enable row level security;

drop policy if exists "Org admins manage teaching credit allocations" on public.ai_teaching_credit_allocations;
create policy "Org admins manage teaching credit allocations"
on public.ai_teaching_credit_allocations for all to authenticated
using (
  exists (
    select 1 from public.org_members om
    where om.org_id = ai_teaching_credit_allocations.org_id
      and om.user_id = auth.uid()
      and om.role::text in ('owner', 'admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.org_members om
    where om.org_id = ai_teaching_credit_allocations.org_id
      and om.user_id = auth.uid()
      and om.role::text in ('owner', 'admin', 'super_admin')
  )
);

drop policy if exists "Teachers read own teaching credit allocations" on public.ai_teaching_credit_allocations;
create policy "Teachers read own teaching credit allocations"
on public.ai_teaching_credit_allocations for select to authenticated
using (teacher_user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Org members read teaching credit transactions" on public.ai_teaching_credit_transactions;
create policy "Org members read teaching credit transactions"
on public.ai_teaching_credit_transactions for select to authenticated
using (
  teacher_user_id = auth.uid()
  or public.has_role(auth.uid(), 'super_admin')
  or exists (
    select 1 from public.org_members om
    where om.org_id = ai_teaching_credit_transactions.org_id
      and om.user_id = auth.uid()
      and om.role::text in ('owner', 'admin', 'super_admin')
  )
);

drop policy if exists "Org members read teaching generations" on public.ai_teaching_generations;
create policy "Org members read teaching generations"
on public.ai_teaching_generations for select to authenticated
using (public.is_org_member(org_id) or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Teachers update own teaching generations" on public.ai_teaching_generations;
create policy "Teachers update own teaching generations"
on public.ai_teaching_generations for update to authenticated
using (teacher_user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'))
with check (teacher_user_id = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Org members read teaching library" on public.ai_teaching_library_items;
create policy "Org members read teaching library"
on public.ai_teaching_library_items for select to authenticated
using (
  visibility = 'school' and public.is_org_member(org_id)
  or created_by = auth.uid()
  or public.has_role(auth.uid(), 'super_admin')
);

drop policy if exists "Org members manage own teaching library items" on public.ai_teaching_library_items;
create policy "Org members manage own teaching library items"
on public.ai_teaching_library_items for update to authenticated
using (created_by = auth.uid() or public.has_role(auth.uid(), 'super_admin'))
with check (created_by = auth.uid() or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Service role manages teaching assistant allocations" on public.ai_teaching_credit_allocations;
create policy "Service role manages teaching assistant allocations"
on public.ai_teaching_credit_allocations for all to service_role using (true) with check (true);

drop policy if exists "Service role manages teaching assistant pools" on public.ai_teaching_credit_pools;
create policy "Service role manages teaching assistant pools"
on public.ai_teaching_credit_pools for all to service_role using (true) with check (true);

drop policy if exists "Service role manages teaching assistant transactions" on public.ai_teaching_credit_transactions;
create policy "Service role manages teaching assistant transactions"
on public.ai_teaching_credit_transactions for all to service_role using (true) with check (true);

drop policy if exists "Service role manages teaching assistant generations" on public.ai_teaching_generations;
create policy "Service role manages teaching assistant generations"
on public.ai_teaching_generations for all to service_role using (true) with check (true);

drop policy if exists "Service role manages teaching assistant library" on public.ai_teaching_library_items;
create policy "Service role manages teaching assistant library"
on public.ai_teaching_library_items for all to service_role using (true) with check (true);

drop trigger if exists trg_ai_teaching_allocations_touch on public.ai_teaching_credit_allocations;
create trigger trg_ai_teaching_allocations_touch before update on public.ai_teaching_credit_allocations
for each row execute function public.touch_updated_at();

drop trigger if exists trg_ai_teaching_pools_touch on public.ai_teaching_credit_pools;
create trigger trg_ai_teaching_pools_touch before update on public.ai_teaching_credit_pools
for each row execute function public.touch_updated_at();

drop trigger if exists trg_ai_teaching_generations_touch on public.ai_teaching_generations;
create trigger trg_ai_teaching_generations_touch before update on public.ai_teaching_generations
for each row execute function public.touch_updated_at();

drop trigger if exists trg_ai_teaching_library_touch on public.ai_teaching_library_items;
create trigger trg_ai_teaching_library_touch before update on public.ai_teaching_library_items
for each row execute function public.touch_updated_at();
drop policy if exists "Org admins manage teaching credit pools" on public.ai_teaching_credit_pools;
create policy "Org admins manage teaching credit pools"
on public.ai_teaching_credit_pools for all to authenticated
using (
  exists (
    select 1 from public.org_members om
    where om.org_id = ai_teaching_credit_pools.org_id
      and om.user_id = auth.uid()
      and om.role::text in ('owner', 'admin', 'super_admin')
  )
  or public.has_role(auth.uid(), 'super_admin')
)
with check (
  exists (
    select 1 from public.org_members om
    where om.org_id = ai_teaching_credit_pools.org_id
      and om.user_id = auth.uid()
      and om.role::text in ('owner', 'admin', 'super_admin')
  )
  or public.has_role(auth.uid(), 'super_admin')
);

drop policy if exists "Org members read teaching credit pools" on public.ai_teaching_credit_pools;
create policy "Org members read teaching credit pools"
on public.ai_teaching_credit_pools for select to authenticated
using (public.is_org_member(org_id) or public.has_role(auth.uid(), 'super_admin'));
