-- Automatic storage add-on allocation and CRM reporting.
-- Payment webhooks activate storage packs, record allocation events, and surface failures.

alter table public.organization_storage_addons
  add column if not exists razorpay_subscription_id text;

alter table public.organization_storage_addons
  add column if not exists razorpay_payment_id text;

alter table public.organization_storage_addons
  add column if not exists payment_reference text;

alter table public.organization_storage_addons
  add column if not exists transaction_amount_minor integer;

alter table public.organization_storage_addons
  add column if not exists currency text;

alter table public.organization_storage_addons
  add column if not exists allocation_status text not null default 'allocated';

alter table public.organization_storage_addons
  add column if not exists allocated_at timestamptz;

alter table public.organization_storage_addons
  add column if not exists previous_storage_gb integer;

alter table public.organization_storage_addons
  add column if not exists new_storage_gb integer;

alter table public.organization_storage_addons
  add column if not exists allocation_error text;

create unique index if not exists organization_storage_addons_razorpay_subscription_idx
  on public.organization_storage_addons(razorpay_subscription_id)
  where razorpay_subscription_id is not null;

create table if not exists public.organization_storage_allocation_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  school_name text,
  provider text not null default 'stripe',
  storage_provider text not null default 'aws_s3',
  plan_code text,
  existing_storage_gb integer,
  storage_purchased_gb integer not null default 0,
  new_storage_gb integer,
  transaction_amount_minor integer,
  currency text,
  payment_status text not null default 'pending',
  payment_reference text,
  provider_subscription_id text,
  provider_payment_id text,
  system_action_status text not null default 'pending',
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_storage_allocation_events_org_created_idx
  on public.organization_storage_allocation_events(org_id, created_at desc);

create index if not exists organization_storage_allocation_events_status_created_idx
  on public.organization_storage_allocation_events(system_action_status, created_at desc);

create index if not exists organization_storage_allocation_events_reference_idx
  on public.organization_storage_allocation_events(provider, payment_reference);

alter table public.organization_storage_allocation_events enable row level security;

drop policy if exists "Super admins view storage allocation events" on public.organization_storage_allocation_events;
create policy "Super admins view storage allocation events"
on public.organization_storage_allocation_events
for select
to authenticated
using (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Service role manages storage allocation events" on public.organization_storage_allocation_events;
create policy "Service role manages storage allocation events"
on public.organization_storage_allocation_events
for all
to service_role
using (true)
with check (true);
