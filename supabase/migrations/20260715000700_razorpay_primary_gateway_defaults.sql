-- Razorpay is the primary payment gateway for Indian operations.
-- Stripe remains available as a future international provider, but new rows should
-- default to Razorpay when no provider is explicitly supplied.

alter table if exists public.subscriptions
  alter column provider set default 'razorpay';

alter table if exists public.organization_storage_addons
  alter column provider set default 'razorpay';

alter table if exists public.organization_storage_allocation_events
  alter column provider set default 'razorpay';

comment on column public.subscriptions.provider is
  'Payment gateway provider. India defaults to razorpay; stripe is reserved for future international markets when activated.';

comment on column public.organization_storage_addons.provider is
  'Payment gateway provider for storage add-ons. India defaults to razorpay; other providers may be added later.';

comment on column public.organization_storage_allocation_events.provider is
  'Payment gateway provider that generated the storage allocation event. India defaults to razorpay.';
