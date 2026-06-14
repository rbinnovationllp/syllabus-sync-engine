import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireActiveSubscription } from "@/lib/subscription-gate";
import { AI_ACTION_COSTS, tierForPriceId, planForTier, type AiAction } from "@/lib/plans";

const MODEL = "google/gemini-3-flash-preview";

// ---------- Zod schemas for structured AI output ----------
const calendarSchema = z.object({
  months: z.array(
    z.object({
      month: z.string().describe("YYYY-MM, e.g. 2026-04"),
      label: z.string().describe("Human-readable month name"),
      teaching_days: z.number().int().min(0),
      focus_topics: z.array(z.string()).max(8),
      assessments: z.array(z.string()).max(6),
      events: z.array(z.string()).max(6),
      notes: z.string().max(400).optional(),
    }),
  ),
  summary: z.string().max(800),
  warnings: z.array(z.string()).max(8).optional(),
});

const curriculumSchema = z.object({
  chapters: z.array(
    z.object({
      seq: z.number().int().min(1),
      title: z.string().max(200),
      week_no: z.number().int().min(1),
      periods: z.number().int().min(1).max(60),
      difficulty: z.enum(["simple", "medium", "tough"]),
      objectives: z.array(z.string()).max(6),
      assessment: z.string().max(200).optional(),
      notes: z.string().max(500).optional(),
    }),
  ),
  total_periods: z.number().int().min(0),
  buffer_periods: z.number().int().min(0),
  summary: z.string().max(800),
  warnings: z.array(z.string()).max(8).optional(),
});

// ---------- Helpers ----------
async function loadContext(
  supabaseAdmin: any,
  userId: string,
  yearId: string,
) {
  const [yearRes, capRes, gsRes, holidaysRes, vacRes, examsRes, eventsRes, trainingRes, booksRes] =
    await Promise.all([
      supabaseAdmin
        .from("academic_years")
        .select("*, schools(name,country,board,fee_tier,city,state)")
        .eq("id", yearId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("capacity_results")
        .select("*")
        .eq("academic_year_id", yearId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from("grade_subjects").select("*").eq("academic_year_id", yearId),
      supabaseAdmin.from("holidays").select("*").eq("academic_year_id", yearId),
      supabaseAdmin.from("vacation_breaks").select("*").eq("academic_year_id", yearId),
      supabaseAdmin.from("exam_windows").select("*").eq("academic_year_id", yearId),
      supabaseAdmin.from("events").select("*").eq("academic_year_id", yearId),
      supabaseAdmin.from("training_days").select("*").eq("academic_year_id", yearId),
      supabaseAdmin.from("textbooks_input").select("*").eq("academic_year_id", yearId),
    ]);
  if (!yearRes.data) throw new Error("Academic year not found");
  return {
    year: yearRes.data,
    capacity: capRes.data,
    gradeSubjects: gsRes.data ?? [],
    holidays: holidaysRes.data ?? [],
    vacations: vacRes.data ?? [],
    exams: examsRes.data ?? [],
    events: eventsRes.data ?? [],
    training: trainingRes.data ?? [],
    textbooks: booksRes.data ?? [],
  };
}

async function getMonthlyQuota(supabaseAdmin: any, userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("price_id, status, current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return 0;
  const plan = planForTier(tierForPriceId(data.price_id));
  return plan?.limits.aiCreditsPerMonth ?? 0;
}

async function runAi<T>(
  prompt: string,
  system: string,
  schema: z.ZodSchema<T>,
): Promise<{ output: T; runId?: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI gateway not configured");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(key);
  const { experimental_output } = await generateText({
    model: gateway(MODEL),
    system,
    prompt,
    experimental_output: Output.object({ schema }),
  });
  return { output: experimental_output, runId: gateway.getRunId() };
}

async function logRun(
  supabaseAdmin: any,
  args: {
    userId: string;
    yearId: string | null;
    action: AiAction;
    creditsSpent: number;
    status: "success" | "error";
    error?: string;
    runId?: string;
    details?: Record<string, unknown>;
  },
) {
  await supabaseAdmin.from("ai_runs").insert({
    user_id: args.userId,
    year_id: args.yearId,
    action: args.action,
    credits_spent: args.creditsSpent,
    status: args.status,
    error: args.error ?? null,
    lovable_run_id: args.runId ?? null,
    details: args.details ?? {},
  });
}

// ---------- Server fns ----------
const yearInput = z.object({ year_id: z.string().uuid() });

export const generateAnnualCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => yearInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const gate = await requireActiveSubscription(supabase, userId);
    if (!gate.ok) return { error: "PAID_PLAN_REQUIRED" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const quota = await getMonthlyQuota(supabaseAdmin, userId);
    const cost = AI_ACTION_COSTS.generate_annual_calendar;
    const { data: spent, error: rpcErr } = await supabaseAdmin.rpc("consume_ai_credits", {
      _user_id: userId,
      _cost: cost,
      _monthly_quota: quota,
      _check_env: "live",
    });
    if (rpcErr) return { error: "CREDITS_ERROR" as const, message: rpcErr.message };
    if (spent === null) return { error: "INSUFFICIENT_CREDITS" as const };

    let ctx;
    try {
      ctx = await loadContext(supabaseAdmin, userId, data.year_id);
    } catch (e: any) {
      await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_annual_calendar", creditsSpent: cost, status: "error", error: e.message });
      return { error: "LOAD_FAILED" as const, message: e.message };
    }

    const system = `You are CurriculumOS, an expert academic planner for K-12 schools. Build month-by-month annual plans that:
- Never exceed the available teaching days for any month.
- Respect board-specific syllabus depth (CBSE/ICSE/IB/Cambridge/State/US/UK).
- Distribute tough topics with easy/medium recovery weeks in between.
- Reserve revision time before each exam window.
- Preserve a syllabus-completion buffer of 30 days (grades 1-8), 45 days (9-10), or 60 days (11-12) before the final exam.
Return strictly the requested JSON schema, no prose outside it.`;

    const prompt = `School: ${ctx.year.schools?.name} (${ctx.year.schools?.country}, board: ${ctx.year.schools?.board})
Academic year: ${ctx.year.label} (${ctx.year.start_date} → ${ctx.year.end_date})
Working days/week: ${ctx.year.working_days_per_week}, periods/day: ${ctx.year.periods_per_day}, period mins: ${ctx.year.period_duration_minutes ?? 40}
Capacity: ${ctx.capacity?.t_available ?? "?"} teaching days available.
Grades & subjects (with periods/week):
${ctx.gradeSubjects.map((g: any) => `  - Grade ${g.grade} · ${g.subject} → ${g.periods_per_week} pds/wk${g.teacher_name ? ` (teacher: ${g.teacher_name})` : ""}`).join("\n")}
Holidays: ${ctx.holidays.length}, Vacations: ${ctx.vacations.length}, Exam windows: ${ctx.exams.length}, Events: ${ctx.events.length}, Training days: ${ctx.training.length}
Build a 12-month plan covering ${ctx.year.start_date} → ${ctx.year.end_date}.`;

    let output;
    let runId: string | undefined;
    try {
      const r = await runAi(prompt, system, calendarSchema);
      output = r.output;
      runId = r.runId;
    } catch (e: any) {
      await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_annual_calendar", creditsSpent: cost, status: "error", error: e.message, runId });
      return { error: "AI_FAILED" as const, message: e.message };
    }

    await supabaseAdmin
      .from("annual_calendars")
      .upsert(
        { year_id: data.year_id, user_id: userId, plan: output, meta: { model: MODEL, generated_at: new Date().toISOString() } },
        { onConflict: "year_id" },
      );
    await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_annual_calendar", creditsSpent: cost, status: "success", runId });
    return { ok: true as const, plan: output };
  });

const subjectInput = z.object({
  year_id: z.string().uuid(),
  grade: z.string().min(1).max(8),
  subject: z.string().min(1).max(120),
});

export const generateSubjectCurriculum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => subjectInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const gate = await requireActiveSubscription(supabase, userId);
    if (!gate.ok) return { error: "PAID_PLAN_REQUIRED" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const quota = await getMonthlyQuota(supabaseAdmin, userId);
    const cost = AI_ACTION_COSTS.generate_subject_curriculum;
    const { data: spent, error: rpcErr } = await supabaseAdmin.rpc("consume_ai_credits", {
      _user_id: userId, _cost: cost, _monthly_quota: quota, _check_env: "live",
    });
    if (rpcErr) return { error: "CREDITS_ERROR" as const, message: rpcErr.message };
    if (spent === null) return { error: "INSUFFICIENT_CREDITS" as const };

    let ctx;
    try {
      ctx = await loadContext(supabaseAdmin, userId, data.year_id);
    } catch (e: any) {
      await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_subject_curriculum", creditsSpent: cost, status: "error", error: e.message });
      return { error: "LOAD_FAILED" as const, message: e.message };
    }
    const gs = ctx.gradeSubjects.find((g: any) => String(g.grade) === data.grade && g.subject.toLowerCase() === data.subject.toLowerCase());
    if (!gs) return { error: "SUBJECT_NOT_FOUND" as const };
    const books = ctx.textbooks.filter((b: any) => String(b.grade) === data.grade && b.subject?.toLowerCase() === data.subject.toLowerCase());
    const weeks = Math.max(1, Math.floor((ctx.capacity?.t_available ?? 180) / Math.max(1, ctx.year.working_days_per_week)));
    const totalPeriods = weeks * gs.periods_per_week;

    const system = `You are CurriculumOS, a senior academic coordinator. Produce a chapter-by-chapter teaching plan for ONE grade-subject that:
- Fits within total_periods AND leaves a buffer of ~15% for revision/recovery.
- Tags each chapter difficulty (simple/medium/tough). Avoid placing two 'tough' chapters in consecutive weeks.
- Aligns with the board (${ctx.year.schools?.board}) and the listed textbooks if any.
- Sequences foundation chapters before dependent ones.
Return strictly the JSON schema; no extra prose.`;

    const prompt = `School: ${ctx.year.schools?.name} | Board: ${ctx.year.schools?.board} | Country: ${ctx.year.schools?.country}
Grade ${data.grade} · ${data.subject}
Periods/week: ${gs.periods_per_week} | Total weeks available: ${weeks} | Total periods: ${totalPeriods}
Textbooks: ${books.length === 0 ? "(none specified — choose board-appropriate canonical chapter list)" : books.map((b: any) => `${b.book_name} by ${b.author} (${b.publisher}, ${b.edition_year})`).join("; ")}
Year window: ${ctx.year.start_date} → ${ctx.year.end_date}.`;

    let output, runId;
    try {
      const r = await runAi(prompt, system, curriculumSchema);
      output = r.output; runId = r.runId;
    } catch (e: any) {
      await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_subject_curriculum", creditsSpent: cost, status: "error", error: e.message, runId });
      return { error: "AI_FAILED" as const, message: e.message };
    }

    await supabaseAdmin
      .from("subject_curricula")
      .upsert(
        { year_id: data.year_id, user_id: userId, grade: data.grade, subject: data.subject, chapters: output.chapters, meta: { model: MODEL, summary: output.summary, total_periods: output.total_periods, buffer_periods: output.buffer_periods, warnings: output.warnings, generated_at: new Date().toISOString() } },
        { onConflict: "year_id,grade,subject" },
      );
    await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_subject_curriculum", creditsSpent: cost, status: "success", runId, details: { grade: data.grade, subject: data.subject } });
    return { ok: true as const, ...output };
  });

const recalcInput = z.object({
  year_id: z.string().uuid(),
  disruption: z.string().min(3).max(500),
});

export const recalculateSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => recalcInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const gate = await requireActiveSubscription(supabase, userId);
    if (!gate.ok) return { error: "PAID_PLAN_REQUIRED" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const quota = await getMonthlyQuota(supabaseAdmin, userId);
    const cost = AI_ACTION_COSTS.recalculate_schedule;
    const { data: spent, error: rpcErr } = await supabaseAdmin.rpc("consume_ai_credits", {
      _user_id: userId, _cost: cost, _monthly_quota: quota, _check_env: "live",
    });
    if (rpcErr) return { error: "CREDITS_ERROR" as const, message: rpcErr.message };
    if (spent === null) return { error: "INSUFFICIENT_CREDITS" as const };

    const ctx = await loadContext(supabaseAdmin, userId, data.year_id);
    const { data: existing } = await supabaseAdmin
      .from("annual_calendars").select("plan").eq("year_id", data.year_id).maybeSingle();

    const system = `You are CurriculumOS recalibration engine. Given an existing annual plan and a disruption, output a revised 12-month plan that:
1) Compresses easy/medium chapters.
2) Protects tough chapters and revision windows.
3) Converts supplementary content into self-study.
4) Preserves syllabus-completion buffers (30/45/60 days for grade bands 1-8 / 9-10 / 11-12).
Return strictly the calendar JSON schema.`;
    const prompt = `Disruption: ${data.disruption}
Existing plan: ${JSON.stringify(existing?.plan ?? {}).slice(0, 6000)}
Capacity: ${ctx.capacity?.t_available ?? "?"} teaching days.
Working days/wk: ${ctx.year.working_days_per_week}, periods/day: ${ctx.year.periods_per_day}.
Output a revised month-by-month plan covering ${ctx.year.start_date} → ${ctx.year.end_date}.`;

    let output, runId;
    try {
      const r = await runAi(prompt, system, calendarSchema);
      output = r.output; runId = r.runId;
    } catch (e: any) {
      await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "recalculate_schedule", creditsSpent: cost, status: "error", error: e.message, runId });
      return { error: "AI_FAILED" as const, message: e.message };
    }

    await supabaseAdmin
      .from("annual_calendars")
      .upsert(
        { year_id: data.year_id, user_id: userId, plan: output, meta: { model: MODEL, recalibrated_at: new Date().toISOString(), disruption: data.disruption } },
        { onConflict: "year_id" },
      );
    await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "recalculate_schedule", creditsSpent: cost, status: "success", runId, details: { disruption: data.disruption } });
    return { ok: true as const, plan: output };
  });

// ---------- Read fns ----------
export const getYearArtifacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => yearInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [calendar, curricula] = await Promise.all([
      supabase.from("annual_calendars").select("plan, meta, updated_at").eq("year_id", data.year_id).maybeSingle(),
      supabase.from("subject_curricula").select("*").eq("year_id", data.year_id).order("grade").order("subject"),
    ]);
    return {
      calendar: calendar.data ?? null,
      curricula: curricula.data ?? [],
      hasSubscription: (await requireActiveSubscription(supabase, userId)).ok,
    };
  });
