-- Plan entitlement helpers. Safe to run after 20260626000300_crm_expansion.sql.

create or replace function public.current_org_plan_code(_org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select osp.plan_code
  from public.organization_subscription_profiles osp
  where osp.org_id = _org_id
    and osp.status in ('active','trialing','manual','paid')
    and (osp.ends_at is null or osp.ends_at > now())
  limit 1
$$;

revoke execute on function public.current_org_plan_code(uuid) from public, anon;
grant execute on function public.current_org_plan_code(uuid) to authenticated, service_role;

create or replace function public.org_has_feature(_org_id uuid, _feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((spc.feature_flags ->> _feature)::boolean, false)
  from public.organization_subscription_profiles osp
  join public.subscription_plan_catalog spc on spc.plan_code = osp.plan_code
  where osp.org_id = _org_id
    and osp.status in ('active','trialing','manual','paid')
    and (osp.ends_at is null or osp.ends_at > now())
  limit 1
$$;

revoke execute on function public.org_has_feature(uuid, text) from public, anon;
grant execute on function public.org_has_feature(uuid, text) to authenticated, service_role;
