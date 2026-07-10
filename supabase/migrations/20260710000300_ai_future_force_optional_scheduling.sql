-- AI Future Force optional selection, weekly scheduling, and curriculum preview metadata.

alter table public.schools
  add column if not exists ai_future_force_weekly_classes_per_week int
    check (ai_future_force_weekly_classes_per_week in (1, 2)),
  add column if not exists ai_future_force_scheduling_confirmed_at timestamptz;

alter table public.ai_future_force_activations
  add column if not exists wants_ai_future_force boolean not null default false,
  add column if not exists weekly_classes_per_week int not null default 1,
  add column if not exists expected_sessions int not null default 0,
  add column if not exists curriculum_preview jsonb not null default '{}'::jsonb,
  add column if not exists schedule_summary text;

alter table public.ai_future_force_activations
  drop constraint if exists ai_future_force_activations_weekly_classes_check;

alter table public.ai_future_force_activations
  add constraint ai_future_force_activations_weekly_classes_check
  check (weekly_classes_per_week in (1, 2));
