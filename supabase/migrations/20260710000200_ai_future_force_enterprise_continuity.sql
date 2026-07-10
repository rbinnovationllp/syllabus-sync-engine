-- AI Future Force enterprise tier and late-session learning continuity.

alter table public.ai_future_force_activations
  drop constraint if exists ai_future_force_activations_band_check;

alter table public.ai_future_force_activations
  add constraint ai_future_force_activations_band_check
  check (band in ('primary', 'middle', 'higher', 'enterprise'));

alter table public.ai_future_force_activations
  drop constraint if exists ai_future_force_activations_remaining_teaching_months_check;

alter table public.ai_future_force_activations
  add constraint ai_future_force_activations_remaining_teaching_months_check
  check (remaining_teaching_months between 0 and 12);

alter table public.ai_future_force_activations
  add column if not exists access_model text not null default 'one_time_activation',
  add column if not exists foundation_mode boolean not null default false,
  add column if not exists foundation_completed_at timestamptz,
  add column if not exists carry_forward_topics jsonb not null default '[]'::jsonb,
  add column if not exists next_session_roadmap jsonb not null default '{}'::jsonb,
  add column if not exists last_subscription_verified_at timestamptz,
  add column if not exists next_release_blocked_reason text;

alter table public.ai_future_force_activations
  drop constraint if exists ai_future_force_activations_access_model_check;

alter table public.ai_future_force_activations
  add constraint ai_future_force_activations_access_model_check
  check (access_model in ('one_time_activation', 'enterprise_monthly'));

alter table public.ai_future_force_monthly_releases
  add column if not exists download_enabled boolean not null default false,
  add column if not exists generated_at timestamptz not null default now();

create or replace function public.ai_future_force_band_price(_band text)
returns int
language sql
immutable
as $$
  select case _band
    when 'primary' then 1000
    when 'middle' then 2000
    when 'higher' then 5000
    when 'enterprise' then 10000
    else 0
  end;
$$;

create or replace function public.ai_future_force_is_release_downloadable(_release_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ai_future_force_monthly_releases r
    join public.ai_future_force_activations a on a.id = r.activation_id
    where r.id = _release_id
      and a.status = 'active'
      and r.unlocks_at <= now()
      and public.is_org_member(r.org_id)
  );
$$;

drop policy if exists "Org members read unlocked AI Future Force releases" on public.ai_future_force_monthly_releases;
create policy "Org members read unlocked AI Future Force releases"
on public.ai_future_force_monthly_releases
for select
to authenticated
using (
  public.is_org_member(org_id)
  and unlocks_at <= now()
);
