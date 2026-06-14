
-- Leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  school_name TEXT,
  country TEXT,
  board TEXT,
  message TEXT,
  source TEXT DEFAULT 'website',
  stage TEXT NOT NULL DEFAULT 'new', -- new | contacted | demo | won | lost
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view leads" ON public.leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins update leads" ON public.leads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins delete leads" ON public.leads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Admin/super_admin view policies on other tables
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins view all subscriptions" ON public.subscriptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins view all schools" ON public.schools FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins view all plan_usage" ON public.plan_usage FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins view all user_roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Update handle_new_user to auto-grant super_admin to owner email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  IF LOWER(NEW.email) = 'rbinnovationllp@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $function$;

-- Backfill: if owner already exists, promote
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users WHERE LOWER(email) = 'rbinnovationllp@gmail.com'
ON CONFLICT DO NOTHING;
