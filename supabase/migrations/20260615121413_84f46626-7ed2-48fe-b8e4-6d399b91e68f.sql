
-- grade_subjects: classify each row + capture weekday cadence
ALTER TABLE public.grade_subjects
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'core',
  ADD COLUMN IF NOT EXISTS weekdays integer[] NOT NULL DEFAULT '{1,2,3,4,5}'::integer[];

ALTER TABLE public.grade_subjects
  DROP CONSTRAINT IF EXISTS grade_subjects_kind_check;
ALTER TABLE public.grade_subjects
  ADD CONSTRAINT grade_subjects_kind_check
  CHECK (kind IN ('core','co_curricular'));

-- academic_years: school day timings + senior extra-class windows
ALTER TABLE public.academic_years
  ADD COLUMN IF NOT EXISTS school_start_time time,
  ADD COLUMN IF NOT EXISTS school_end_time time,
  ADD COLUMN IF NOT EXISTS lunch_start_time time,
  ADD COLUMN IF NOT EXISTS lunch_end_time time,
  ADD COLUMN IF NOT EXISTS senior_extra_classes jsonb NOT NULL DEFAULT '{}'::jsonb;
