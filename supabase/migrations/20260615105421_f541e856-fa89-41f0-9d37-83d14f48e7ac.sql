CREATE POLICY "Org owners bootstrap own admin membership"
ON public.org_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'admin'::public.app_role
  AND EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = org_members.org_id
      AND o.owner_id = auth.uid()
  )
);