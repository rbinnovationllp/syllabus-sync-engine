begin;
-- Retire sale catalog entries only; keep foreign keys and historical paid contracts.
update public.subscription_plan_catalog set active=false,updated_at=now() where plan_code in ('PRI-PLUS','MID-PLUS','HIGH-PLUS','ENT-PLUS');
alter table public.subscription_plan_catalog
 add column if not exists plan_id text,
 add column if not exists annual_usd numeric,
 add column if not exists annual_inr numeric,
 add column if not exists gst_inclusive boolean not null default true,
 add column if not exists grade_coverage text[],
 add column if not exists subject_limit integer not null default -1,
 add column if not exists campus_limit integer not null default 1;
update public.subscription_plan_catalog c set plan_id=v.id,monthly_usd=v.usd,monthly_inr=v.inr,annual_usd=v.usd*10,annual_inr=v.inr*10,
 monthly_credits=v.credits,user_limit=v.seats,storage_gb=v.storage,grade_coverage=v.grades,subject_limit=v.subjects,campus_limit=1,gst_inclusive=true,active=true,updated_at=now()
from (values
 ('RET-SINGLE','retail_single_access',9,590,500,1,1,array[]::text[],1),
 ('PRI-BASE','bundle_primary_access',29,3540,2000,6,50,array['Pre-K','K','1','2','3','4','5'],-1),
 ('MID-BASE','bundle_middle_access',49,5900,4000,10,100,array['6','7','8'],-1),
 ('HIGH-BASE','bundle_high_access',69,8260,6500,18,200,array['9','10','11','12'],-1),
 ('ENT-BASE','enterprise_global_access',179,21240,25000,60,400,array['Pre-K','K','1','2','3','4','5','6','7','8','9','10','11','12'],-1)
) v(code,id,usd,inr,credits,seats,storage,grades,subjects) where c.plan_code=v.code;

create function public.prevent_retired_plan_assignment() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from subscription_plan_catalog where plan_code=new.plan_code and not active) then
  if TG_OP='INSERT' then raise exception 'Retired plan cannot be newly assigned'; end if;
  if new.plan_code is distinct from old.plan_code or (new.ends_at is not null and (old.ends_at is null or new.ends_at>old.ends_at)) then raise exception 'Retired plan cannot be upgraded or renewed'; end if;
 end if;
 return new;
end; $$;
create trigger prevent_retired_plan_assignment before insert or update on public.organization_subscription_profiles for each row execute function public.prevent_retired_plan_assignment();
-- Existing subscription tax fields remain historical. Change defaults only for new contracts.
alter table public.subscriptions alter column gst_charged_separately set default false;

create table public.billing_receipts (
 id uuid primary key default gen_random_uuid(), provider text not null, environment text not null,
 provider_payment_id text not null,user_id uuid not null references auth.users(id),price_id text,
 currency text not null,taxable_amount_minor bigint not null,gst_amount_minor bigint not null,total_amount_minor bigint not null,
 gst_inclusive boolean not null default true,created_at timestamptz not null default now(),
 check(total_amount_minor=taxable_amount_minor+gst_amount_minor),check(taxable_amount_minor>=0 and gst_amount_minor>=0),
 unique(provider,environment,provider_payment_id)
);
alter table public.billing_receipts enable row level security;
create policy "Users read their payment receipts" on public.billing_receipts for select to authenticated using(user_id=auth.uid() or public.has_role(auth.uid(),'super_admin'));
grant select on public.billing_receipts to authenticated;
grant all on public.billing_receipts to service_role;
comment on table public.billing_receipts is 'Immutable tax breakdown for verified payments at GST-inclusive 2026-09 pricing. Historical provider transactions are retained separately.';
-- Premium group amounts stay exactly as approved; tax is extracted, never added again.
update public.ai_education_premium_package_catalog set gst_inclusive=true,updated_at=now();
alter table public.ai_education_premium_package_catalog add constraint premium_inr_includes_gst check (lower(currency)<>'inr' or gst_inclusive);
commit;
