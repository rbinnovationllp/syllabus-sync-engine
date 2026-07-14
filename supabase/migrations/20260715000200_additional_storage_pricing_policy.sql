-- Additional storage subscription policy.
-- Paid storage add-ons increase the organization's effective storage quota.

alter table public.organization_subscription_profiles
  add column if not exists extra_storage_gb integer not null default 0;

alter table public.organization_subscription_profiles
  add constraint organization_subscription_profiles_extra_storage_gb_nonnegative
  check (extra_storage_gb >= 0);

create table if not exists public.organization_storage_addons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'stripe',
  stripe_subscription_id text,
  stripe_price_id text,
  storage_gb integer not null check (storage_gb > 0),
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_storage_addons_stripe_subscription_idx
  on public.organization_storage_addons(stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists organization_storage_addons_org_status_idx
  on public.organization_storage_addons(org_id, status, current_period_end);

alter table public.organization_storage_addons enable row level security;

drop policy if exists "Org members read storage add-ons" on public.organization_storage_addons;
create policy "Org members read storage add-ons"
on public.organization_storage_addons
for select
to authenticated
using (public.is_org_member(org_id));

drop policy if exists "Service role manages storage add-ons" on public.organization_storage_addons;
create policy "Service role manages storage add-ons"
on public.organization_storage_addons
for all
to service_role
using (true)
with check (true);
