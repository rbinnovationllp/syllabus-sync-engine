-- Monthly usage counters
CREATE TABLE public.plan_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month DATE NOT NULL, -- first day of month, UTC
  ai_credits_used INTEGER NOT NULL DEFAULT 0,
  exports_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_month)
);

GRANT SELECT ON public.plan_usage TO authenticated;
GRANT ALL ON public.plan_usage TO service_role;

ALTER TABLE public.plan_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_usage" ON public.plan_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_plan_usage_updated_at
  BEFORE UPDATE ON public.plan_usage
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- One-time AI credit pack grants (from ai_credits_500 / ai_credits_2k purchases)
CREATE TABLE public.ai_credit_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_session_id TEXT UNIQUE,
  credits_granted INTEGER NOT NULL,
  credits_remaining INTEGER NOT NULL,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_credit_grants_user ON public.ai_credit_grants(user_id);

GRANT SELECT ON public.ai_credit_grants TO authenticated;
GRANT ALL ON public.ai_credit_grants TO service_role;

ALTER TABLE public.ai_credit_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_grants" ON public.ai_credit_grants
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_ai_credit_grants_updated_at
  BEFORE UPDATE ON public.ai_credit_grants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atomic consumption: try monthly allowance first, then purchased grants (FIFO).
-- Returns the number of credits actually consumed from grants (>=0) on success,
-- or NULL when the user does not have enough credits.
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  _user_id UUID,
  _cost INTEGER,
  _monthly_quota INTEGER,
  _check_env TEXT DEFAULT 'live'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month DATE := date_trunc('month', now())::DATE;
  _used INTEGER;
  _from_quota INTEGER := 0;
  _from_grants INTEGER := 0;
  _remaining INTEGER := _cost;
  _grant RECORD;
  _take INTEGER;
BEGIN
  IF _cost <= 0 THEN RETURN 0; END IF;

  -- Upsert current month row and lock it
  INSERT INTO public.plan_usage (user_id, period_month, ai_credits_used)
  VALUES (_user_id, _month, 0)
  ON CONFLICT (user_id, period_month) DO NOTHING;

  SELECT ai_credits_used INTO _used
  FROM public.plan_usage
  WHERE user_id = _user_id AND period_month = _month
  FOR UPDATE;

  IF _used < _monthly_quota THEN
    _from_quota := LEAST(_monthly_quota - _used, _remaining);
    _remaining := _remaining - _from_quota;
  END IF;

  IF _remaining > 0 THEN
    FOR _grant IN
      SELECT id, credits_remaining
      FROM public.ai_credit_grants
      WHERE user_id = _user_id
        AND environment = _check_env
        AND credits_remaining > 0
      ORDER BY created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN _remaining <= 0;
      _take := LEAST(_grant.credits_remaining, _remaining);
      UPDATE public.ai_credit_grants
        SET credits_remaining = credits_remaining - _take
        WHERE id = _grant.id;
      _from_grants := _from_grants + _take;
      _remaining := _remaining - _take;
    END LOOP;
  END IF;

  IF _remaining > 0 THEN
    RETURN NULL; -- insufficient credits, nothing consumed
  END IF;

  UPDATE public.plan_usage
    SET ai_credits_used = ai_credits_used + _from_quota
    WHERE user_id = _user_id AND period_month = _month;

  RETURN _from_grants;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_credits(UUID, INTEGER, INTEGER, TEXT) TO authenticated, service_role;

-- Increment export counter for the current month
CREATE OR REPLACE FUNCTION public.record_export(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month DATE := date_trunc('month', now())::DATE;
  _count INTEGER;
BEGIN
  INSERT INTO public.plan_usage (user_id, period_month, exports_used)
  VALUES (_user_id, _month, 1)
  ON CONFLICT (user_id, period_month)
  DO UPDATE SET exports_used = public.plan_usage.exports_used + 1
  RETURNING exports_used INTO _count;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_export(UUID) TO authenticated, service_role;