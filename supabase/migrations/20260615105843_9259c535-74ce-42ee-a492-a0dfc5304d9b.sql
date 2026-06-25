CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_org_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE org_id = _org_id
      AND user_id = auth.uid()
  )
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid) TO authenticated, service_role;

ALTER POLICY "Members view org" ON public.organizations
USING (private.is_org_member(id) OR auth.uid() = owner_id);

ALTER POLICY "Members view org_members" ON public.org_members
USING (private.is_org_member(org_id));

ALTER POLICY "Org members manage schools" ON public.schools
USING (private.is_org_member(org_id))
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members manage years" ON public.academic_years
USING (private.is_org_member(org_id))
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members manage grade_subjects" ON public.grade_subjects
USING (private.is_org_member(org_id))
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members manage textbooks" ON public.textbooks_input
USING (private.is_org_member(org_id))
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members manage holidays" ON public.holidays
USING (private.is_org_member(org_id))
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members manage vacations" ON public.vacation_breaks
USING (private.is_org_member(org_id))
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members manage events" ON public.events
USING (private.is_org_member(org_id))
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members manage exams" ON public.exam_windows
USING (private.is_org_member(org_id))
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members manage training" ON public.training_days
USING (private.is_org_member(org_id))
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members read results" ON public.capacity_results
USING (private.is_org_member(org_id));

ALTER POLICY "Org members insert results" ON public.capacity_results
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members update capacity_results" ON public.capacity_results
USING (private.is_org_member(org_id))
WITH CHECK (private.is_org_member(org_id));

ALTER POLICY "Org members delete capacity_results" ON public.capacity_results
USING (private.is_org_member(org_id));

ALTER POLICY "super admins view audit log" ON public.admin_audit_log
USING (private.has_role(auth.uid(), 'super_admin'::public.app_role));

ALTER POLICY "Org admins view invitations" ON public.invitations
USING (
  EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = invitations.org_id
      AND m.user_id = auth.uid()
      AND m.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role])
  )
  OR private.has_role(auth.uid(), 'super_admin'::public.app_role)
);

ALTER POLICY "Admins view leads" ON public.leads
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));

ALTER POLICY "Admins update leads" ON public.leads
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));

ALTER POLICY "Admins delete leads" ON public.leads
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));

ALTER POLICY "Admins view all schools" ON public.schools
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));

ALTER POLICY "Admins view all subscriptions" ON public.subscriptions
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));

ALTER POLICY "Admins view all plan_usage" ON public.plan_usage
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));

ALTER POLICY "Admins view all user_roles" ON public.user_roles
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));

ALTER POLICY "Admins view all profiles" ON public.profiles
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'super_admin'::public.app_role));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM authenticated, anon, PUBLIC;