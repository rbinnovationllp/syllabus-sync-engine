-- One-time, organisation-level 72-hour AI Education Premium trial.
create table if not exists public.ai_education_premium_trials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  package_code text not null references public.ai_education_premium_package_catalog(code),
  selected_grades text[] not null check (cardinality(selected_grades) between 1 and 12),
  intended_billing_interval text not null check (intended_billing_interval in ('monthly','annual')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '72 hours'),
  status text not null default 'active' check(status in ('active','expired','converted')),
  activated_by uuid references auth.users(id) on delete set null,
  converted_subscription_id uuid references public.ai_education_premium_subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at = starts_at + interval '72 hours')
);
alter table public.ai_education_premium_trials enable row level security;
create policy "Org members read Premium trials" on public.ai_education_premium_trials for select to authenticated using (public.is_org_member(org_id));

create or replace function public.premium_start_trial(p_org uuid, p_code text, p_interval text) returns public.ai_education_premium_trials
language plpgsql security definer set search_path=public as $$
declare c public.ai_education_premium_package_catalog; t public.ai_education_premium_trials;
begin
 if not exists(select 1 from public.org_members where org_id=p_org and user_id=auth.uid() and role::text in ('admin','super_admin','owner')) then raise exception 'PREMIUM_ADMIN_REQUIRED'; end if;
 if p_interval not in ('monthly','annual') then raise exception 'PREMIUM_INTERVAL_INVALID'; end if;
 select * into c from public.ai_education_premium_package_catalog where code=p_code and active and (effective_from is null or effective_from<=now()) and (effective_to is null or effective_to>now());
 if not found then raise exception 'PREMIUM_PACKAGE_UNAVAILABLE'; end if;
 if exists(select 1 from public.ai_education_premium_trials where org_id=p_org) then raise exception 'PREMIUM_TRIAL_ALREADY_USED'; end if;
 insert into public.ai_education_premium_trials(org_id,package_code,selected_grades,intended_billing_interval,activated_by)
 values(p_org,c.code,c.grades,p_interval,auth.uid()) returning * into t;
 return t;
end; $$;
revoke all on function public.premium_start_trial(uuid,text,text) from public,anon;
grant execute on function public.premium_start_trial(uuid,text,text) to authenticated;

create or replace function public.premium_has_class(p_org uuid, p_grade text, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.org_members m where m.org_id=p_org and m.user_id=p_user and (m.role::text in ('admin','super_admin','owner') or exists(select 1 from public.ai_education_premium_teacher_assignments a where a.org_id=p_org and a.user_id=p_user and a.grade=p_grade and a.active)))
 and (exists(select 1 from public.ai_education_premium_entitlements e join public.ai_education_premium_subscriptions s on s.id=e.subscription_id and s.org_id=e.org_id where e.org_id=p_org and e.grade=p_grade and e.status='active' and s.status in ('active','cancelled') and e.starts_at<=now() and e.ends_at>now() and s.starts_at<=now() and s.renews_at>now())
 or exists(select 1 from public.ai_education_premium_trials t where t.org_id=p_org and t.status='active' and t.starts_at<=now() and t.ends_at>now() and p_grade=any(t.selected_grades)));
$$;

grant select, insert, update on public.ai_education_premium_trials to service_role;
