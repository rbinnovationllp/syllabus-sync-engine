-- Razorpay support for Indian subscriptions.
-- This keeps the existing subscriptions table but adds Razorpay provider fields.

alter table public.subscriptions
  alter column stripe_subscription_id drop not null,
  alter column stripe_customer_id drop not null,
  alter column product_id drop not null;

alter table public.subscriptions
  add column if not exists provider text not null default 'stripe',
  add column if not exists razorpay_subscription_id text,
  add column if not exists razorpay_plan_id text,
  add column if not exists razorpay_customer_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_short_url text;

create unique index if not exists idx_subscriptions_razorpay_subscription_id
  on public.subscriptions(razorpay_subscription_id)
  where razorpay_subscription_id is not null;

create index if not exists idx_subscriptions_provider_user
  on public.subscriptions(provider, user_id, status);

create or replace function public.has_active_subscription(user_uuid uuid, check_env text default 'live')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and environment = check_env
      and (
        (status in ('active','authenticated','created','trialing','past_due') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())
      )
  );
$$;

revoke execute on function public.has_active_subscription(uuid, text) from public, anon;
grant execute on function public.has_active_subscription(uuid, text) to authenticated, service_role;
