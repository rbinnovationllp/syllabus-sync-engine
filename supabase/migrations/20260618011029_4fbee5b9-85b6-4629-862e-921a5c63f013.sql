
-- PR1: Lock master-data writes to org admins; keep reads for all org members.

-- Helper: is the current user an admin of this org? (org_members.role='admin' OR global super_admin)
CREATE OR REPLACE FUNCTION private.is_org_admin(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = _org_id AND user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','super_admin')
  )
$$;

-- Helper to (re)apply split SELECT(any member) + write(admin only) policies
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'schools','academic_years','holidays','vacation_breaks',
    'events','exam_windows','training_days','grade_subjects','textbooks_input'
  ];
  pol record;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- drop ALL-ALL policies referencing is_org_member for these tables
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
        AND policyname LIKE 'Org members manage%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format($f$
      CREATE POLICY "Org members read %1$s" ON public.%1$I
      FOR SELECT TO authenticated
      USING (private.is_org_member(org_id))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "Org admins insert %1$s" ON public.%1$I
      FOR INSERT TO authenticated
      WITH CHECK (private.is_org_admin(org_id))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "Org admins update %1$s" ON public.%1$I
      FOR UPDATE TO authenticated
      USING (private.is_org_admin(org_id))
      WITH CHECK (private.is_org_admin(org_id))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "Org admins delete %1$s" ON public.%1$I
      FOR DELETE TO authenticated
      USING (private.is_org_admin(org_id))
    $f$, t);
  END LOOP;
END $$;

-- Audit log trigger: log every UPDATE on master-data tables
CREATE OR REPLACE FUNCTION public.log_master_data_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor uuid := auth.uid();
  _email text;
BEGIN
  SELECT email INTO _email FROM public.profiles WHERE id = _actor;
  INSERT INTO public.admin_audit_log (actor_id, actor_email, action, target_type, target_id, details)
  VALUES (
    _actor, _email,
    TG_OP || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(OLD)->>'id')),
    jsonb_build_object(
      'before', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'after',  CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    )
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'schools','academic_years','holidays','vacation_breaks',
    'events','exam_windows','training_days','grade_subjects','textbooks_input'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s_changes ON public.%1$I', t);
    EXECUTE format($f$
      CREATE TRIGGER audit_%1$s_changes
      AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
      FOR EACH ROW EXECUTE FUNCTION public.log_master_data_change()
    $f$, t);
  END LOOP;
END $$;

-- Allow org admins to read their own school's audit entries (super_admin policy already exists)
CREATE POLICY "Org admins view their audit log"
ON public.admin_audit_log
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.user_id = auth.uid() AND om.role = 'admin'
  )
);
