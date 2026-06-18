import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getSchoolProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ academic_year_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const yearId = data.academic_year_id;

    const yearRes = await supabase
      .from("academic_years")
      .select("*, schools(*)")
      .eq("id", yearId)
      .maybeSingle();
    if (yearRes.error) throw new Error(yearRes.error.message);
    if (!yearRes.data) throw new Error("Academic year not found");
    const year = yearRes.data as any;
    const school = year.schools;
    const orgId = year.org_id as string;

    const [holidays, vacations, events, exams, training, gradeSubjects, membership] =
      await Promise.all([
        supabase.from("holidays").select("*").eq("academic_year_id", yearId).order("date"),
        supabase.from("vacation_breaks").select("*").eq("academic_year_id", yearId).order("start_date"),
        supabase.from("events").select("*").eq("academic_year_id", yearId).order("date"),
        supabase.from("exam_windows").select("*").eq("academic_year_id", yearId).order("start_date"),
        supabase.from("training_days").select("*").eq("academic_year_id", yearId).order("date"),
        supabase.from("grade_subjects").select("*").eq("academic_year_id", yearId),
        supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle(),
      ]);

    const gsIds = (gradeSubjects.data ?? []).map((g: any) => g.id);
    const textbooksRes = gsIds.length
      ? await supabase.from("textbooks_input").select("*").in("grade_subject_id", gsIds)
      : { data: [] as any[] };

    return {
      year,
      school,
      holidays: holidays.data ?? [],
      vacations: vacations.data ?? [],
      events: events.data ?? [],
      exams: exams.data ?? [],
      training: training.data ?? [],
      grade_subjects: gradeSubjects.data ?? [],
      textbooks: textbooksRes.data ?? [],
      can_edit: membership.data?.role === "admin",
      my_role: membership.data?.role ?? null,
    };
  });

export const listProfileAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("admin_audit_log")
      .select("id, actor_email, action, target_type, target_id, created_at, details")
      .in("target_type", [
        "schools",
        "academic_years",
        "holidays",
        "vacation_breaks",
        "events",
        "exam_windows",
        "training_days",
        "grade_subjects",
        "textbooks_input",
      ])
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
