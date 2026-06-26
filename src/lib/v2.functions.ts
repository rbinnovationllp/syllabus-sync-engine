import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireOrgFeature } from "@/lib/plan-entitlements";

const moduleSchema = z.enum([
  "principal_dashboard",
  "teacher_copilot",
  "content_studio",
  "assessment_generator",
]);

const draftInput = z.object({
  module: moduleSchema,
  year_id: z.string().uuid().optional().nullable(),
  resource_type: z.string().min(2).max(80),
  prompt: z.string().min(3).max(4000),
  grade: z.string().max(40).optional().nullable(),
  subject: z.string().max(120).optional().nullable(),
  params: z.record(z.any()).optional().default({}),
  save: z.boolean().optional().default(false),
});

const saveInput = z.object({
  id: z.string().uuid().optional().nullable(),
  module: moduleSchema,
  year_id: z.string().uuid().optional().nullable(),
  resource_type: z.string().min(2).max(80),
  title: z.string().min(2).max(180),
  content: z.string().min(1).max(120000),
  grade: z.string().max(40).optional().nullable(),
  subject: z.string().max(120).optional().nullable(),
  params: z.record(z.any()).optional().default({}),
});

const listInput = z.object({
  module: moduleSchema.optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
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

async function getPrimaryYear(supabase: any, orgIds: string[], yearId?: string | null) {
  if (yearId) {
    const { data, error } = await supabase
      .from("academic_years")
      .select("*, schools(name, country, board, city, state, fee_tier)")
      .eq("id", yearId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || !orgIds.includes(data.org_id)) throw new Error("Academic year not found");
    return data;
  }

  const { data, error } = await supabase
    .from("academic_years")
    .select("*, schools(name, country, board, city, state, fee_tier)")
    .in("org_id", orgIds)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function asArray<T = any>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

async function loadV2Context(supabase: any, userId: string, yearId?: string | null) {
  const memberships = await getMembership(supabase, userId);
  const orgIds = memberships.map((m: any) => m.org_id).filter(Boolean);
  if (orgIds.length === 0) throw new Error("No school membership found");

  const year = await getPrimaryYear(supabase, orgIds, yearId);
  if (!year) return { memberships, orgIds, year: null };

  const [capacityRes, subjectsRes, curriculaRes, calendarsRes, examsRes, eventsRes, runsRes] = await Promise.all([
    supabase
      .from("capacity_results")
      .select("*")
      .eq("academic_year_id", year.id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("grade_subjects").select("*").eq("academic_year_id", year.id),
    supabase.from("subject_curricula").select("*").eq("academic_year_id", year.id),
    supabase.from("annual_calendars").select("*").eq("academic_year_id", year.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("exam_windows").select("*").eq("academic_year_id", year.id).order("start_date", { ascending: true }),
    supabase.from("events").select("*").eq("academic_year_id", year.id).order("start_date", { ascending: true }),
    supabase.from("ai_runs").select("*").eq("year_id", year.id).order("created_at", { ascending: false }).limit(20),
  ]);

  return {
    memberships,
    orgIds,
    year,
    capacity: capacityRes.data,
    subjects: subjectsRes.data ?? [],
    curricula: curriculaRes.data ?? [],
    calendars: calendarsRes.data ?? [],
    exams: examsRes.data ?? [],
    events: eventsRes.data ?? [],
    aiRuns: runsRes.data ?? [],
  };
}

function buildDashboard(ctx: any) {
  if (!ctx.year) {
    return {
      year: null,
      metrics: [],
      alerts: [],
      upcomingExams: [],
      upcomingEvents: [],
      teacherInterventions: [],
      readiness: { revision: 0, exam: 0, homework: 0, attendance: 0 },
    };
  }

  const subjects = asArray(ctx.subjects);
  const curricula = asArray(ctx.curricula);
  const aiRuns = asArray(ctx.aiRuns);
  const generatedSubjects = new Set(curricula.map((c: any) => `${c.grade}|${c.subject}`));
  const totalSubjects = Math.max(subjects.length, 1);
  const completion = clamp((generatedSubjects.size / totalSubjects) * 100);
  const capacity = ctx.capacity ?? {};
  const teachingDays = Number(capacity.t_available ?? capacity.teaching_days ?? 0);
  const totalDays = Number(capacity.total_days ?? 365);
  const utilization = totalDays > 0 ? clamp((teachingDays / totalDays) * 100) : 0;
  const failedRuns = aiRuns.filter((r: any) => r.status === "error").length;
  const successRuns = aiRuns.filter((r: any) => r.status === "success").length;
  const aiReliability = aiRuns.length ? clamp((successRuns / aiRuns.length) * 100) : 100;
  const behind = subjects.filter((s: any) => !generatedSubjects.has(`${s.grade}|${s.subject}`));
  const teacherMap = new Map<string, number>();
  for (const row of behind) {
    const teacher = row.teacher_name || "Unassigned";
    teacherMap.set(teacher, (teacherMap.get(teacher) ?? 0) + 1);
  }
  const teacherInterventions = [...teacherMap.entries()]
    .map(([teacher, count]) => ({ teacher, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const health = clamp((completion * 0.45) + (utilization * 0.25) + (aiReliability * 0.2) + ((behind.length ? 70 : 100) * 0.1));
  const alerts = [
    ...(behind.length ? [{ level: "warning", title: "Curriculum generation pending", body: `${behind.length} grade-subject rows still need a generated plan.` }] : []),
    ...(failedRuns ? [{ level: "warning", title: "AI generation errors", body: `${failedRuns} recent AI runs failed and may need review.` }] : []),
    ...(utilization < 60 ? [{ level: "critical", title: "Low teaching-day utilization", body: "Available teaching days are low compared with the full year." }] : []),
  ];

  return {
    year: ctx.year,
    metrics: [
      { label: "Academic Health Score", value: health, suffix: "/100", tone: health >= 80 ? "good" : health >= 60 ? "watch" : "risk" },
      { label: "Syllabus Completion", value: completion, suffix: "%", tone: completion >= 80 ? "good" : completion >= 50 ? "watch" : "risk" },
      { label: "Classes Behind", value: behind.length, suffix: "", tone: behind.length ? "watch" : "good" },
      { label: "AI Reliability", value: aiReliability, suffix: "%", tone: aiReliability >= 90 ? "good" : "watch" },
    ],
    alerts,
    upcomingExams: asArray(ctx.exams).slice(0, 5),
    upcomingEvents: asArray(ctx.events).slice(0, 5),
    teacherInterventions,
    readiness: {
      revision: clamp(completion - 10),
      exam: clamp((completion * 0.7) + (utilization * 0.3)),
      homework: clamp(70 - behind.length * 4, 10, 95),
      attendance: 82,
    },
  };
}

async function aiProviderDraft(data: z.infer<typeof draftInput>, ctx: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  const modelId = process.env.OPENAI_MODEL;
  if (!apiKey || !modelId) return null;

  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const { generateText } = await import("ai");
  const provider = createOpenAICompatible({
    name: "curriculumos-v2",
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKey,
  });
  const school = ctx?.year?.schools?.name ?? "the school";
  const subjectLine = [data.grade, data.subject].filter(Boolean).join(" - ") || "the selected class";
  const system = [
    "You are CurriculumOS V2, an academic operations assistant for K-12 schools.",
    "Generate practical, editable content for school leaders and teachers.",
    "Do not invent official board predictions. Keep all outputs reviewable by humans before export.",
    "Use clear headings, concise bullets, and include teacher/principal review notes where useful.",
  ].join(" ");
  const prompt = [
    "School: " + school,
    "Module: " + data.module,
    "Resource: " + data.resource_type,
    "Target: " + subjectLine,
    "Request: " + data.prompt,
    "",
    "Return editable plain text. Avoid markdown tables unless essential.",
  ].join("\n");
  const result = await generateText({ model: provider.chatModel(modelId), system, prompt });
  return {
    title: data.resource_type + " for " + subjectLine,
    content: result.text,
    provider: "openai_compatible",
    notice: "Generated with the configured OpenAI-compatible provider. Review before export or sharing.",
  };
}

function offlineDraft(data: z.infer<typeof draftInput>, ctx: any) {
  const school = ctx?.year?.schools?.name ?? "your school";
  const subjectLine = [data.grade, data.subject].filter(Boolean).join(" - ") || "selected class";
  const heading = `${data.resource_type} for ${subjectLine}`;

  const byModule: Record<string, string[]> = {
    principal_dashboard: [
      `Executive brief for ${school}`,
      `Current focus: ${data.prompt}`,
      "1. Review classes without generated curriculum plans.",
      "2. Prioritize teachers with multiple pending grade-subject rows.",
      "3. Check upcoming exams/events against revision buffer.",
      "4. Schedule a weekly leadership review until risk indicators are green.",
    ],
    teacher_copilot: [
      heading,
      `Objective: ${data.prompt}`,
      "Teaching strategy: begin with retrieval practice, introduce one worked example, then run guided practice in pairs.",
      "Classroom activity: 10-minute diagnostic, 20-minute concept build, 15-minute application task, 5-minute exit ticket.",
      "Homework: 8 mixed questions, 2 reflection prompts, and one extension task for advanced learners.",
      "Differentiation: provide scaffolded examples for support learners and open-ended challenge questions for high performers.",
    ],
    content_studio: [
      heading,
      "Editable resource draft",
      `Topic/request: ${data.prompt}`,
      "Section A: Key concepts and definitions",
      "Section B: Practice tasks from simple to challenging",
      "Section C: Reflection/check-for-understanding prompts",
      "Answer key: add or revise answers before export.",
    ],
    assessment_generator: [
      heading,
      `Assessment brief: ${data.prompt}`,
      "Instructions: answer all questions unless marked optional.",
      "Section A: Knowledge and understanding",
      "Section B: Application-based questions",
      "Section C: Higher-order/Bloom analysis questions",
      "Teacher review checklist: marks total, duration, syllabus coverage, difficulty balance, answer key.",
    ],
  };

  return {
    title: heading,
    content: (byModule[data.module] ?? byModule.content_studio).join("\n\n"),
    provider: "offline_template",
    notice: "AI provider is not configured yet. This editable draft used the local Phase 1 template engine.",
  };
}

async function saveOutput(supabase: any, userId: string, data: z.infer<typeof saveInput>) {
  const db = supabase as any;
  const ctx = await loadV2Context(supabase, userId, data.year_id);
  const orgId = ctx.year?.org_id ?? ctx.orgIds[0];
  const payload = {
    org_id: orgId,
    year_id: data.year_id ?? null,
    user_id: userId,
    module: data.module,
    resource_type: data.resource_type,
    title: data.title,
    content: data.content,
    grade: data.grade ?? null,
    subject: data.subject ?? null,
    params: data.params ?? {},
    status: "draft",
    updated_at: new Date().toISOString(),
  };

  if (data.id) {
    const { data: row, error } = await db
      .from("v2_ai_outputs")
      .update(payload)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await db.from("v2_ai_output_edits").insert({ output_id: data.id, user_id: userId, edit_summary: "Manual edit saved" });
    return row;
  }

  const { data: row, error } = await db.from("v2_ai_outputs").insert(payload).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return row;
}

export const getV2PrincipalDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const ctx = await loadV2Context(context.supabase, context.userId);
    return buildDashboard(ctx);
  });

export const listV2Outputs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => listInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const memberships = await getMembership(context.supabase, context.userId);
    const orgIds = memberships.map((m: any) => m.org_id).filter(Boolean);
    const db = context.supabase as any;
    let query = db
      .from("v2_ai_outputs")
      .select("*")
      .in("org_id", orgIds)
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (data.module) query = query.eq("module", data.module);
    const { data: rows, error } = await query;
    if (error) return { missingTable: true, rows: [], message: error.message };
    return { rows: rows ?? [], missingTable: false };
  });

export const generateV2Draft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => draftInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const ctx = await loadV2Context(context.supabase, context.userId, data.year_id);
    let draft = offlineDraft(data, ctx);
    try {
      draft = (await aiProviderDraft(data, ctx)) ?? draft;
    } catch (e: any) {
      draft = { ...draft, notice: `AI provider error: ${e?.message ?? "unknown"}. Showing editable local draft instead.` };
    }
    let saved = null;
    if (data.save) {
      try {
        saved = await saveOutput(context.supabase, context.userId, {
          module: data.module,
          year_id: data.year_id ?? null,
          resource_type: data.resource_type,
          title: draft.title,
          content: draft.content,
          grade: data.grade ?? null,
          subject: data.subject ?? null,
          params: { ...data.params, prompt: data.prompt, provider: draft.provider },
        });
      } catch (e: any) {
        return { ...draft, saved: null, saveError: e.message };
      }
    }
    return { ...draft, saved };
  });

export const saveV2Output = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => saveInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    return saveOutput(context.supabase, context.userId, data);
  });



