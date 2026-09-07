-- Remove discontinued plan catalogue data. This project has no paid subscriptions to preserve.
begin;
delete from public.organization_subscription_profiles where plan_code in ('PRI-PLUS','MID-PLUS','HIGH-PLUS','ENT-PLUS');
delete from public.subscription_plan_catalog where plan_code in ('PRI-PLUS','MID-PLUS','HIGH-PLUS','ENT-PLUS');
alter table public.subscription_plan_catalog drop constraint if exists subscription_plan_catalog_variant_check;
alter table public.subscription_plan_catalog add constraint subscription_plan_catalog_variant_check check (variant in ('single','base','enterprise'));
commit;
