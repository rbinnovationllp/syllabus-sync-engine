ALTER TABLE public.referral_partners
  DROP CONSTRAINT IF EXISTS referral_partners_non_house_has_user;

ALTER TABLE public.referral_partners
  ADD CONSTRAINT referral_partners_non_house_has_user
  CHECK (is_house = true OR user_id IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated user can become partner" ON public.referral_partners;

CREATE POLICY "Authenticated user can become partner"
  ON public.referral_partners
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_house = false
    AND status = 'active'
    AND terms_accepted_at IS NOT NULL
    AND nda_accepted_at IS NOT NULL
  );