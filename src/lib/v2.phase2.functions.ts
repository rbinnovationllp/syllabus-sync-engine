import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireOrgFeature } from "@/lib/plan-entitlements";

const simulationInput = z.object({
  scenario_type: z.string().min(2).max(80),
  lost_days: z.number().int().min(0).max(120).default(0),
  affected_teacher: z.string().max(120).optional().nullable(),
  exam_shift_days: z.number().int().min(-120).max(120).default(0),
  notes: z.string().max(2000).optional().nullable(),
  save: z.boolean().default(false),
});

const parentDraftInput = z.object({
  communication_type: z.string().min(2).max(80),
  audience: z.string().min(2).max(120),
  language: z.string().min(2).max(40).default("English"),
  prompt: z.string().min(3).max(3000),
  save: z.boolean().default(false),
});

async function getMembership(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, name, owner_id)")
    .eq("user_id", userId)
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadAcademicContext(supabase: any, userId: string) {
  const memberships = await getMembership(supabase, userId);
  const orgIds = memberships.map((m: any) => m.org_id).filter(Boolean);
  if (orgIds.length === 0) throw new Error("No school membership found");

  const { data: year, error: yearError } = await supabase
    .from("academic_years")
    .select("*, schools(name, country, board, city, state, fee_tier)")
    .in("org_id", orgIds)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (yearError) throw new Error(yearError.message);

  if (!year) return { memberships, orgIds, year: null, subjects: [], curricula: [], exams: [], events: [], aiRuns: [] };

  const [subjectsRes, curriculaRes, examsRes, eventsRes, runsRes, capacityRes] = await Promise.all([
    supabase.from("grade_subjects").select("*").eq("academic_year_id", year.id),
    supabase.from("subject_curricula").select("*").eq("academic_year_id", year.id),
    supabase.from("exam_windows").select("*").eq("academic_year_id", year.id).order("start_date", { ascending: true }),
    supabase.from("events").select("*").eq("academic_year_id", year.id).order("start_date", { ascending: true }),
    supabase.from("ai_runs").select("*").eq("year_id", year.id).order("created_at", { ascending: false }).limit(25),
    supabase.from("capacity_results").select("*").eq("academic_year_id", year.id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    memberships,
    orgIds,
    year,
    subjects: subjectsRes.data ?? [],
    curricula: curriculaRes.data ?? [],
    exams: examsRes.data ?? [],
    events: eventsRes.data ?? [],
    aiRuns: runsRes.data ?? [],
    capacity: capacityRes.data,
  };
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function completionFor(ctx: any) {
  const subjects = Array.isArray(ctx.subjects) ? ctx.subjects : [];
  const curricula = Array.isArray(ctx.curricula) ? ctx.curricula : [];
  const generated = new Set(curricula.map((c: any) => `${c.grade}|${c.subject}`));
  const total = Math.max(subjects.length, 1);
  return clamp((generated.size / total) * 100);
}

function teacherRows(ctx: any) {
  const subjects = Array.isArray(ctx.subjects) ? ctx.subjects : [];
  const curricula = Array.isArray(ctx.curricula) ? ctx.curricula : [];
  const generated = new Set(curricula.map((c: any) => `${c.grade}|${c.subject}`));
  const map = new Map<string, any>();

  for (const row of subjects) {
    const teacher = row.teacher_name || row.teacher || "Unassigned";
    const current = map.get(teacher) ?? {
      teacher,
      assigned: 0,
      completed: 0,
      pending: 0,
      totalPeriods: 0,
      subjects: [],
    };
    const key = `${row.grade}|${row.subject}`;
    const done = generated.has(key);
    current.assigned += 1;
    current.completed += done ? 1 : 0;
    current.pending += done ? 0 : 1;
    current.totalPeriods += Number(row.total_periods ?? row.periods ?? 0);
    current.subjects.push(`${row.grade} ${row.subject}`);
    map.set(teacher, current);
  }

  return [...map.values()].map((teacher: any) => ({
    ...teacher,
    completion: teacher.assigned ? clamp((teacher.completed / teacher.assigned) * 100) : 0,
    risk: teacher.pending >= 3 ? "high" : teacher.pending >= 1 ? "watch" : "stable",
  }));
}

function recoveryRecommendations(input: z.infer<typeof simulationInput>, baseCompletion: number) {
  const recs = [];
  if (input.lost_days > 0) {
    recs.push(`Recover ${input.lost_days} lost days by adding focused catch-up blocks for priority chapters.`);
    recs.push("Protect revision time first; move lower-weight activities into homework or project mode.");
  }
  if (input.affected_teacher) {
    recs.push(`Create a substitute plan for ${input.affected_teacher} and redistribute pending classes for two weeks.`);
  }
  if (input.exam_shift_days < 0) {
    recs.push("Exams moved earlier: freeze non-essential events and start revision readiness review immediately.");
  }
  if (baseCompletion < 70) {
    recs.push("Syllabus completion is below target; schedule weekly principal review until the risk indicator improves.");
  }
  if (!recs.length) recs.push("No major disruption detected. Continue normal monitoring and keep buffer days protected.");
  return recs;
}

export const simulateAcademicScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => simulationInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const ctx = await loadAcademicContext(context.supabase, context.userId);
    const baseCompletion = completionFor(ctx);
    const completionImpact = clamp(data.lost_days * 1.3 + Math.max(0, -data.exam_shift_days) * 0.7, 0, 55);
    const projectedCompletion = clamp(baseCompletion - completionImpact);
    const teacherLoadImpact = clamp(50 + data.lost_days * 2 + (data.affected_teacher ? 18 : 0), 0, 100);
    const revisionRisk = clamp(100 - projectedCompletion + Math.max(0, -data.exam_shift_days) * 3, 0, 100);
    const recommendations = recoveryRecommendations(data, baseCompletion);

    let saved = null;
    if (data.save && ctx.year) {
      const db = context.supabase as any;
      const { data: row } = await db.from("v2_simulations").insert({
        org_id: ctx.year.org_id,
        year_id: ctx.year.id,
        user_id: context.userId,
        scenario_type: data.scenario_type,
        inputs: data,
        result: { baseCompletion, projectedCompletion, teacherLoadImpact, revisionRisk, recommendations },
      }).select("*").maybeSingle();
      saved = row;
    }

    return {
      year: ctx.year,
      scenario: data,
      metrics: [
        { label: "Current syllabus readiness", value: baseCompletion, suffix: "%" },
        { label: "Projected readiness", value: projectedCompletion, suffix: "%" },
        { label: "Teacher load pressure", value: teacherLoadImpact, suffix: "/100" },
        { label: "Revision risk", value: revisionRisk, suffix: "/100" },
      ],
      recommendations,
      saved,
    };
  });

export const getTeacherPerformanceIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const ctx = await loadAcademicContext(context.supabase, context.userId);
    const teachers = teacherRows(ctx).sort((a, b) => b.pending - a.pending);
    const averageCompletion = teachers.length ? clamp(teachers.reduce((sum, t) => sum + t.completion, 0) / teachers.length) : 0;
    return {
      year: ctx.year,
      summary: {
        teachers: teachers.length,
        averageCompletion,
        highRisk: teachers.filter((t) => t.risk === "high").length,
        watch: teachers.filter((t) => t.risk === "watch").length,
      },
      teachers,
      recommendations: [
        "Review high-risk teachers first and assign catch-up support.",
        "Use pending grade-subject rows as the first performance signal until lesson-level data is added.",
        "Ask teachers with stable completion to share pacing practices with the department.",
      ],
    };
  });

export const getStudentLearningIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const ctx = await loadAcademicContext(context.supabase, context.userId);
    const db = context.supabase as any;
    let studentCount = 0;
    let hasStudentData = false;

    try {
      const { count, error } = await db.from("students").select("*", { count: "exact", head: true }).in("org_id", ctx.orgIds);
      if (!error) {
        hasStudentData = true;
        studentCount = count ?? 0;
      }
    } catch {
      hasStudentData = false;
    }

    const completion = completionFor(ctx);
    return {
      year: ctx.year,
      hasStudentData,
      studentCount,
      cohorts: [
        { label: "At-risk learning cohort", value: hasStudentData ? clamp(100 - completion) : 0, note: hasStudentData ? "Needs intervention review" : "Connect student assessment data to activate." },
        { label: "Homework support cohort", value: hasStudentData ? 18 : 0, note: hasStudentData ? "Monitor weekly" : "Awaiting homework completion data." },
        { label: "Revision-ready cohort", value: hasStudentData ? completion : 0, note: hasStudentData ? "Ready for structured revision" : "Awaiting student learning records." },
      ],
      interventionPlan: [
        "Connect attendance, homework, and assessment tables for individual student scoring.",
        "Use weak chapter tags from generated curriculum to prepare remedial groups.",
        "Create parent update drafts from the Parent Communication Hub for every at-risk cohort.",
      ],
    };
  });

export const generateParentCommunication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => parentDraftInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireOrgFeature(context.supabase, context.userId, "parent_hub");
    const ctx = await loadAcademicContext(context.supabase, context.userId);
    const schoolName = ctx.year?.schools?.name ?? "the school";
    const draft = [
      `Subject: ${data.communication_type} - ${schoolName}`,
      "",
      `Dear ${data.audience},`,
      "",
      `This is a ${data.language} communication draft prepared for ${schoolName}.`,
      "",
      data.prompt,
      "",
      "Suggested message:",
      "We request your support in helping students stay consistent with attendance, homework, and revision. The school team is monitoring academic progress and will share focused guidance wherever intervention is needed.",
      "",
      "Regards,",
      `${schoolName} Academic Team`,
    ].join("\n");

    let saved = null;
    if (data.save && ctx.year) {
      const db = context.supabase as any;
      const { data: row } = await db.from("v2_parent_messages").insert({
        org_id: ctx.year.org_id,
        year_id: ctx.year.id,
        user_id: context.userId,
        communication_type: data.communication_type,
        audience: data.audience,
        language: data.language,
        prompt: data.prompt,
        content: draft,
      }).select("*").maybeSingle();
      saved = row;
    }

    return { year: ctx.year, title: `${data.communication_type} for ${data.audience}`, content: draft, saved };
  });


