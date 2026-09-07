-- Failed or interrupted provider order creation must never permanently block checkout retry.
update public.ai_education_premium_subscriptions
set order_creation_started = null
where status = 'pending_payment'
  and provider_order_id is null
  and order_creation_started is not null;
