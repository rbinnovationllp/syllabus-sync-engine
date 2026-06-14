
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS extra_seats integer NOT NULL DEFAULT 0;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'teacher',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.is_org_member(org_id) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "org admins insert invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = invitations.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('admin','super_admin')
    )
  );

CREATE POLICY "org admins update invitations"
  ON public.invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = invitations.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('admin','super_admin')
    )
  );

CREATE TRIGGER invitations_touch_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS invitations_org_id_idx ON public.invitations(org_id);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON public.invitations(lower(email));
