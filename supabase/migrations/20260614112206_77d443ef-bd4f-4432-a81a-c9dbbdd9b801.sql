
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles updatable by owner" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Profiles insertable by owner" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  org_id UUID,
  UNIQUE (user_id, role, org_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE org_id = _org_id AND user_id = auth.uid())
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view org" ON public.organizations FOR SELECT USING (public.is_org_member(id) OR auth.uid() = owner_id);
CREATE POLICY "Users create org" ON public.organizations FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates org" ON public.organizations FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owner deletes org" ON public.organizations FOR DELETE USING (auth.uid() = owner_id);

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view org_members" ON public.org_members FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY "Self join org" ON public.org_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Schools
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  region TEXT,
  country TEXT,
  state_province TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  board TEXT,
  monthly_fee_per_student NUMERIC,
  currency TEXT DEFAULT 'USD',
  fee_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage schools" ON public.schools FOR ALL USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

-- Academic years
CREATE TABLE public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  working_days_per_week INT NOT NULL DEFAULT 5,
  periods_per_day INT NOT NULL DEFAULT 6,
  period_duration_minutes INT NOT NULL DEFAULT 45,
  weekly_off_days INT[] NOT NULL DEFAULT '{0}', -- 0=Sun..6=Sat
  buffer_days INT NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;
GRANT ALL ON public.academic_years TO service_role;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage years" ON public.academic_years FOR ALL USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

-- Grade subjects (multi-teacher matrix)
CREATE TABLE public.grade_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  subject TEXT NOT NULL,
  periods_per_week INT NOT NULL DEFAULT 5,
  teacher_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_subjects TO authenticated;
GRANT ALL ON public.grade_subjects TO service_role;
ALTER TABLE public.grade_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage grade_subjects" ON public.grade_subjects FOR ALL USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

-- Textbooks (input; may be empty -> AI fill in Phase 3)
CREATE TABLE public.textbooks_input (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_subject_id UUID NOT NULL REFERENCES public.grade_subjects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT,
  author TEXT,
  publisher TEXT,
  edition_year INT,
  ai_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textbooks_input TO authenticated;
GRANT ALL ON public.textbooks_input TO service_role;
ALTER TABLE public.textbooks_input ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage textbooks" ON public.textbooks_input FOR ALL USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

-- Holidays
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  scope TEXT NOT NULL DEFAULT 'school', -- 'gov' or 'school'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage holidays" ON public.holidays FOR ALL USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

-- Vacation breaks
CREATE TABLE public.vacation_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vacation_breaks TO authenticated;
GRANT ALL ON public.vacation_breaks TO service_role;
ALTER TABLE public.vacation_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage vacations" ON public.vacation_breaks FOR ALL USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  prep_days INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage events" ON public.events FOR ALL USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

-- Exam windows
CREATE TABLE public.exam_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_windows TO authenticated;
GRANT ALL ON public.exam_windows TO service_role;
ALTER TABLE public.exam_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage exams" ON public.exam_windows FOR ALL USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

-- Training days
CREATE TABLE public.training_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_days TO authenticated;
GRANT ALL ON public.training_days TO service_role;
ALTER TABLE public.training_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage training" ON public.training_days FOR ALL USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));

-- Capacity results
CREATE TABLE public.capacity_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  c_total INT NOT NULL,
  h_gov INT NOT NULL DEFAULT 0,
  h_school INT NOT NULL DEFAULT 0,
  v_vacation INT NOT NULL DEFAULT 0,
  e_events INT NOT NULL DEFAULT 0,
  x_exams INT NOT NULL DEFAULT 0,
  t_training INT NOT NULL DEFAULT 0,
  w_offs INT NOT NULL DEFAULT 0,
  b_buffer INT NOT NULL DEFAULT 0,
  t_available INT NOT NULL,
  total_periods_available INT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capacity_results TO authenticated;
GRANT ALL ON public.capacity_results TO service_role;
ALTER TABLE public.capacity_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members read results" ON public.capacity_results FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY "Org members insert results" ON public.capacity_results FOR INSERT WITH CHECK (public.is_org_member(org_id));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_schools_updated BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_years_updated BEFORE UPDATE ON public.academic_years FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
