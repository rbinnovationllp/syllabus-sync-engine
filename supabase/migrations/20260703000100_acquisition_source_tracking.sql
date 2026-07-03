-- Lead source tracking, partner referral attribution, and revenue attribution.

create table if not exists public.acquisition_attributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  org_id uuid references public.organizations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  crm_lead_id uuid references public.crm_leads(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  acquisition_source text not null,
  acquisition_detail text,
  partner_name text,
  partner_referral_code text,
  partner_id uuid,
  other_source text,
  attribution_label text not null default 'Direct Company Acquisition',
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads
  add column if not exists acquisition_source text,
  add column if not exists acquisition_detail text,
  add column if not exists partner_name text,
  add column if not exists partner_referral_code text,
  add column if not exists partner_id uuid,
  add column if not exists other_source text,
  add column if not exists attribution_label text not null default 'Direct Company Acquisition';

alter table public.crm_leads
  add column if not exists acquisition_source text,
  add column if not exists acquisition_detail text,
  add column if not exists partner_name text,
  add column if not exists partner_referral_code text,
  add column if not exists partner_id uuid,
  add column if not exists other_source text,
  add column if not exists attribution_label text not null default 'Direct Company Acquisition';

alter table public.profiles
  add column if not exists acquisition_source text,
  add column if not exists acquisition_detail text,
  add column if not exists partner_name text,
  add column if not exists partner_referral_code text,
  add column if not exists partner_id uuid,
  add column if not exists other_source text,
  add column if not exists attribution_label text not null default 'Direct Company Acquisition';

alter table public.schools
  add column if not exists acquisition_source text,
  add column if not exists acquisition_detail text,
  add column if not exists partner_name text,
  add column if not exists partner_referral_code text,
  add column if not exists partner_id uuid,
  add column if not exists other_source text,
  add column if not exists attribution_label text not null default 'Direct Company Acquisition',
  add column if not exists acquisition_locked_at timestamptz;

alter table public.subscriptions
  add column if not exists acquisition_source text,
  add column if not exists acquisition_detail text,
  add column if not exists partner_name text,
  add column if not exists partner_referral_code text,
  add column if not exists partner_id uuid,
  add column if not exists other_source text,
  add column if not exists attribution_label text not null default 'Direct Company Acquisition',
  add column if not exists acquisition_locked_at timestamptz;

create index if not exists idx_leads_acquisition_source on public.leads(acquisition_source);
create index if not exists idx_crm_leads_acquisition_source on public.crm_leads(acquisition_source);
create index if not exists idx_schools_acquisition_source on public.schools(acquisition_source);
create index if not exists idx_subscriptions_acquisition_source on public.subscriptions(acquisition_source);
create index if not exists idx_acquisition_attributions_source on public.acquisition_attributions(acquisition_source);
create index if not exists idx_acquisition_attributions_partner_code on public.acquisition_attributions(partner_referral_code);

alter table public.acquisition_attributions enable row level security;

drop policy if exists "Super admins manage acquisition attributions" on public.acquisition_attributions;
create policy "Super admins manage acquisition attributions"
on public.acquisition_attributions
for all
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = auth.uid() and ur.role::text = 'super_admin'
))
with check (exists (
  select 1 from public.user_roles ur
  where ur.user_id = auth.uid() and ur.role::text = 'super_admin'
));

grant select, insert, update, delete on public.acquisition_attributions to authenticated;
grant all on public.acquisition_attributions to service_role;
