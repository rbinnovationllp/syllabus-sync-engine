import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { fullOnboardingSchema } from "./onboarding-schema";
import { calculateCapacity } from "./capacity-engine";
import { friendlyOrgMemberError, logOrgMemberBootstrap } from "./org-errors";

export const submitOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => fullOnboardingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { step1, step2, step3, step4 } = data;

    // 1. Create organization (admin = creator)
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: step1.school_name, owner_id: userId })
      .select()
      .single();
    if (orgErr || !org) throw new Error(`Failed to create org: ${orgErr?.message}`);

    // 2. Join as member (use admin client; self-join policy is intentionally disabled)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: memErr } = await supabaseAdmin
      .from("org_members")
      .insert({ org_id: org.id, user_id: userId, role: "admin" });
    if (memErr) throw new Error(friendlyOrgMemberError(memErr.message));
    await logOrgMemberBootstrap(supabaseAdmin as any, {
      actorId: userId,
      actorEmail: (claims?.email as string | undefined) ?? null,
      orgId: org.id,
      role: "admin",
      source: "onboarding",
    });

    // 3. School
    const { data: school, error: schErr } = await supabase
      .from("schools")
      .insert({
        org_id: org.id,
        name: step1.school_name,
        region: step1.region || null,
        country: step1.country,
        state_province: step1.state_province || null,
        city: step1.city || null,
        latitude: step1.latitude ?? null,
        longitude: step1.longitude ?? null,
        board: step1.board,
        monthly_fee_per_student: step2.monthly_fee_per_student ?? null,
        currency: step2.currency,
        fee_tier: step2.fee_tier,
      })
      .select()
      .single();
    if (schErr || !school) throw new Error(`Failed to create school: ${schErr?.message}`);

    // 4. Academic year
    const { data: year, error: yrErr } = await supabase
      .from("academic_years")
      .insert({
        school_id: school.id,
        org_id: org.id,
        label: step3.label,
        start_date: step3.start_date,
        end_date: step3.end_date,
        working_days_per_week: step3.working_days_per_week,
        periods_per_day: step3.periods_per_day,
        period_duration_minutes: step3.period_duration_minutes,
        weekly_off_days: step3.weekly_off_days,
        buffer_days: step3.buffer_days,
      })
      .select()
      .single();
    if (yrErr || !year) throw new Error(`Failed to create academic year: ${yrErr?.message}`);

    // 5. Grade subjects
    const gradeSubjectRows = step3.grade_subjects.map((gs) => ({
      academic_year_id: year.id,
      org_id: org.id,
      grade: gs.grade,
      stream: gs.stream || null,
      subject: gs.subject,
      periods_per_week: gs.periods_per_week,
      teacher_name: gs.teacher_name || null,
    }));
    const { data: gsInserted, error: gsErr } = await supabase
      .from("grade_subjects")
      .insert(gradeSubjectRows)
      .select();
    if (gsErr) throw new Error(`Failed to save grade subjects: ${gsErr.message}`);

    // 6. Textbooks (optional)
    if (step2.textbooks.length > 0 && gsInserted) {
      const gsMap = new Map(gsInserted.map((g) => [`${g.grade}|${g.subject}`, g.id]));
      const tbRows = step2.textbooks
        .map((tb) => {
          const gsId = gsMap.get(`${tb.grade}|${tb.subject}`);
          if (!gsId) return null;
          const hasContent = tb.title || tb.author || tb.publisher;
          if (!hasContent) return null;
          return {
            grade_subject_id: gsId,
            org_id: org.id,
            title: tb.title || null,
            author: tb.author || null,
            publisher: tb.publisher || null,
            edition_year: tb.edition_year ?? null,
            ai_recommended: false,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (tbRows.length > 0) {
        await supabase.from("textbooks_input").insert(tbRows);
      }
    }

    // 7. Holidays / vacations / events / exams / training
    if (step4.holidays.length > 0) {
      await supabase.from("holidays").insert(
        step4.holidays.map((h) => ({ ...h, academic_year_id: year.id, org_id: org.id })),
      );
    }
    if (step4.vacation_breaks.length > 0) {
      await supabase.from("vacation_breaks").insert(
        step4.vacation_breaks.map((v) => ({ ...v, academic_year_id: year.id, org_id: org.id })),
      );
    }
    if (step4.events.length > 0) {
      await supabase.from("events").insert(
        step4.events.map((e) => ({ ...e, academic_year_id: year.id, org_id: org.id })),
      );
    }
    if (step4.exam_windows.length > 0) {
      await supabase.from("exam_windows").insert(
        step4.exam_windows.map((x) => ({ ...x, academic_year_id: year.id, org_id: org.id })),
      );
    }
    if (step4.training_days.length > 0) {
      await supabase.from("training_days").insert(
        step4.training_days.map((t) => ({ ...t, academic_year_id: year.id, org_id: org.id })),
      );
    }

    // 8. Compute & persist capacity
    const breakdown = calculateCapacity({
      start_date: step3.start_date,
      end_date: step3.end_date,
      weekly_off_days: step3.weekly_off_days,
      buffer_days: step3.buffer_days,
      holidays: step4.holidays.map((h) => ({ date: h.date, scope: h.scope })),
      vacation_breaks: step4.vacation_breaks.map((v) => ({ start_date: v.start_date, end_date: v.end_date })),
      events: step4.events.map((e) => ({ start_date: e.start_date, end_date: e.end_date, prep_days: e.prep_days })),
      exam_windows: step4.exam_windows.map((x) => ({ start_date: x.start_date, end_date: x.end_date })),
      training_days: step4.training_days.map((t) => ({ date: t.date })),
    });

    const total_periods_available = breakdown.t_available * step3.periods_per_day;

    await supabase.from("capacity_results").insert({
      academic_year_id: year.id,
      org_id: org.id,
      ...breakdown,
      total_periods_available,
    });

    return {
      org_id: org.id,
      school_id: school.id,
      academic_year_id: year.id,
      breakdown,
      total_periods_available,
    };
  });

export const listMyAcademicYears = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("academic_years")
      .select("id, label, start_date, end_date, school_id, schools(name, country, board)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getYearResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ academic_year_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [year, school, capacity, gs] = await Promise.all([
      supabase.from("academic_years").select("*").eq("id", data.academic_year_id).maybeSingle(),
      supabase.from("academic_years").select("schools(*)").eq("id", data.academic_year_id).maybeSingle(),
      supabase.from("capacity_results").select("*").eq("academic_year_id", data.academic_year_id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("grade_subjects").select("*").eq("academic_year_id", data.academic_year_id),
    ]);
    if (!year.data) throw new Error("Academic year not found");
    return {
      year: year.data,
      school: school.data?.schools ?? null,
      capacity: capacity.data,
      grade_subjects: gs.data ?? [],
    };
  });
