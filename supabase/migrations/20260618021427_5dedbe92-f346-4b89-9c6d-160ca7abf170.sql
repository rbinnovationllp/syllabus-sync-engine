
CREATE TABLE public.curriculum_edit_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  grade text NOT NULL,
  subject text NOT NULL,
  teacher_id uuid NOT NULL,
  base_version_id uuid REFERENCES public.curriculum_versions(id) ON DELETE SET NULL,
  title text,
  diff_summary text,
  proposed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','under_ai_review','approved_excellent','flagged_low_quality','teacher_acknowledged','finalized','rejected')),
  ai_score numeric(3,2),
  ai_verdict text CHECK (ai_verdict IN ('excellent','acceptable','low_quality') OR ai_verdict IS NULL),
  ai_fault_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_report text,
  ai_reviewed_at timestamptz,
  teacher_ack_at timestamptz,
  teacher_ack_text text,
  rejection_reason text,
  rejected_by uuid,
  rejected_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_edit_proposals TO authenticated;
GRANT ALL ON public.curriculum_edit_proposals TO service_role;

CREATE UNIQUE INDEX curriculum_edit_proposals_one_open
  ON public.curriculum_edit_proposals (teacher_id, year_id, grade, subject)
  WHERE status IN ('draft','under_ai_review','flagged_low_quality');

CREATE INDEX curriculum_edit_proposals_org_status
  ON public.curriculum_edit_proposals (org_id, status, created_at DESC);
CREATE INDEX curriculum_edit_proposals_teacher
  ON public.curriculum_edit_proposals (teacher_id, created_at DESC);

ALTER TABLE public.curriculum_edit_proposals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_assigned_teacher(
  _user_id uuid, _year_id uuid, _grade text, _subject text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_assignments
    WHERE teacher_user_id = _user_id
      AND academic_year_id = _year_id
      AND grade = _grade
      AND subject = _subject
  );
$$;

CREATE POLICY "Teacher reads own proposals"
  ON public.curriculum_edit_proposals
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teacher creates own proposals"
  ON public.curriculum_edit_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND public.is_assigned_teacher(auth.uid(), year_id, grade, subject)
  );

CREATE POLICY "Teacher updates own proposals"
  ON public.curriculum_edit_proposals
  FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Org members read org proposals"
  ON public.curriculum_edit_proposals
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Super admin reads all proposals"
  ON public.curriculum_edit_proposals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin updates proposals"
  ON public.curriculum_edit_proposals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER curriculum_edit_proposals_touch
  BEFORE UPDATE ON public.curriculum_edit_proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.log_proposal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid := auth.uid();
  _email text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT email INTO _email FROM public.profiles WHERE id = _actor;
    INSERT INTO public.admin_audit_log
      (actor_id, actor_email, action, target_type, target_id, details)
    VALUES (
      _actor, _email,
      'proposal_status_change',
      'curriculum_edit_proposals',
      NEW.id::text,
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'ai_score', NEW.ai_score,
        'ai_verdict', NEW.ai_verdict,
        'grade', NEW.grade,
        'subject', NEW.subject
      )
    );
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER curriculum_edit_proposals_audit
  AFTER UPDATE ON public.curriculum_edit_proposals
  FOR EACH ROW EXECUTE FUNCTION public.log_proposal_status_change();
