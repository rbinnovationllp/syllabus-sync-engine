-- Replaces new-sale per-class pricing with centrally managed commercial packages.
-- Historical subscriptions and their class entitlements are preserved unchanged.
update public.ai_education_premium_class_catalog set active = false where active = true;

create table if not exists public.ai_education_premium_package_catalog (
  code text primary key,
  label text not null,
  grades text[] not null check (cardinality(grades) between 1 and 12),
  monthly_price_inr integer not null check (monthly_price_inr >= 0),
  annual_price_inr integer not null check (annual_price_inr >= 0),
  currency text not null default 'inr', active boolean not null default true,
  featured boolean not null default false, sort_order integer not null default 0,
  promotional_price jsonb not null default '{}'::jsonb, discount_rules jsonb not null default '{}'::jsonb,
  effective_from timestamptz, effective_to timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.ai_education_premium_package_catalog (code,label,grades,monthly_price_inr,annual_price_inr,featured,sort_order) values
 ('classes_1_2','Classes 1–2',array['1','2'],2000,20000,false,10),
 ('classes_3_5','Classes 3–5',array['3','4','5'],3000,30000,false,20),
 ('classes_6_8','Classes 6–8',array['6','7','8'],4000,40000,false,30),
 ('classes_9_10','Classes 9–10',array['9','10'],5000,50000,false,40),
 ('classes_11_12','Classes 11–12',array['11','12'],6000,60000,false,50),
 ('classes_1_5','Classes 1–5',array['1','2','3','4','5'],5000,50000,false,60),
 ('classes_1_8','Classes 1–8',array['1','2','3','4','5','6','7','8'],7000,70000,false,70),
 ('classes_1_10','Classes 1–10',array['1','2','3','4','5','6','7','8','9','10'],9000,90000,false,80),
 ('classes_1_12','Complete School AI Education · Classes 1–12',array['1','2','3','4','5','6','7','8','9','10','11','12'],12000,120000,true,90)
on conflict (code) do update set label=excluded.label, grades=excluded.grades, monthly_price_inr=excluded.monthly_price_inr, annual_price_inr=excluded.annual_price_inr, featured=excluded.featured, sort_order=excluded.sort_order, active=true, updated_at=now();
alter table public.ai_education_premium_package_catalog enable row level security;
create policy "Authenticated read AI Education Premium packages" on public.ai_education_premium_package_catalog for select to authenticated using (true);
create policy "Super admins manage AI Education Premium packages" on public.ai_education_premium_package_catalog for all to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
