-- Checkout locks use database time and an atomic update, never web-server wall-clock time.
create or replace function public.premium_claim_order_creation(p_subscription uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare claimed boolean := false;
begin
  update public.ai_education_premium_subscriptions
  set order_creation_started = now()
  where id = p_subscription
    and status = 'pending_payment'
    and provider_order_id is null
    and (order_creation_started is null or order_creation_started < now() - interval '90 seconds')
  returning true into claimed;
  return coalesce(claimed, false);
end; $$;

create or replace function public.premium_release_order_creation(p_subscription uuid) returns void
language sql security definer set search_path=public as $$
  update public.ai_education_premium_subscriptions
  set order_creation_started = null
  where id = p_subscription and status = 'pending_payment' and provider_order_id is null;
$$;

create or replace function public.premium_reset_order_creation(p_org uuid, p_code text, p_interval text) returns void
language sql security definer set search_path=public as $$
  update public.ai_education_premium_subscriptions
  set order_creation_started = null
  where org_id = p_org
    and status = 'pending_payment'
    and provider_order_id is null
    and billing_interval = p_interval
    and metadata->>'package_code' = p_code;
$$;

revoke all on function public.premium_claim_order_creation(uuid) from public, anon, authenticated;
revoke all on function public.premium_release_order_creation(uuid) from public, anon, authenticated;
revoke all on function public.premium_reset_order_creation(uuid,text,text) from public, anon, authenticated;
grant execute on function public.premium_claim_order_creation(uuid) to service_role;
grant execute on function public.premium_release_order_creation(uuid) to service_role;
grant execute on function public.premium_reset_order_creation(uuid,text,text) to service_role;

-- Policies for the Premium read views call these helpers under the authenticated role.
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- Release any failed or abandoned order preparation lock immediately.
update public.ai_education_premium_subscriptions
set order_creation_started = null
where status = 'pending_payment' and provider_order_id is null;
