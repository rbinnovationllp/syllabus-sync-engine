
-- 1. annual_calendars
CREATE TABLE public.annual_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_calendars TO authenticated;
GRANT ALL ON public.annual_calendars TO service_role;
ALTER TABLE public.annual_calendars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage annual_calendars" ON public.annual_calendars
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER annual_calendars_touch BEFORE UPDATE ON public.annual_calendars
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. subject_curricula
CREATE TABLE public.subject_curricula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grade text NOT NULL,
  subject text NOT NULL,
  chapters jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year_id, grade, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_curricula TO authenticated;
GRANT ALL ON public.subject_curricula TO service_role;
ALTER TABLE public.subject_curricula ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage subject_curricula" ON public.subject_curricula
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER subject_curricula_touch BEFORE UPDATE ON public.subject_curricula
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. ai_runs
CREATE TABLE public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
  action text NOT NULL,
  credits_spent integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error text,
  lovable_run_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_runs TO authenticated;
GRANT ALL ON public.ai_runs TO service_role;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners view ai_runs" ON public.ai_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owners insert ai_runs" ON public.ai_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX ai_runs_user_created_idx ON public.ai_runs (user_id, created_at DESC);

-- 4. admin_audit_log
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admins view audit log" ON public.admin_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
