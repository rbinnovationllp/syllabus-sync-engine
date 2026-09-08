-- Retire the discontinued AI Future Force data model. No current Premium data is touched.
drop function if exists public.ai_future_force_is_release_downloadable(uuid);
drop function if exists public.ai_future_force_release_unlock(date);
drop function if exists public.ai_future_force_band_price(text);
drop table if exists public.ai_future_force_monthly_releases cascade;
drop table if exists public.ai_future_force_activations cascade;
alter table public.schools drop column if exists ai_future_force_weekly_classes_per_week;
alter table public.schools drop column if exists ai_future_force_scheduling_confirmed_at;
