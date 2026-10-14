ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.referral_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_verification_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (partner_verification_status IN ('not_applicable', 'verified', 'pending_verification', 'invalid'));

CREATE INDEX IF NOT EXISTS leads_partner_name_idx ON public.leads(partner_name);
CREATE INDEX IF NOT EXISTS leads_partner_referral_code_idx ON public.leads(partner_referral_code);
CREATE INDEX IF NOT EXISTS leads_partner_verification_status_idx ON public.leads(partner_verification_status);