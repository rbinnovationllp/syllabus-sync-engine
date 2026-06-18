import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireActiveSubscription } from "@/lib/subscription-gate";
import { AI_ACTION_COSTS, tierForPriceId, planForTier, type AiAction } from "@/lib/plans";
import { DEFAULT_MODEL, type AllowedModel } from "@/lib/ai-policy";

// Legacy label kept for backward-compat in stored meta. Real model used per-run
// is resolved by the policy layer (resolveTenantModel + runAiWithFallback).
const MODEL: AllowedModel = DEFAULT_MODEL;

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
  // Authorize: caller must belong to the org that owns this year
  const { data: membership } = await supabaseAdmin
    .from("org_members")
    .select("user_id")
    .eq("org_id", yearRes.data.org_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) throw new Error("Academic year not found");
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
  opts: { orgId?: string | null; lowConfidence?: (out: T) => boolean } = {},
): Promise<{ output: T; runId?: string; modelUsed: AllowedModel; escalated: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runAiWithFallback } = await import("@/lib/ai-policy.server");
  const r = await runAiWithFallback(supabaseAdmin, {
    system,
    prompt,
    schema,
    options: { orgId: opts.orgId ?? null },
    lowConfidence: opts.lowConfidence,
  });
  return { output: r.output, runId: r.runId, modelUsed: r.modelUsed, escalated: r.escalated };
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

async function refundCredits(supabaseAdmin: any, userId: string, amount: number) {
  if (!amount || amount <= 0) return;
  await supabaseAdmin.rpc("refund_ai_credits", {
    _user_id: userId,
    _amount: amount,
    _check_env: "live",
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
      await refundCredits(supabaseAdmin, userId, cost);
      return { error: "LOAD_FAILED" as const, message: e.message };
    }

    const system = `You are CurriculumOS, an expert academic planner for K-12 schools. Build month-by-month annual plans that:
- Never exceed the available teaching days for any month.
- Respect board-specific syllabus depth (CBSE/ICSE/IB/Cambridge/State/US/UK).
- Distribute tough topics with easy/medium recovery weeks in between.
- Reserve revision time before each exam window.
- Preserve a syllabus-completion buffer of 30 days (grades 1-8), 45 days (9-10), or 60 days (11-12) before the final exam.
- Respect the school day window (start, end, lunch) — never recommend periods outside it.
- For senior grades (9-12) with an extra-class window, place only remedial/board-prep work there, never core teaching that disturbs the regular school day.
- Honor per-subject weekday assignments so alternate-day subjects in senior grades land on the right days.
- Treat co-curricular rows (Sports, Music, Art, etc.) as protected periods — schedule them but do not allocate syllabus chapters to them.
Return strictly the requested JSON schema, no prose outside it.`;

    const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const extras = Object.entries((ctx.year as any).senior_extra_classes ?? {})
      .filter(([, v]: any) => v?.enabled)
      .map(([g, v]: any) => `Grade ${g}: ${v.start_time}-${v.end_time}`)
      .join("; ") || "none";

    const prompt = `School: ${ctx.year.schools?.name} (${ctx.year.schools?.country}, board: ${ctx.year.schools?.board})
Academic year: ${ctx.year.label} (${ctx.year.start_date} → ${ctx.year.end_date})
Working days/week: ${ctx.year.working_days_per_week}, periods/day: ${ctx.year.periods_per_day}, period mins: ${ctx.year.period_duration_minutes ?? 40}
School day: ${(ctx.year as any).school_start_time ?? "?"} – ${(ctx.year as any).school_end_time ?? "?"} (lunch ${(ctx.year as any).lunch_start_time ?? "?"}–${(ctx.year as any).lunch_end_time ?? "?"})
Senior extra-class windows: ${extras}
Capacity: ${ctx.capacity?.t_available ?? "?"} teaching days available.
Grades & subjects:
${ctx.gradeSubjects.map((g: any) => `  - Grade ${g.grade} · ${g.subject} [${g.kind ?? "core"}] → ${g.periods_per_week} pds/wk on ${(g.weekdays ?? [1,2,3,4,5]).map((d: number) => DOW[d]).join("/")}${g.teacher_name ? ` (teacher: ${g.teacher_name})` : ""}`).join("\n")}
Holidays: ${ctx.holidays.length}, Vacations: ${ctx.vacations.length}, Exam windows: ${ctx.exams.length}, Events: ${ctx.events.length}, Training days: ${ctx.training.length}
Build a 12-month plan covering ${ctx.year.start_date} → ${ctx.year.end_date}.`;

    let output;
    let runId: string | undefined;
    let modelUsed: AllowedModel = MODEL;
    let escalated = false;
    try {
      const r = await runAi(prompt, system, calendarSchema, {
        orgId: ctx.year.org_id,
        // Escalate when AI emitted >=3 warnings, suggesting confidence is low.
        lowConfidence: (o: any) => Array.isArray(o?.warnings) && o.warnings.length >= 3,
      });
      output = r.output;
      runId = r.runId;
      modelUsed = r.modelUsed;
      escalated = r.escalated;
    } catch (e: any) {
      await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_annual_calendar", creditsSpent: cost, status: "error", error: e.message, runId });
      await refundCredits(supabaseAdmin, userId, cost);
      return { error: "AI_FAILED" as const, message: e.message };
    }

    await supabaseAdmin
      .from("annual_calendars")
      .upsert(
        { year_id: data.year_id, user_id: userId, plan: output, meta: { model: modelUsed, escalated, generated_at: new Date().toISOString() } },
        { onConflict: "year_id" },
      );
    await supabaseAdmin.rpc("append_curriculum_version", {
      _year_id: data.year_id,
      _entity_type: "annual_calendar",
      _grade: null as unknown as string,
      _subject: null as unknown as string,
      _payload: output as any,
      _meta: { model: modelUsed, escalated, generated_at: new Date().toISOString() },
      _diff_summary: "Generated annual calendar",
      _source: "generation",
      _created_by: userId,
    });
    await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_annual_calendar", creditsSpent: cost, status: "success", runId, details: { model: modelUsed, escalated } });
    return { ok: true as const, plan: output, model: modelUsed, escalated };
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
    const isFreePreview = !gate.ok;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Free-trial gating: unpaid users may generate ONE 30-day preview for ONE subject, total.
    if (isFreePreview) {
      const { count } = await supabaseAdmin
        .from("subject_curricula")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) >= 1) {
        return {
          error: "PAID_PLAN_REQUIRED" as const,
          message:
            "Your free 30-day preview has been used. Subscribe to your category to unlock the full annual curriculum for every subject.",
        };
      }
    }

    // Only charge AI credits for paid runs; free previews don't consume credits.
    let cost = 0;
    if (!isFreePreview) {
      const quota = await getMonthlyQuota(supabaseAdmin, userId);
      cost = AI_ACTION_COSTS.generate_subject_curriculum;
      const { data: spent, error: rpcErr } = await supabaseAdmin.rpc("consume_ai_credits", {
        _user_id: userId, _cost: cost, _monthly_quota: quota, _check_env: "live",
      });
      if (rpcErr) return { error: "CREDITS_ERROR" as const, message: rpcErr.message };
      if (spent === null) return { error: "INSUFFICIENT_CREDITS" as const };
    }

    let ctx;
    try {
      ctx = await loadContext(supabaseAdmin, userId, data.year_id);
    } catch (e: any) {
      await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_subject_curriculum", creditsSpent: cost, status: "error", error: e.message });
      if (cost > 0) await refundCredits(supabaseAdmin, userId, cost);
      return { error: "LOAD_FAILED" as const, message: e.message };
    }
    const gs = ctx.gradeSubjects.find((g: any) => String(g.grade) === data.grade && g.subject.toLowerCase() === data.subject.toLowerCase());
    if (!gs) return { error: "SUBJECT_NOT_FOUND" as const };
    const books = ctx.textbooks.filter((b: any) => String(b.grade) === data.grade && b.subject?.toLowerCase() === data.subject.toLowerCase());

    // Capacity sizing: preview = ~30 days from today; paid = remaining session days.
    const today = new Date();
    const yearEnd = new Date(ctx.year.end_date);
    const previewEnd = new Date(today);
    previewEnd.setDate(previewEnd.getDate() + 30);
    const previewWindowEnd = previewEnd < yearEnd ? previewEnd : yearEnd;
    const windowDays = isFreePreview
      ? Math.max(1, Math.ceil((previewWindowEnd.getTime() - today.getTime()) / 86_400_000))
      : (ctx.capacity?.t_available ?? 180);
    const weeks = Math.max(1, Math.floor(windowDays / Math.max(1, ctx.year.working_days_per_week)));
    const totalPeriods = Math.max(1, weeks * gs.periods_per_week);

    const completedNote = gs.completed_chapters
      ? `Chapters ALREADY COMPLETED by the teacher (do NOT repeat these — start the plan from the next logical chapter): ${gs.completed_chapters}`
      : `No chapters have been completed yet — start from the first chapter.`;

    const previewClause = isFreePreview
      ? `This is a FREE 30-day preview. Plan ONLY the next ${windowDays} calendar days (~${weeks} teaching weeks) of lessons starting today (${today.toISOString().slice(0,10)}). Limit chapter count to fit this window. Add a final summary note: "Subscribe to your category plan to unlock the full annual curriculum."`
      : `Plan the FULL remaining session (${ctx.year.start_date} → ${ctx.year.end_date}).`;

    const system = `You are CurriculumOS, a senior academic coordinator. Produce a chapter-by-chapter teaching plan for ONE grade-subject that:
- Fits within total_periods AND leaves a buffer of ~15% for revision/recovery.
- Tags each chapter difficulty (simple/medium/tough). Avoid placing two 'tough' chapters in consecutive weeks.
- Aligns with the board (${ctx.year.schools?.board}) and the listed textbooks if any.
- Sequences foundation chapters before dependent ones.
- Respects any "already completed" chapters listed by the teacher and continues from the next chapter.
Return strictly the JSON schema; no extra prose.`;

    const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const weekdaysLabel = (gs.weekdays ?? [1,2,3,4,5]).map((d: number) => DOW[d]).join("/");
    const seniorWin = ((ctx.year as any).senior_extra_classes ?? {})[data.grade];
    const seniorClause = seniorWin?.enabled
      ? `Extra-class window for Grade ${data.grade}: ${seniorWin.start_time}-${seniorWin.end_time}. Only put remedial/board-prep work in this window; never disturb the regular school day.`
      : "";

    const prompt = `School: ${ctx.year.schools?.name} | Board: ${ctx.year.schools?.board} | Country: ${ctx.year.schools?.country}
Grade ${data.grade} · ${data.subject} [${gs.kind ?? "core"}]
Periods/week: ${gs.periods_per_week} on ${weekdaysLabel} | Total weeks available: ${weeks} | Total periods: ${totalPeriods}
School day: ${(ctx.year as any).school_start_time ?? "?"} – ${(ctx.year as any).school_end_time ?? "?"} (lunch ${(ctx.year as any).lunch_start_time ?? "?"}–${(ctx.year as any).lunch_end_time ?? "?"})
${seniorClause}
Textbooks: ${books.length === 0 ? "(none specified — choose board-appropriate canonical chapter list)" : books.map((b: any) => `${b.book_name ?? b.title} by ${b.author} (${b.publisher}, ${b.edition_year})`).join("; ")}
Year window: ${ctx.year.start_date} → ${ctx.year.end_date}.
${completedNote}
${previewClause}`;

    let output, runId, modelUsed: AllowedModel = MODEL, escalated = false;
    try {
      const r = await runAi(prompt, system, curriculumSchema, {
        orgId: ctx.year.org_id,
        lowConfidence: (o: any) => Array.isArray(o?.warnings) && o.warnings.length >= 3,
      });
      output = r.output; runId = r.runId; modelUsed = r.modelUsed; escalated = r.escalated;
    } catch (e: any) {
      await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_subject_curriculum", creditsSpent: cost, status: "error", error: e.message, runId });
      if (cost > 0) await refundCredits(supabaseAdmin, userId, cost);
      return { error: "AI_FAILED" as const, message: e.message };
    }

    await supabaseAdmin
      .from("subject_curricula")
      .upsert(
        {
          year_id: data.year_id,
          user_id: userId,
          grade: data.grade,
          subject: data.subject,
          chapters: output.chapters,
          meta: {
            model: modelUsed,
            escalated,
            summary: output.summary,
            total_periods: output.total_periods,
            buffer_periods: output.buffer_periods,
            warnings: output.warnings,
            generated_at: new Date().toISOString(),
            preview: isFreePreview,
            preview_window_days: isFreePreview ? windowDays : null,
            completed_chapters: gs.completed_chapters ?? null,
          },
        },
        { onConflict: "year_id,grade,subject" },
      );
    await supabaseAdmin.rpc("append_curriculum_version", {
      _year_id: data.year_id,
      _entity_type: "subject_curriculum",
      _grade: data.grade,
      _subject: data.subject,
      _payload: { chapters: output.chapters, summary: output.summary } as any,
      _meta: { model: modelUsed, escalated, total_periods: output.total_periods, buffer_periods: output.buffer_periods, preview: isFreePreview },
      _diff_summary: isFreePreview ? "30-day preview generated" : "Generated subject curriculum",
      _source: "generation",
      _created_by: userId,
    });
    await logRun(supabaseAdmin, { userId, yearId: data.year_id, action: "generate_subject_curriculum", creditsSpent: cost, status: "success", runId, details: { grade: data.grade, subject: data.subject, preview: isFreePreview, model: modelUsed, escalated } });
    return { ok: true as const, preview: isFreePreview, preview_window_days: isFreePreview ? windowDays : null, model: modelUsed, escalated, ...output };
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
      await refundCredits(supabaseAdmin, userId, cost);
      return { error: "AI_FAILED" as const, message: e.message };
    }

    await supabaseAdmin
      .from("annual_calendars")
      .upsert(
        { year_id: data.year_id, user_id: userId, plan: output, meta: { model: MODEL, recalibrated_at: new Date().toISOString(), disruption: data.disruption } },
        { onConflict: "year_id" },
      );
    await supabaseAdmin.rpc("append_curriculum_version", {
      _year_id: data.year_id,
      _entity_type: "annual_calendar",
      _grade: null as unknown as string,
      _subject: null as unknown as string,
      _payload: output as any,
      _meta: { model: MODEL, recalibrated_at: new Date().toISOString(), disruption: data.disruption },
      _diff_summary: `Recalibrated: ${data.disruption.slice(0, 120)}`,
      _source: "recalibration",
      _created_by: userId,
    });
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
      supabase.from("subject_curricula").select("*").eq("year_id", data.year_id).is("deleted_at", null).order("grade").order("subject"),
    ]);
    return {
      calendar: calendar.data ?? null,
      curricula: curricula.data ?? [],
      hasSubscription: (await requireActiveSubscription(supabase, userId)).ok,
    };
  });

export const listAiRunsForYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => yearInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ai_runs")
      .select("id, action, status, credits_spent, error, lovable_run_id, details, created_at")
      .eq("year_id", data.year_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getAiCreditBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const quota = await getMonthlyQuota(supabaseAdmin, userId);
    const { data, error } = await supabaseAdmin.rpc("get_ai_credit_balance", {
      _user_id: userId,
      _monthly_quota: quota,
      _check_env: "live",
    });
    if (error) throw new Error(error.message);
    return data as {
      monthly_quota: number;
      monthly_used: number;
      monthly_remaining: number;
      grant_remaining: number;
      total_remaining: number;
    };
  });
