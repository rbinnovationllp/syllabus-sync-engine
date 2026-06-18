import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_MODEL, type AllowedModel } from "@/lib/ai-policy";

const MODEL: AllowedModel = DEFAULT_MODEL;
const EXCELLENCE_THRESHOLD = 0.85;

const chapterSchema = z.object({
  seq: z.number().int().min(1),
  title: z.string().min(1).max(200),
  week_no: z.number().int().min(1).max(52),
  periods: z.number().int().min(1).max(60),
  difficulty: z.enum(["simple", "medium", "tough"]),
  objectives: z.array(z.string().max(300)).max(8).default([]),
  assessment: z.string().max(300).optional().nullable(),
  notes: z.string().max(600).optional().nullable(),
});

const payloadSchema = z.object({
  chapters: z.array(chapterSchema).max(80),
  total_periods: z.number().int().min(0).optional(),
  summary: z.string().max(800).optional(),
});

const reviewSchema = z.object({
  score: z.number().min(0).max(1),
  verdict: z.enum(["excellent", "acceptable", "low_quality"]),
  fault_lines: z
    .array(
      z.object({
        area: z.string().max(120),
        severity: z.enum(["low", "medium", "high"]),
        explanation: z.string().max(500),
        suggestion: z.string().max(500),
      }),
    )
    .max(12),
  report_markdown: z.string().max(8000),
});

/* ---------------- helpers ---------------- */

async function loadBaseContext(supabase: any, yearId: string, grade: string, subject: string) {
  const [yearRes, capRes, gsRes, booksRes, examsRes, baseVerRes] = await Promise.all([
    supabase.from("academic_years").select("*, schools(name,country,board,fee_tier)").eq("id", yearId).maybeSingle(),
    supabase.from("capacity_results").select("*").eq("academic_year_id", yearId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("grade_subjects").select("*").eq("academic_year_id", yearId).eq("grade", grade).eq("subject", subject).maybeSingle(),
    supabase.from("textbooks_input").select("*").eq("academic_year_id", yearId).eq("grade", grade).eq("subject", subject),
    supabase.from("exam_windows").select("*").eq("academic_year_id", yearId),
    supabase
      .from("curriculum_versions")
      .select("*")
      .eq("year_id", yearId)
      .eq("entity_type", "subject_curriculum")
      .eq("grade", grade)
      .eq("subject", subject)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!yearRes.data) throw new Error("Academic year not found");
  return {
    year: yearRes.data,
    capacity: capRes.data,
    gradeSubject: gsRes.data,
    books: booksRes.data ?? [],
    exams: examsRes.data ?? [],
    baseVersion: baseVerRes.data,
  };
}

/* ---------------- create or fetch open draft ---------------- */

export const openProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        year_id: z.string().uuid(),
        grade: z.string().min(1).max(8),
        subject: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Assignment check — RLS also enforces this on insert, but fail early with a clean message.
    const { data: assignment } = await supabase
      .from("teacher_assignments")
      .select("id,org_id")
      .eq("teacher_user_id", userId)
      .eq("academic_year_id", data.year_id)
      .eq("grade", data.grade)
      .eq("subject", data.subject)
      .maybeSingle();
    if (!assignment) {
      throw new Error("You are not assigned to teach this grade & subject.");
    }

    // Return existing open one if present.
    const { data: existing } = await supabase
      .from("curriculum_edit_proposals")
      .select("*")
      .eq("teacher_id", userId)
      .eq("year_id", data.year_id)
      .eq("grade", data.grade)
      .eq("subject", data.subject)
      .in("status", ["draft", "under_ai_review", "flagged_low_quality"])
      .maybeSingle();
    if (existing) return existing;

    const ctx = await loadBaseContext(supabase, data.year_id, data.grade, data.subject);

    const basePayload =
      (ctx.baseVersion?.payload as any) ?? {
        chapters: [],
        total_periods: 0,
        summary: "",
      };

    const { data: created, error } = await supabase
      .from("curriculum_edit_proposals")
      .insert({
        org_id: assignment.org_id,
        year_id: data.year_id,
        grade: data.grade,
        subject: data.subject,
        teacher_id: userId,
        base_version_id: ctx.baseVersion?.id ?? null,
        title: `Proposal — Grade ${data.grade} ${data.subject}`,
        proposed_payload: basePayload,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

/* ---------------- autosave draft ---------------- */

export const saveProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        proposal_id: z.string().uuid(),
        title: z.string().max(200).optional(),
        diff_summary: z.string().max(2000).optional(),
        proposed_payload: payloadSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("curriculum_edit_proposals")
      .select("teacher_id,status")
      .eq("id", data.proposal_id)
      .maybeSingle();
    if (!row || row.teacher_id !== userId) throw new Error("Not found");
    if (!["draft", "flagged_low_quality"].includes(row.status)) {
      throw new Error("This proposal is locked — its status does not allow edits.");
    }
    const { error } = await supabase
      .from("curriculum_edit_proposals")
      .update({
        title: data.title,
        diff_summary: data.diff_summary,
        proposed_payload: data.proposed_payload,
        // Keep status; if it was flagged and they edit, drop back to draft.
        status: row.status === "flagged_low_quality" ? "draft" : "draft",
      })
      .eq("id", data.proposal_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- submit for AI review ---------------- */

export const submitProposalForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ proposal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: proposal } = await supabase
      .from("curriculum_edit_proposals")
      .select("*")
      .eq("id", data.proposal_id)
      .maybeSingle();
    if (!proposal || proposal.teacher_id !== userId) throw new Error("Not found");
    if (!["draft", "flagged_low_quality"].includes(proposal.status)) {
      throw new Error("Already submitted or finalized.");
    }

    const ctx = await loadBaseContext(supabase, proposal.year_id, proposal.grade, proposal.subject);

    // Consume AI credits (1 unit for review).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const REVIEW_COST = 1;
    const monthlyQuota = 200; // generous default — review is cheap
    const { data: spent, error: rpcErr } = await supabaseAdmin.rpc("consume_ai_credits", {
      _user_id: userId,
      _cost: REVIEW_COST,
      _monthly_quota: monthlyQuota,
      _check_env: "live",
    });
    if (rpcErr) throw new Error(rpcErr.message);
    if (spent === null) throw new Error("You're out of AI credits — top up to run the review.");

    await supabase
      .from("curriculum_edit_proposals")
      .update({ status: "under_ai_review" })
      .eq("id", data.proposal_id);

    const basePayload = (proposal.base_version_id ? ctx.baseVersion?.payload : null) ?? null;
    const proposed = proposal.proposed_payload ?? {};

    const system = `You are a senior academic auditor for K-12 curricula. Evaluate a teacher's PROPOSED curriculum for a single grade & subject against board norms and the school's actual academic capacity.

Rubric (1.00 perfect, 0.00 unusable):
- Syllabus coverage vs. board expectation (CBSE/ICSE/IB/Cambridge/State/US/UK)
- Chapter sequencing & cognitive load (avoid clustering 3+ tough chapters)
- Fits within available teaching days and weekly periods
- Reserves revision time before each exam window
- Honours syllabus-completion buffer: 30d (1-8), 45d (9-10), 60d (11-12)
- Coherence of objectives & assessments

Verdict mapping:
- score >= 0.85 → excellent
- score >= 0.65 → acceptable
- score <  0.65 → low_quality

Return JSON only matching the schema. Be concrete in fault_lines (which chapter, which week, what's wrong, suggested fix).`;

    const prompt = `School: ${ctx.year.schools?.name} (${ctx.year.schools?.country}, board: ${ctx.year.schools?.board})
Year: ${ctx.year.label} (${ctx.year.start_date} → ${ctx.year.end_date})
Working days/wk: ${ctx.year.working_days_per_week}, periods/day: ${ctx.year.periods_per_day}
Available teaching days (capacity engine): ${ctx.capacity?.t_available ?? "unknown"}
Subject: Grade ${proposal.grade} · ${proposal.subject} · ${ctx.gradeSubject?.periods_per_week ?? "?"} periods/week
Textbooks: ${(ctx.books ?? []).map((b: any) => `${b.title}${b.publisher ? ` (${b.publisher})` : ""}${b.edition_year ? ` ed.${b.edition_year}` : ""}`).join("; ") || "none"}
Exam windows: ${(ctx.exams ?? []).map((e: any) => `${e.name}: ${e.start_date}→${e.end_date}`).join("; ") || "none"}

BASE (last AI-generated) curriculum:
${basePayload ? JSON.stringify(basePayload).slice(0, 6000) : "(no prior version — proposal is the first plan)"}

TEACHER-PROPOSED curriculum:
${JSON.stringify(proposed).slice(0, 8000)}

Teacher's diff summary: ${proposal.diff_summary ?? "(none provided)"}

Score the proposal and list fault lines.`;

    let result;
    let modelUsed: AllowedModel = MODEL;
    try {
      const { runAiWithFallback } = await import("@/lib/ai-policy.server");
      const r = await runAiWithFallback(supabaseAdmin, {
        system,
        prompt,
        schema: reviewSchema,
        options: { orgId: (ctx.year as any)?.org_id ?? null },
        // Only escalate if the reviewer is uncertain.
        lowConfidence: (o: any) => o?.score >= 0.55 && o?.score < 0.75,
      });
      result = r.output;
      modelUsed = r.modelUsed;
    } catch (e: any) {
      // Refund credit, mark back to draft, and surface the error.
      await supabaseAdmin.rpc("refund_ai_credits", {
        _user_id: userId,
        _amount: REVIEW_COST,
        _check_env: "live",
      });
      await supabase
        .from("curriculum_edit_proposals")
        .update({ status: "draft" })
        .eq("id", data.proposal_id);
      throw new Error(e.message ?? "AI review failed");
    }

    const verdictRow = result.verdict;
    const finalStatus = result.score >= EXCELLENCE_THRESHOLD ? "finalized" : "flagged_low_quality";

    await supabase
      .from("curriculum_edit_proposals")
      .update({
        ai_score: Number(result.score.toFixed(2)),
        ai_verdict: verdictRow,
        ai_fault_lines: result.fault_lines,
        ai_report: result.report_markdown,
        ai_reviewed_at: new Date().toISOString(),
        status: finalStatus,
        finalized_at: finalStatus === "finalized" ? new Date().toISOString() : null,
      })
      .eq("id", data.proposal_id);

    return {
      ok: true,
      score: result.score,
      verdict: verdictRow,
      status: finalStatus,
      threshold: EXCELLENCE_THRESHOLD,
      model: modelUsed,
    };
  });

/* ---------------- acknowledge & proceed (release flagged proposal) ---------------- */

const ACK_PHRASE = "I accept the noted faults and request the amended version";

export const acknowledgeAndProceed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      proposal_id: z.string().uuid(),
      ack_text: z.string().trim().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.ack_text.toLowerCase().includes(ACK_PHRASE.toLowerCase())) {
      throw new Error(`Acknowledgement must contain the exact phrase: "${ACK_PHRASE}".`);
    }
    const { data: row } = await supabase
      .from("curriculum_edit_proposals")
      .select("teacher_id,status")
      .eq("id", data.proposal_id)
      .maybeSingle();
    if (!row || row.teacher_id !== userId) throw new Error("Not found");
    if (row.status !== "flagged_low_quality") {
      throw new Error("Only flagged proposals require acknowledgement.");
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("curriculum_edit_proposals")
      .update({
        status: "finalized",
        teacher_ack_at: now,
        teacher_ack_text: data.ack_text,
        finalized_at: now,
      })
      .eq("id", data.proposal_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- read fns ---------------- */

export const getProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ proposal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("curriculum_edit_proposals")
      .select("*")
      .eq("id", data.proposal_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Proposal not found");
    return row;
  });

export const listMyProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("curriculum_edit_proposals")
      .select("*")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listProposalsForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("curriculum_edit_proposals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const rejectProposalPostHoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ proposal_id: z.string().uuid(), reason: z.string().trim().min(10).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!ok) throw new Error("Super admin only");
    const { error } = await supabase
      .from("curriculum_edit_proposals")
      .update({
        status: "rejected",
        rejection_reason: data.reason,
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
      })
      .eq("id", data.proposal_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
