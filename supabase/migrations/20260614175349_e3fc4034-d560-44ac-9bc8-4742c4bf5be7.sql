
-- 1) Remove open self-join on org_members
DROP POLICY IF EXISTS "Self join org" ON public.org_members;

-- 2) Restrict invitation visibility to org admins / super admins only
DROP POLICY IF EXISTS "org members view invitations" ON public.invitations;
CREATE POLICY "Org admins view invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = invitations.org_id
      AND m.user_id = auth.uid()
      AND m.role IN ('admin'::app_role, 'super_admin'::app_role)
  )
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- 3) Allow org members to update/delete their capacity results
CREATE POLICY "Org members update capacity_results"
ON public.capacity_results
FOR UPDATE
TO authenticated
USING (public.is_org_member(org_id))
WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "Org members delete capacity_results"
ON public.capacity_results
FOR DELETE
TO authenticated
USING (public.is_org_member(org_id));
