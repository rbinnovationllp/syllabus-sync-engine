
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grade text NOT NULL,
  section text,
  subject text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year_id, teacher_user_id, grade, section, subject)
);

CREATE INDEX IF NOT EXISTS idx_teacher_assign_org ON public.teacher_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assign_teacher ON public.teacher_assignments(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assign_year ON public.teacher_assignments(academic_year_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_assignments TO authenticated;
GRANT ALL ON public.teacher_assignments TO service_role;

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read teacher_assignments"
  ON public.teacher_assignments FOR SELECT TO authenticated
  USING (private.is_org_member(org_id));

CREATE POLICY "Org admins insert teacher_assignments"
  ON public.teacher_assignments FOR INSERT TO authenticated
  WITH CHECK (private.is_org_admin(org_id));

CREATE POLICY "Org admins update teacher_assignments"
  ON public.teacher_assignments FOR UPDATE TO authenticated
  USING (private.is_org_admin(org_id))
  WITH CHECK (private.is_org_admin(org_id));

CREATE POLICY "Org admins delete teacher_assignments"
  ON public.teacher_assignments FOR DELETE TO authenticated
  USING (private.is_org_admin(org_id));

CREATE TRIGGER touch_teacher_assignments_updated_at
  BEFORE UPDATE ON public.teacher_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
