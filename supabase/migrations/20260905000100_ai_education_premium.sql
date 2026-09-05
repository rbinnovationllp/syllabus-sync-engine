-- Independent AI Education Premium product. This does not alter regular plans
-- or historical AI Future Force records.
create table if not exists public.ai_education_premium_class_catalog (
  grade text primary key check (grade in ('1','2','3','4','5','6','7','8','9','10','11','12')),
  monthly_price_inr integer not null check (monthly_price_inr >= 0),
  annual_price_inr integer not null check (annual_price_inr >= 0),
  currency text not null default 'inr',
  active boolean not null default true,
  bundle_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

insert into public.ai_education_premium_class_catalog (grade, monthly_price_inr, annual_price_inr) values
 ('1',5000,50000),('2',5000,50000),('3',6000,60000),('4',6000,60000),('5',6000,60000),
 ('6',8000,80000),('7',8000,80000),('8',8000,80000),('9',10000,100000),('10',10000,100000),
 ('11',15000,150000),('12',15000,150000)
on conflict (grade) do update set monthly_price_inr=excluded.monthly_price_inr, annual_price_inr=excluded.annual_price_inr, updated_at=now();

create table if not exists public.ai_education_premium_subscriptions (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 billing_interval text not null check (billing_interval in ('monthly','annual')),
 currency text not null default 'inr', base_amount_minor integer not null check (base_amount_minor >= 0),
 discount_amount_minor integer not null default 0 check (discount_amount_minor >= 0),
 final_amount_minor integer not null check (final_amount_minor >= 0),
 status text not null default 'pending_payment' check (status in ('pending_payment','active','past_due','paused','cancelled','expired')),
 provider text, provider_subscription_id text unique, provider_plan_reference text, starts_at timestamptz, renews_at timestamptz, cancelled_at timestamptz,
 metadata jsonb not null default '{}'::jsonb, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.ai_education_premium_entitlements (
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.ai_education_premium_subscriptions(id) on delete cascade,
 org_id uuid not null references public.organizations(id) on delete cascade, grade text not null check (grade in ('1','2','3','4','5','6','7','8','9','10','11','12')),
 status text not null default 'pending' check (status in ('pending','active','revoked','expired')), starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now(), unique(subscription_id, grade)
);
create table if not exists public.ai_education_premium_teacher_assignments (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, grade text not null check (grade in ('1','2','3','4','5','6','7','8','9','10','11','12')),
 assigned_by uuid references auth.users(id) on delete set null, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(org_id,user_id,grade)
);
alter table public.ai_education_premium_class_catalog enable row level security;
alter table public.ai_education_premium_subscriptions enable row level security;
alter table public.ai_education_premium_entitlements enable row level security;
alter table public.ai_education_premium_teacher_assignments enable row level security;
create policy "Authenticated read AI Education Premium catalog" on public.ai_education_premium_class_catalog for select to authenticated using (true);
create policy "Super admins manage AI Education Premium catalog" on public.ai_education_premium_class_catalog for all to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
create policy "Org members read AI Education Premium subscriptions" on public.ai_education_premium_subscriptions for select to authenticated using (public.is_org_member(org_id));
create policy "Org members read AI Education Premium entitlements" on public.ai_education_premium_entitlements for select to authenticated using (public.is_org_member(org_id));
create policy "Org admins manage AI Education Premium teachers" on public.ai_education_premium_teacher_assignments for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy "Teachers read own AI Education Premium assignments" on public.ai_education_premium_teacher_assignments for select to authenticated using (user_id = auth.uid());
create index if not exists ai_education_premium_entitlements_org_grade_idx on public.ai_education_premium_entitlements(org_id,grade) where status='active';
