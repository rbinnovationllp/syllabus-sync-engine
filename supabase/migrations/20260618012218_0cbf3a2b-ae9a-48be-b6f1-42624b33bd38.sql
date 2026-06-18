
-- 1. Soft-delete column on subject_curricula
ALTER TABLE public.subject_curricula
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. curriculum_versions table
CREATE TABLE IF NOT EXISTS public.curriculum_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('annual_calendar','subject_curriculum')),
  grade text,
  subject text,
  version_no integer NOT NULL,
  payload jsonb NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff_summary text,
  source text NOT NULL DEFAULT 'generation',  -- 'generation' | 'recalibration' | 'manual_edit' | 'restore'
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cvers_year ON public.curriculum_versions(year_id);
CREATE INDEX IF NOT EXISTS idx_cvers_org ON public.curriculum_versions(org_id);
CREATE INDEX IF NOT EXISTS idx_cvers_lookup
  ON public.curriculum_versions(year_id, entity_type, grade, subject, version_no DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_versions TO authenticated;
GRANT ALL ON public.curriculum_versions TO service_role;

ALTER TABLE public.curriculum_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read curriculum_versions"
  ON public.curriculum_versions FOR SELECT TO authenticated
  USING (private.is_org_member(org_id));

CREATE POLICY "Org admins delete curriculum_versions"
  ON public.curriculum_versions FOR DELETE TO authenticated
  USING (private.is_org_admin(org_id));

-- No INSERT/UPDATE policies for end users — writes happen via service-role server fns.

-- 3. Helper RPC: append a new version row with auto-incremented version_no
CREATE OR REPLACE FUNCTION public.append_curriculum_version(
  _year_id uuid,
  _entity_type text,
  _grade text,
  _subject text,
  _payload jsonb,
  _meta jsonb,
  _diff_summary text,
  _source text,
  _created_by uuid
) RETURNS public.curriculum_versions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org uuid;
  _next int;
  _row public.curriculum_versions;
BEGIN
  SELECT org_id INTO _org FROM public.academic_years WHERE id = _year_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'year not found'; END IF;

  SELECT COALESCE(MAX(version_no), 0) + 1
    INTO _next
    FROM public.curriculum_versions
   WHERE year_id = _year_id
     AND entity_type = _entity_type
     AND grade IS NOT DISTINCT FROM _grade
     AND subject IS NOT DISTINCT FROM _subject;

  INSERT INTO public.curriculum_versions
    (org_id, year_id, entity_type, grade, subject, version_no,
     payload, meta, diff_summary, source, created_by)
  VALUES
    (_org, _year_id, _entity_type, _grade, _subject, _next,
     _payload, COALESCE(_meta, '{}'::jsonb), _diff_summary, COALESCE(_source,'generation'), _created_by)
  RETURNING * INTO _row;
  RETURN _row;
END $$;

REVOKE EXECUTE ON FUNCTION public.append_curriculum_version(uuid,text,text,text,jsonb,jsonb,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_curriculum_version(uuid,text,text,text,jsonb,jsonb,text,text,uuid) TO service_role;
