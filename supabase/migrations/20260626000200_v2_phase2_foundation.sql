create table if not exists public.v2_simulations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  year_id uuid references public.academic_years(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_type text not null,
  inputs jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.v2_parent_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  year_id uuid references public.academic_years(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  communication_type text not null,
  audience text not null,
  language text not null default 'English',
  prompt text not null,
  content text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_v2_simulations_org_year on public.v2_simulations(org_id, year_id, created_at desc);
create index if not exists idx_v2_parent_messages_org_year on public.v2_parent_messages(org_id, year_id, created_at desc);

alter table public.v2_simulations enable row level security;
alter table public.v2_parent_messages enable row level security;

drop policy if exists "v2 simulations org members read" on public.v2_simulations;
create policy "v2 simulations org members read" on public.v2_simulations
for select to authenticated using (public.is_org_member(org_id));

drop policy if exists "v2 simulations org members write" on public.v2_simulations;
create policy "v2 simulations org members write" on public.v2_simulations
for insert to authenticated with check (public.is_org_member(org_id));

drop policy if exists "v2 parent messages org members read" on public.v2_parent_messages;
create policy "v2 parent messages org members read" on public.v2_parent_messages
for select to authenticated using (public.is_org_member(org_id));

drop policy if exists "v2 parent messages org members write" on public.v2_parent_messages;
create policy "v2 parent messages org members write" on public.v2_parent_messages
for insert to authenticated with check (public.is_org_member(org_id));

drop policy if exists "v2 parent messages org members update" on public.v2_parent_messages;
create policy "v2 parent messages org members update" on public.v2_parent_messages
for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

grant select, insert on public.v2_simulations to authenticated;
grant select, insert, update on public.v2_parent_messages to authenticated;
grant all on public.v2_simulations to service_role;
grant all on public.v2_parent_messages to service_role;
