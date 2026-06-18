
-- =========================================================
-- Referral Program: schema + house partner seed (PR 1)
-- =========================================================

-- ---- profiles: referrer pointer ----
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_partner_id uuid;

-- ---- referral_partners ----
CREATE TABLE public.referral_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  payout_email text,
  payout_method text NOT NULL DEFAULT 'manual_bank_transfer',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','under_review','suspended','terminated')),
  status_reason text,
  status_changed_at timestamptz,
  status_changed_by uuid REFERENCES auth.users(id),
  is_house boolean NOT NULL DEFAULT false,
  terms_accepted_at timestamptz,
  nda_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.referral_partners TO authenticated;
GRANT ALL ON public.referral_partners TO service_role;
ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner reads own row"
  ON public.referral_partners FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Authenticated user can become partner"
  ON public.referral_partners FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_house = false
    AND status = 'active'
  );

CREATE POLICY "Super admin manages partners"
  ON public.referral_partners FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX referral_partners_code_idx ON public.referral_partners(code);
CREATE INDEX referral_partners_status_idx ON public.referral_partners(status);

-- ---- referral_attributions ----
CREATE TABLE public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.referral_partners(id),
  code_used text NOT NULL,
  source_url text,
  is_house_fallback boolean NOT NULL DEFAULT false,
  attributed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_attributions TO authenticated;
GRANT ALL ON public.referral_attributions TO service_role;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner sees own attributions"
  ON public.referral_attributions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR partner_id IN (SELECT id FROM public.referral_partners WHERE user_id = auth.uid())
  );

-- ---- referral_commissions ----
CREATE TABLE public.referral_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.referral_partners(id),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL UNIQUE,
  stripe_charge_id text,
  gross_amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  commission_rate numeric(4,3) NOT NULL DEFAULT 0.100,
  commission_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'accrued'
    CHECK (status IN ('accrued','approved','paid','reversed','forfeited')),
  accrued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  payout_id uuid,
  notes text
);
GRANT SELECT ON public.referral_commissions TO authenticated;
GRANT ALL ON public.referral_commissions TO service_role;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner sees own commissions"
  ON public.referral_commissions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR partner_id IN (SELECT id FROM public.referral_partners WHERE user_id = auth.uid())
  );

CREATE INDEX referral_commissions_partner_idx ON public.referral_commissions(partner_id, status);

-- ---- referral_payouts ----
CREATE TABLE public.referral_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.referral_partners(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed')),
  provider text NOT NULL DEFAULT 'manual_bank_transfer',
  external_ref text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_payouts TO authenticated;
GRANT ALL ON public.referral_payouts TO service_role;
ALTER TABLE public.referral_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner sees own payouts"
  ON public.referral_payouts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR partner_id IN (SELECT id FROM public.referral_partners WHERE user_id = auth.uid())
  );

-- ---- referral_enforcement_actions (append-only audit) ----
CREATE TABLE public.referral_enforcement_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.referral_partners(id),
  action text NOT NULL
    CHECK (action IN ('show_cause_issued','response_received','suspended','reinstated','terminated','forfeited_commissions')),
  reason_category text NOT NULL
    CHECK (reason_category IN ('confidentiality_breach','competitor_engagement','fraud','spam','policy_violation','other')),
  notice_text text,
  evidence_url text,
  response_text text,
  response_due_at timestamptz,
  responded_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  forfeited_amount_cents integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.referral_enforcement_actions TO authenticated;
GRANT ALL ON public.referral_enforcement_actions TO service_role;
ALTER TABLE public.referral_enforcement_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads enforcement"
  ON public.referral_enforcement_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admin writes enforcement"
  ON public.referral_enforcement_actions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Append-only: block UPDATE and DELETE at the DB level (no policies = denied,
-- but be explicit by revoking even from authenticated)
REVOKE UPDATE, DELETE ON public.referral_enforcement_actions FROM authenticated;

CREATE INDEX referral_enforcement_partner_idx
  ON public.referral_enforcement_actions(partner_id, created_at DESC);

-- ---- updated_at triggers ----
CREATE TRIGGER referral_partners_touch
  BEFORE UPDATE ON public.referral_partners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---- Seed the house partner: Sushma Khare ----
INSERT INTO public.referral_partners
  (code, display_name, payout_email, is_house, status, terms_accepted_at, nda_accepted_at)
VALUES
  ('HOUSE', 'Sushma Khare', 'sushmarajeshkhare@gmail.com', true, 'active', now(), now())
ON CONFLICT (code) DO NOTHING;
