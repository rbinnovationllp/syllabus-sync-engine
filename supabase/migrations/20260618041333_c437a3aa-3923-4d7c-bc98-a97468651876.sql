CREATE TABLE IF NOT EXISTS public.ai_model_settings (
  org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  active_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  allow_fallback_escalation BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_model_settings_allowed_model CHECK (
    active_model IN (
      'google/gemini-2.5-flash',
      'google/gemini-2.5-flash-lite',
      'google/gemini-3-flash-preview',
      'google/gemini-3.1-flash-lite',
      'google/gemini-3.5-flash'
    )
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_settings TO authenticated;
GRANT ALL ON public.ai_model_settings TO service_role;

ALTER TABLE public.ai_model_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read AI settings"
  ON public.ai_model_settings FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org admins manage AI settings"
  ON public.ai_model_settings FOR ALL TO authenticated
  USING (
    public.is_org_member(org_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    public.is_org_member(org_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE TRIGGER trg_ai_model_settings_updated
  BEFORE UPDATE ON public.ai_model_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();