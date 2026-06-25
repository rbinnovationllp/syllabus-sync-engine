REVOKE EXECUTE ON FUNCTION public.consume_ai_credits(UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_export(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_credits(UUID, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_export(UUID) TO service_role;