
REVOKE EXECUTE ON FUNCTION public.refund_ai_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ai_credit_balance(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_credits(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_credit_balance(uuid, integer, text) TO service_role;
