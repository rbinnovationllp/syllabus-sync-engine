
CREATE TABLE IF NOT EXISTS public.disruptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  reason text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('weather','closure','illness','exam_shift','event_overrun','election','strike','other')),
  lost_days integer NOT NULL DEFAULT 0 CHECK (lost_days >= 0 AND lost_days <= 365),
  lost_periods integer NOT NULL DEFAULT 0 CHECK (lost_periods >= 0),
  affected_grades text[] NOT NULL DEFAULT '{}',
  affected_sections text[] NOT NULL DEFAULT '{}',
  start_date date,
  end_date date,
  reported_by uuid REFERENCES auth.users(id),
  applied_version_id uuid REFERENCES public.curriculum_versions(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','recalibrated','infeasible','dismissed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disruptions_year ON public.disruptions(year_id);
CREATE INDEX IF NOT EXISTS idx_disruptions_org ON public.disruptions(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disruptions TO authenticated;
GRANT ALL ON public.disruptions TO service_role;

ALTER TABLE public.disruptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read disruptions"
  ON public.disruptions FOR SELECT TO authenticated
  USING (private.is_org_member(org_id));

CREATE POLICY "Org members create disruptions"
  ON public.disruptions FOR INSERT TO authenticated
  WITH CHECK (private.is_org_member(org_id) AND reported_by = auth.uid());

CREATE POLICY "Org admins update disruptions"
  ON public.disruptions FOR UPDATE TO authenticated
  USING (private.is_org_admin(org_id))
  WITH CHECK (private.is_org_admin(org_id));

CREATE POLICY "Org admins delete disruptions"
  ON public.disruptions FOR DELETE TO authenticated
  USING (private.is_org_admin(org_id));

CREATE TRIGGER touch_disruptions_updated_at
  BEFORE UPDATE ON public.disruptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
