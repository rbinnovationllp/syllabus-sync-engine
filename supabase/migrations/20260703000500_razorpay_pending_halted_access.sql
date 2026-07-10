-- Razorpay retry governance.
-- Active/charged/authenticated subscriptions get access.
-- Pending subscriptions get a short grace period.
-- Halted/cancelled/payment_failed subscriptions do not unlock paid features.

alter table public.subscriptions
  add column if not exists grace_until timestamptz,
  add column if not exists last_payment_failed_at timestamptz,
  add column if not exists last_payment_failure_reason text;

create or replace function public.has_active_subscription(user_uuid uuid, check_env text default 'live')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and (
        (
          status in ('active', 'authenticated', 'charged', 'trialing', 'past_due')
          and (current_period_end is null or current_period_end > now())
        )
        or (
          status = 'pending'
          and coalesce(grace_until, updated_at + interval '7 days') > now()
        )
        or (
          status in ('canceled', 'cancelled')
          and current_period_end > now()
        )
      )
  );
$$;

revoke execute on function public.has_active_subscription(uuid, text) from public, anon;
grant execute on function public.has_active_subscription(uuid, text) to authenticated, service_role;
