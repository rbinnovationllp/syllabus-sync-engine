import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REASON_CATEGORIES = [
  "confidentiality_breach",
  "competitor_engagement",
  "fraud",
  "spam",
  "policy_violation",
  "other",
] as const;

async function assertSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — super admin only");
}

/* -------------------- list partners with totals -------------------- */

export const listPartnersAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabase } = context;

    const { data: partners, error } = await supabase
      .from("referral_partners")
      .select("*")
      .order("is_house", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Compute totals per partner in a single read.
    const ids = (partners ?? []).map((p: any) => p.id);
    let totals: Record<string, { lifetime: number; pending: number; forfeited: number; currency: string }> = {};
    if (ids.length > 0) {
      const { data: rows } = await supabase
        .from("referral_commissions")
        .select("partner_id,status,commission_cents,currency")
        .in("partner_id", ids);
      for (const r of rows ?? []) {
        const t = totals[r.partner_id] ?? { lifetime: 0, pending: 0, forfeited: 0, currency: r.currency };
        if (r.status === "forfeited") t.forfeited += r.commission_cents;
        else {
          t.lifetime += r.commission_cents;
          if (r.status === "accrued") t.pending += r.commission_cents;
        }
        totals[r.partner_id] = t;
      }
    }

    return (partners ?? []).map((p: any) => ({
      ...p,
      totals: totals[p.id] ?? { lifetime: 0, pending: 0, forfeited: 0, currency: "INR" },
    }));
  });

/* -------------------- partner detail -------------------- */

export const getPartnerDetailAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { partner_id: string }) => z.object({ partner_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabase } = context;

    const [partnerRes, commissionsRes, actionsRes, attributionsRes] = await Promise.all([
      supabase.from("referral_partners").select("*").eq("id", data.partner_id).maybeSingle(),
      supabase
        .from("referral_commissions")
        .select("*")
        .eq("partner_id", data.partner_id)
        .order("accrued_at", { ascending: false })
        .limit(200),
      supabase
        .from("referral_enforcement_actions")
        .select("*")
        .eq("partner_id", data.partner_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("referral_attributions")
        .select("id,org_id,code_used,attributed_at,is_house_fallback")
        .eq("partner_id", data.partner_id)
        .order("attributed_at", { ascending: false })
        .limit(100),
    ]);

    if (partnerRes.error) throw new Error(partnerRes.error.message);
    if (!partnerRes.data) throw new Error("Partner not found");

    return {
      partner: partnerRes.data,
      commissions: commissionsRes.data ?? [],
      actions: actionsRes.data ?? [],
      attributions: attributionsRes.data ?? [],
    };
  });

/* -------------------- issue show-cause -------------------- */

const showCauseSchema = z.object({
  partner_id: z.string().uuid(),
  reason_category: z.enum(REASON_CATEGORIES),
  notice_text: z.string().trim().min(20, "Notice must be at least 20 characters").max(4000),
  evidence_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  response_days: z.number().int().min(1).max(30).default(7),
});

export const issueShowCause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => showCauseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabase, userId } = context;

    const { data: partner, error: pErr } = await supabase
      .from("referral_partners")
      .select("id,is_house,status")
      .eq("id", data.partner_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!partner) throw new Error("Partner not found");
    if (partner.is_house) throw new Error("Cannot issue enforcement against the house partner");

    const dueAt = new Date(Date.now() + data.response_days * 86_400_000).toISOString();

    const { error: insErr } = await supabase.from("referral_enforcement_actions").insert({
      partner_id: data.partner_id,
      action: "show_cause_issued",
      reason_category: data.reason_category,
      notice_text: data.notice_text,
      evidence_url: data.evidence_url || null,
      response_due_at: dueAt,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    });
    if (insErr) throw new Error(insErr.message);

    // Move partner into under_review (does not stop accrual yet — that requires a decision).
    const { error: upErr } = await supabase
      .from("referral_partners")
      .update({
        status: "under_review",
        status_reason: `Show-cause: ${data.reason_category}`,
        status_changed_at: new Date().toISOString(),
        status_changed_by: userId,
      })
      .eq("id", data.partner_id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, response_due_at: dueAt };
  });

/* -------------------- record partner response (admin transcribes) -------------------- */

const recordResponseSchema = z.object({
  partner_id: z.string().uuid(),
  response_text: z.string().trim().min(1).max(4000),
});

export const recordPartnerResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recordResponseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabase, userId } = context;

    const { error } = await supabase.from("referral_enforcement_actions").insert({
      partner_id: data.partner_id,
      action: "response_received",
      reason_category: "other",
      notice_text: "Partner response logged by admin.",
      response_text: data.response_text,
      responded_at: new Date().toISOString(),
      decided_by: userId,
      decided_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- decide enforcement (reinstate / suspend / terminate + forfeit) -------------------- */

const decideSchema = z.object({
  partner_id: z.string().uuid(),
  decision: z.enum(["reinstated", "suspended", "terminated"]),
  reason_category: z.enum(REASON_CATEGORIES),
  notice_text: z.string().trim().min(10).max(4000),
  forfeit_accrued: z.boolean().default(false),
});

export const decideEnforcement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decideSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabase, userId } = context;

    const { data: partner, error: pErr } = await supabase
      .from("referral_partners")
      .select("id,is_house")
      .eq("id", data.partner_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!partner) throw new Error("Partner not found");
    if (partner.is_house) throw new Error("Cannot enforce against the house partner");

    let forfeitedCents = 0;
    if (data.forfeit_accrued && data.decision !== "reinstated") {
      // Sum pending accrued commissions, then mark them forfeited.
      const { data: pending, error: sumErr } = await supabase
        .from("referral_commissions")
        .select("id,commission_cents")
        .eq("partner_id", data.partner_id)
        .eq("status", "accrued");
      if (sumErr) throw new Error(sumErr.message);
      forfeitedCents = (pending ?? []).reduce(
        (s: number, r: { commission_cents: number }) => s + r.commission_cents,
        0,
      );
      if (forfeitedCents > 0) {
        const ids = (pending ?? []).map((r: { id: string }) => r.id);
        const { error: updErr } = await supabase
          .from("referral_commissions")
          .update({
            status: "forfeited",
            notes: `Forfeited under enforcement decision on ${new Date().toISOString().slice(0, 10)}`,
          })
          .in("id", ids);
        if (updErr) throw new Error(updErr.message);
      }
    }

    // Append the enforcement decision row.
    const { error: actErr } = await supabase.from("referral_enforcement_actions").insert({
      partner_id: data.partner_id,
      action: data.decision,
      reason_category: data.reason_category,
      notice_text: data.notice_text,
      forfeited_amount_cents: forfeitedCents,
      decided_by: userId,
      decided_at: new Date().toISOString(),
    });
    if (actErr) throw new Error(actErr.message);

    // Update partner status accordingly.
    const newStatus =
      data.decision === "reinstated"
        ? "active"
        : data.decision === "suspended"
          ? "suspended"
          : "terminated";

    const { error: upErr } = await supabase
      .from("referral_partners")
      .update({
        status: newStatus,
        status_reason: data.notice_text.slice(0, 240),
        status_changed_at: new Date().toISOString(),
        status_changed_by: userId,
      })
      .eq("id", data.partner_id);
    if (upErr) throw new Error(upErr.message);

    // If we forfeited, log a separate audit row for clarity.
    if (forfeitedCents > 0) {
      await supabase.from("referral_enforcement_actions").insert({
        partner_id: data.partner_id,
        action: "forfeited_commissions",
        reason_category: data.reason_category,
        notice_text: `Forfeited ${forfeitedCents} cents of accrued, unpaid commissions.`,
        forfeited_amount_cents: forfeitedCents,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      });
    }

    return { ok: true, new_status: newStatus, forfeited_cents: forfeitedCents };
  });
