
REVOKE EXECUTE ON FUNCTION public.is_assigned_teacher(uuid, uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_assigned_teacher(uuid, uuid, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.log_proposal_status_change() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.log_proposal_status_change() TO service_role;
