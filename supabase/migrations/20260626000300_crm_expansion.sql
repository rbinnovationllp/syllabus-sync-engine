-- CRM expansion: company operations + school CRM

create table if not exists public.subscription_plan_catalog (
  plan_code text primary key,
  plan_name text not null,
  school_level text not null,
  variant text not null check (variant in ('single','base','plus','enterprise')),
  monthly_usd numeric not null default 0,
  monthly_inr numeric not null default 0,
  monthly_credits int not null default 0,
  user_limit int not null default 1,
  storage_gb int not null default 1,
  feature_flags jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plan_catalog
  (plan_code, plan_name, school_level, variant, monthly_usd, monthly_inr, monthly_credits, user_limit, storage_gb, feature_flags)
values
  ('RET-SINGLE', 'Retail Single Access', 'retail', 'single', 9, 499, 250, 1, 1, '{"v2_ai":false,"school_crm":false}'::jsonb),
  ('PRI-BASE', 'Primary Bundle', 'primary', 'base', 29, 2999, 2000, 5, 10, '{"v2_ai":false,"school_crm":true}'::jsonb),
  ('PRI-PLUS', 'Primary Plus Bundle', 'primary', 'plus', 39, 4000, 3500, 8, 15, '{"v2_ai":true,"school_crm":true,"parent_hub":true}'::jsonb),
  ('MID-BASE', 'Middle School Bundle', 'middle', 'base', 49, 4999, 4000, 10, 25, '{"v2_ai":false,"school_crm":true}'::jsonb),
  ('MID-PLUS', 'Middle School Plus Bundle', 'middle', 'plus', 59, 6000, 6500, 14, 30, '{"v2_ai":true,"school_crm":true,"parent_hub":true}'::jsonb),
  ('HIGH-BASE', 'High School Bundle', 'high', 'base', 69, 7000, 6500, 20, 50, '{"v2_ai":false,"school_crm":true}'::jsonb),
  ('HIGH-PLUS', 'High School Plus Bundle', 'high', 'plus', 89, 9000, 10000, 25, 75, '{"v2_ai":true,"school_crm":true,"parent_hub":true,"assessment_ai":true}'::jsonb),
  ('ENT-BASE', 'Enterprise Bundle', 'enterprise', 'enterprise', 179, 18000, 25000, 60, 200, '{"v2_ai":true,"school_crm":true,"multi_campus":true}'::jsonb),
  ('ENT-PLUS', 'Enterprise Plus Bundle', 'enterprise', 'plus', 249, 25000, 40000, 100, 350, '{"v2_ai":true,"school_crm":true,"multi_campus":true,"priority_support":true}'::jsonb)
on conflict (plan_code) do update set
  plan_name = excluded.plan_name,
  school_level = excluded.school_level,
  variant = excluded.variant,
  monthly_usd = excluded.monthly_usd,
  monthly_inr = excluded.monthly_inr,
  monthly_credits = excluded.monthly_credits,
  user_limit = excluded.user_limit,
  storage_gb = excluded.storage_gb,
  feature_flags = excluded.feature_flags,
  active = excluded.active,
  updated_at = now();

grant select on public.subscription_plan_catalog to authenticated;
grant all on public.subscription_plan_catalog to service_role;

create table if not exists public.organization_subscription_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_code text not null references public.subscription_plan_catalog(plan_code),
  status text not null default 'manual',
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','annual','manual')),
  source text not null default 'manual',
  seats_purchased int not null default 1,
  storage_mode text not null default 'school_owned' check (storage_mode in ('company_owned','school_owned','hybrid')),
  notes text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id)
);

grant select, insert, update, delete on public.organization_subscription_profiles to authenticated;
grant all on public.organization_subscription_profiles to service_role;
alter table public.organization_subscription_profiles enable row level security;
drop policy if exists "org members read subscription profile" on public.organization_subscription_profiles;
create policy "org members read subscription profile" on public.organization_subscription_profiles
  for select to authenticated
  using (public.is_org_member(org_id) or public.has_role(auth.uid(),'super_admin'));
drop policy if exists "super admins manage subscription profiles" on public.organization_subscription_profiles;
create policy "super admins manage subscription profiles" on public.organization_subscription_profiles
  for all to authenticated
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

create table if not exists public.company_crm_support_tickets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.crm_accounts(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  subject text not null,
  status text not null default 'open' check (status in ('open','waiting','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  category text not null default 'support',
  owner_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.company_crm_support_tickets to authenticated;
grant all on public.company_crm_support_tickets to service_role;
alter table public.company_crm_support_tickets enable row level security;
drop policy if exists "super admins manage company tickets" on public.company_crm_support_tickets;
create policy "super admins manage company tickets" on public.company_crm_support_tickets
  for all to authenticated
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

create table if not exists public.school_crm_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_type text not null default 'parent' check (contact_type in ('parent','admission','vendor','alumni','other')),
  full_name text not null,
  relationship text,
  student_name text,
  grade text,
  section text,
  phone text,
  email text,
  tags text[] not null default '{}',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_crm_enquiries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  guardian_name text not null,
  student_name text,
  grade_interest text,
  phone text,
  email text,
  source text,
  status text not null default 'new' check (status in ('new','contacted','visit_scheduled','application','admitted','lost')),
  next_follow_up_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_crm_interactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.school_crm_contacts(id) on delete cascade,
  enquiry_id uuid references public.school_crm_enquiries(id) on delete cascade,
  interaction_type text not null default 'note' check (interaction_type in ('call','whatsapp','email','meeting','ptm','task','note')),
  subject text not null,
  body text,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_id is not null or enquiry_id is not null)
);

grant select, insert, update, delete on public.school_crm_contacts to authenticated;
grant select, insert, update, delete on public.school_crm_enquiries to authenticated;
grant select, insert, update, delete on public.school_crm_interactions to authenticated;
grant all on public.school_crm_contacts to service_role;
grant all on public.school_crm_enquiries to service_role;
grant all on public.school_crm_interactions to service_role;

alter table public.school_crm_contacts enable row level security;
alter table public.school_crm_enquiries enable row level security;
alter table public.school_crm_interactions enable row level security;

drop policy if exists "org members manage school contacts" on public.school_crm_contacts;
create policy "org members manage school contacts" on public.school_crm_contacts
  for all to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
drop policy if exists "org members manage school enquiries" on public.school_crm_enquiries;
create policy "org members manage school enquiries" on public.school_crm_enquiries
  for all to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
drop policy if exists "org members manage school interactions" on public.school_crm_interactions;
create policy "org members manage school interactions" on public.school_crm_interactions
  for all to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create index if not exists idx_org_subscription_profiles_org on public.organization_subscription_profiles(org_id);
create index if not exists idx_company_tickets_status on public.company_crm_support_tickets(status, priority);
create index if not exists idx_school_crm_contacts_org on public.school_crm_contacts(org_id);
create index if not exists idx_school_crm_enquiries_org_status on public.school_crm_enquiries(org_id, status);
create index if not exists idx_school_crm_interactions_due on public.school_crm_interactions(org_id, due_at) where completed_at is null;

drop trigger if exists trg_org_subscription_profiles_touch on public.organization_subscription_profiles;
create trigger trg_org_subscription_profiles_touch before update on public.organization_subscription_profiles for each row execute function public.touch_updated_at();
drop trigger if exists trg_company_tickets_touch on public.company_crm_support_tickets;
create trigger trg_company_tickets_touch before update on public.company_crm_support_tickets for each row execute function public.touch_updated_at();
drop trigger if exists trg_school_crm_contacts_touch on public.school_crm_contacts;
create trigger trg_school_crm_contacts_touch before update on public.school_crm_contacts for each row execute function public.touch_updated_at();
drop trigger if exists trg_school_crm_enquiries_touch on public.school_crm_enquiries;
create trigger trg_school_crm_enquiries_touch before update on public.school_crm_enquiries for each row execute function public.touch_updated_at();
drop trigger if exists trg_school_crm_interactions_touch on public.school_crm_interactions;
create trigger trg_school_crm_interactions_touch before update on public.school_crm_interactions for each row execute function public.touch_updated_at();
