-- AI Future Force premium course module.
-- Plus-plan schools can activate the module and receive monthly content releases.

create table if not exists public.ai_future_force_activations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  activated_by uuid references auth.users(id) on delete set null,
  band text not null check (band in ('primary', 'middle', 'higher')),
  grades text[] not null,
  one_time_price_inr int not null,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'paused', 'cancelled')),
  payment_provider text,
  payment_reference text,
  session_start_date date not null,
  session_end_date date not null,
  remaining_teaching_months int not null check (remaining_teaching_months between 1 and 12),
  compression_note text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, band)
);

create table if not exists public.ai_future_force_monthly_releases (
  id uuid primary key default gen_random_uuid(),
  activation_id uuid not null references public.ai_future_force_activations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  release_month date not null,
  unlocks_at timestamptz not null,
  title text not null,
  learning_outcomes text[] not null default '{}',
  project_ideas text[] not null default '{}',
  tools_and_examples text[] not null default '{}',
  content_status text not null default 'planned' check (content_status in ('planned', 'released', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(activation_id, release_month)
);

create or replace function public.ai_future_force_band_price(_band text)
returns int
language sql
immutable
as $$
  select case _band
    when 'primary' then 1000
    when 'middle' then 2000
    when 'higher' then 5000
    else 0
  end;
$$;

create or replace function public.ai_future_force_release_unlock(_release_month date)
returns timestamptz
language sql
immutable
as $$
  select ((_release_month + interval '1 month')::date - 2)::timestamptz;
$$;

alter table public.ai_future_force_activations enable row level security;
alter table public.ai_future_force_monthly_releases enable row level security;

drop policy if exists "Org admins manage AI Future Force activations" on public.ai_future_force_activations;
create policy "Org admins manage AI Future Force activations"
on public.ai_future_force_activations
for all
to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));

drop policy if exists "Org members read AI Future Force activations" on public.ai_future_force_activations;
create policy "Org members read AI Future Force activations"
on public.ai_future_force_activations
for select
to authenticated
using (public.is_org_member(org_id));

drop policy if exists "Org members read unlocked AI Future Force releases" on public.ai_future_force_monthly_releases;
create policy "Org members read unlocked AI Future Force releases"
on public.ai_future_force_monthly_releases
for select
to authenticated
using (
  public.is_org_member(org_id)
  and unlocks_at <= now()
);

drop policy if exists "Org admins manage AI Future Force releases" on public.ai_future_force_monthly_releases;
create policy "Org admins manage AI Future Force releases"
on public.ai_future_force_monthly_releases
for all
to authenticated
using (public.is_org_admin(org_id))
with check (public.is_org_admin(org_id));
