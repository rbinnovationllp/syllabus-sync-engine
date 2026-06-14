
CREATE OR REPLACE FUNCTION public.refund_ai_credits(_user_id uuid, _amount integer, _check_env text DEFAULT 'live')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.ai_credit_grants (user_id, credits_granted, credits_remaining, environment)
  VALUES (_user_id, _amount, _amount, _check_env);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_credit_balance(_user_id uuid, _monthly_quota integer, _check_env text DEFAULT 'live')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month DATE := date_trunc('month', now())::DATE;
  _used INTEGER := 0;
  _grants INTEGER := 0;
BEGIN
  SELECT COALESCE(ai_credits_used, 0) INTO _used
  FROM public.plan_usage WHERE user_id = _user_id AND period_month = _month;

  SELECT COALESCE(SUM(credits_remaining), 0) INTO _grants
  FROM public.ai_credit_grants
  WHERE user_id = _user_id AND environment = _check_env AND credits_remaining > 0;

  RETURN jsonb_build_object(
    'monthly_quota', COALESCE(_monthly_quota, 0),
    'monthly_used', COALESCE(_used, 0),
    'monthly_remaining', GREATEST(COALESCE(_monthly_quota, 0) - COALESCE(_used, 0), 0),
    'grant_remaining', COALESCE(_grants, 0),
    'total_remaining', GREATEST(COALESCE(_monthly_quota, 0) - COALESCE(_used, 0), 0) + COALESCE(_grants, 0)
  );
END;
$$;
