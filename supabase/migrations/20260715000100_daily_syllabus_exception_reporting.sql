-- Daily syllabus progress monitoring and exception reporting support.
-- Expands progress statuses used by the application and keeps older records valid.

alter table public.teaching_progress_logs
drop constraint if exists teaching_progress_logs_status_check;

alter table public.teaching_progress_logs
add constraint teaching_progress_logs_status_check
check (
  status in (
    'not_started',
    'in_progress',
    'completed',
    'partially_completed',
    'rescheduled',
    'not_covered'
  )
);

create index if not exists teaching_progress_exception_idx
  on public.teaching_progress_logs(org_id, academic_year_id, status, planned_date, actual_date)
  where deleted_at is null;
