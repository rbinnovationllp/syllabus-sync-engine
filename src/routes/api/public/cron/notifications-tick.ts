import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron tick: scans for syllabus risk, upcoming training, recent disruptions
 * and queues in-app notifications (deduped) for affected teachers + admins.
 * Schedule via pg_cron every 6 hours.
 */
export const Route = createFileRoute("/api/public/cron/notifications-tick")({
  server: {
    handlers: {
      POST: async () => runTick(),
      GET: async () => runTick(),
    },
  },
});

async function runTick() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results = {
    syllabus_risk: 0,
    training_reminder: 0,
    disruption: 0,
    errors: [] as string[],
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const today = new Date(todayIso);

  /* ---------------- 1. Syllabus risk per assignment ---------------- */
  try {
    const { data: assignments } = await supabaseAdmin
      .from("teacher_assignments")
      .select("id, teacher_user_id, academic_year_id, grade, subject");

    for (const a of assignments ?? []) {
      // earliest upcoming exam window for this year
      const { data: exam } = await supabaseAdmin
        .from("exam_windows")
        .select("name, start_date")
        .eq("academic_year_id", a.academic_year_id)
        .gte("start_date", todayIso)
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!exam?.start_date) continue;

      const grade = String(a.grade);
      const gradeNum = parseInt(grade, 10);
      const buffer = gradeNum >= 11 ? 60 : gradeNum >= 9 ? 45 : 30;
      const daysToExam = Math.ceil(
        (new Date(exam.start_date).getTime() - today.getTime()) / 86_400_000,
      );
      if (daysToExam > buffer) continue;

      // syllabus completion proxy = latest subject_curriculum version exists?
      const { data: ver } = await supabaseAdmin
        .from("curriculum_versions")
        .select("id, payload")
        .eq("year_id", a.academic_year_id)
        .eq("entity_type", "subject_curriculum")
        .eq("grade", grade)
        .eq("subject", a.subject)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();

      const chapters = ((ver?.payload as any)?.chapters ?? []) as any[];
      if (chapters.length === 0) continue; // no plan yet — skip

      const yearId = a.academic_year_id;
      const dedupe = `syllabus_risk:${yearId}:${grade}:${a.subject}:${exam.start_date}`;
      await supabaseAdmin.from("notifications").insert({
        user_id: a.teacher_user_id,
        type: "syllabus_risk",
        severity: daysToExam <= buffer / 2 ? "critical" : "warn",
        title: `Syllabus risk — Grade ${grade} ${a.subject}`,
        body: `${exam.name ?? "Exam"} starts in ${daysToExam} day(s). Buffer for this grade is ${buffer}. Review pacing.`,
        link: `/results/${yearId}`,
        dedupe_key: dedupe,
      });
      results.syllabus_risk++;
    }
  } catch (e: any) {
    results.errors.push(`syllabus_risk: ${e.message}`);
  }

  /* ---------------- 2. Training reminders (7 days out) ---------------- */
  try {
    const in7 = new Date(today.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: trainings } = await supabaseAdmin
      .from("training_days")
      .select("id, academic_year_id, date")
      .gte("date", todayIso)
      .lte("date", in7);

    for (const t of trainings ?? []) {
      const { data: year } = await supabaseAdmin
        .from("academic_years")
        .select("org_id")
        .eq("id", t.academic_year_id)
        .maybeSingle();
      if (!year?.org_id) continue;
      const { data: members } = await supabaseAdmin
        .from("org_members")
        .select("user_id")
        .eq("org_id", year.org_id);

      const dedupe = `training:${t.id}`;
      for (const m of members ?? []) {
        await supabaseAdmin.from("notifications").insert({
          user_id: m.user_id,
          type: "training_reminder",
          severity: "info",
          title: "Upcoming training day",
          body: `${(t as any).topic ?? "Faculty training"} on ${t.date}.`,
          link: `/results/${t.academic_year_id}`,
          dedupe_key: `${dedupe}:${m.user_id}`,
        });
        results.training_reminder++;
      }
    }
  } catch (e: any) {
    results.errors.push(`training: ${e.message}`);
  }

  /* ---------------- 3. New disruptions (last 6h) ---------------- */
  try {
    const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    const { data: disruptions } = await supabaseAdmin
      .from("disruptions")
      .select("id, year_id, category, reason, lost_days, affected_grades, created_at")
      .gte("created_at", since);

    for (const d of disruptions ?? []) {
      // notify teachers assigned to affected grades (or all teachers if none specified)
      let teacherQ = supabaseAdmin
        .from("teacher_assignments")
        .select("teacher_user_id, grade")
        .eq("academic_year_id", d.year_id);
      const { data: teachers } = await teacherQ;
      const affected = ((d as any).affected_grades ?? []) as string[];

      for (const t of teachers ?? []) {
        if (affected.length > 0 && !affected.includes(String(t.grade))) continue;
        await supabaseAdmin.from("notifications").insert({
          user_id: t.teacher_user_id,
          type: "plan_change",
          severity: "warn",
          title: `Schedule disruption — ${d.category}`,
          body: `${d.reason} (lost ${d.lost_days} day(s)). Your plan may have been recalibrated.`,
          link: `/results/${d.year_id}`,
          dedupe_key: `disruption:${d.id}:${t.teacher_user_id}`,
        });
        results.disruption++;
      }
    }
  } catch (e: any) {
    results.errors.push(`disruption: ${e.message}`);
  }

  return Response.json({ ok: true, ...results });
}
