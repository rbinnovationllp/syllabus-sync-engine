import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function toMinor(value: number | null | undefined) {
  return Math.max(0, Math.round(Number(value ?? 0) * 100));
}

function fromMinor(value: number | null | undefined) {
  return Math.round(Number(value ?? 0)) / 100;
}

function formatInrMinor(value: number | null | undefined) {
  return `Rs ${Math.round(Number(value ?? 0) / 100).toLocaleString("en-IN")}`;
}

async function assertCompanySuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((row: any) => row.role === "super_admin")) throw new Error("Only Company Super Admin can manage pilot approvals.");
}

async function loadMyOrg(supabase: any, userId: string) {
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("You are not connected to any school workspace.");
  return data as { org_id: string; role: string };
}

function isSchoolAdmin(role: string) {
  return ["owner", "admin", "super_admin"].includes(role);
}

function buildCalculation(program: any, requestType: "refund" | "credit", adjustmentMinor = 0) {
  const baseAmountMinor = Number(program.monthly_base_amount_minor ?? 0) * 2;
  const gstAmountMinor = Number(program.gst_amount_minor ?? 0);
  const gatewayChargesMinor = Number(program.gateway_charges_minor ?? 0);
  const bankChargesMinor = Number(program.bank_charges_minor ?? 0);
  const otherDeductionsMinor = Number(program.other_deductions_minor ?? 0);
  const gstDeductionMinor = program.gst_treatment === "refundable" ? 0 : gstAmountMinor;
  const requiredDeductionsMinor = gstDeductionMinor + gatewayChargesMinor + bankChargesMinor + otherDeductionsMinor;
  const eligibleAmountMinor = Math.max(0, baseAmountMinor - requiredDeductionsMinor - adjustmentMinor);
  return {
    requestType,
    baseAmountMinor,
    gstAmountMinor,
    gatewayChargesMinor,
    bankChargesMinor,
    otherDeductionsMinor,
    gstDeductionMinor,
    companyAdjustedDeductionsMinor: adjustmentMinor,
    eligibleAmountMinor,
    summary: [
      `Two-month base pilot subscription: ${formatInrMinor(baseAmountMinor)}.`,
      program.gst_treatment === "refundable"
        ? "GST is configured as refundable for this pilot."
        : `GST is treated as non-refundable: ${formatInrMinor(gstAmountMinor)}.`,
      `Gateway/bank/other deductions: ${formatInrMinor(gatewayChargesMinor + bankChargesMinor + otherDeductionsMinor + adjustmentMinor)}.`,
      `${requestType === "refund" ? "Eligible refund" : "Eligible participation credit"}: ${formatInrMinor(eligibleAmountMinor)}.`,
    ].join(" "),
  };
}

async function notifyUsers(admin: any, args: {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  link: string;
  severity?: string;
  dedupeKey: string;
}) {
  const rows = args.userIds.map((userId) => ({
    user_id: userId,
    type: args.type,
    title: args.title,
    body: args.body,
    link: args.link,
    severity: args.severity ?? "info",
    dedupe_key: `${args.dedupeKey}:${userId}`,
  }));
  if (rows.length) {
    const { error } = await admin.from("notifications").insert(rows);
    if (error && error.code !== "23505") throw new Error(error.message);
  }
}

async function notifyCompanySuperAdmins(admin: any, title: string, body: string, dedupeKey: string) {
  const { data } = await admin.from("user_roles").select("user_id").eq("role", "super_admin");
  await notifyUsers(admin, {
    userIds: (data ?? []).map((row: any) => row.user_id),
    type: "pilot_benefit_request",
    title,
    body,
    link: "/company-crm",
    severity: "warn",
    dedupeKey,
  });
}

async function notifySchoolAdmins(admin: any, schoolId: string, title: string, body: string, dedupeKey: string) {
  const { data } = await admin
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", schoolId)
    .in("role", ["owner", "admin", "super_admin"]);
  await notifyUsers(admin, {
    userIds: (data ?? []).map((row: any) => row.user_id),
    type: "pilot_benefit_update",
    title,
    body,
    link: "/school-governance",
    severity: "info",
    dedupeKey,
  });
}

async function audit(admin: any, args: {
  orgId: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await admin.from("platform_audit_logs").insert({
    org_id: args.orgId,
    user_id: args.userId,
    action: args.action,
    entity_type: args.entityType,
    entity_id: args.entityId ?? null,
    metadata: args.metadata ?? {},
  });
}

async function initiateRazorpayRefund(args: {
  paymentId: string;
  amountMinor: number;
  requestId: string;
  schoolId: string;
}) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay refund credentials are not configured.");
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${args.paymentId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "X-Razorpay-Idempotency-Key": args.requestId,
    },
    body: JSON.stringify({
      amount: args.amountMinor,
      speed: "normal",
      notes: {
        source: "syllabus_synk_paid_pilot_refund",
        request_id: args.requestId,
        school_id: args.schoolId,
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.description || payload?.message || "Razorpay refund failed.");
  return payload;
}

const pilotProgramSchema = z.object({
  school_id: z.string().uuid(),
  school_name: z.string().trim().max(220).optional().nullable(),
  pilot_start_date: z.string().min(8),
  pilot_end_date: z.string().min(8),
  approved_plan_id: z.string().trim().max(120).optional().nullable(),
  monthly_base_amount: z.number().min(0),
  gst_amount: z.number().min(0).default(0),
  gateway_charges: z.number().min(0).default(0),
  bank_charges: z.number().min(0).default(0),
  other_deductions: z.number().min(0).default(0),
  total_paid: z.number().min(0),
  gst_treatment: z.enum(["non_refundable", "refundable", "manual_review"]).default("non_refundable"),
  refund_credit_eligibility_status: z.enum(["eligible", "not_eligible", "manual_review"]).default("eligible"),
  mou_reference: z.string().trim().max(200).optional().nullable(),
  mou_document_url: z.string().trim().max(1000).optional().nullable(),
  internal_notes: z.string().trim().max(3000).optional().nullable(),
});

export const createPilotProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pilotProgramSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertCompanySuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      school_id: data.school_id,
      school_name: data.school_name || null,
      approval_status: "approved",
      pilot_start_date: data.pilot_start_date,
      pilot_end_date: data.pilot_end_date,
      approved_plan_id: data.approved_plan_id || null,
      monthly_base_amount_minor: toMinor(data.monthly_base_amount),
      gst_amount_minor: toMinor(data.gst_amount),
      gateway_charges_minor: toMinor(data.gateway_charges),
      bank_charges_minor: toMinor(data.bank_charges),
      other_deductions_minor: toMinor(data.other_deductions),
      total_paid_minor: toMinor(data.total_paid),
      currency: "inr",
      gst_treatment: data.gst_treatment,
      refund_credit_eligibility_status: data.refund_credit_eligibility_status,
      mou_reference: data.mou_reference || null,
      mou_document_url: data.mou_document_url || null,
      internal_notes: data.internal_notes || null,
      approved_by: context.userId,
      approved_at: new Date().toISOString(),
    };
    const { data: row, error } = await supabaseAdmin.from("pilot_programs").insert(payload).select().single();
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, {
      orgId: data.school_id,
      userId: context.userId,
      action: "pilot_school_approved",
      entityType: "pilot_programs",
      entityId: row.id,
      metadata: payload,
    });
    await notifySchoolAdmins(
      supabaseAdmin,
      data.school_id,
      "Paid pilot subscription approved",
      "Your school has been marked as an approved paid pilot school. After the pilot period, the School Super Admin can request continuation credit or refund review as per the MOU.",
      `pilot-program:${row.id}`,
    );
    return row;
  });

export const listCompanyPilotWorkflows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCompanySuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [programs, requests, credits, refunds] = await Promise.all([
      supabaseAdmin.from("pilot_programs").select("*, organizations(name)").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("pilot_benefit_requests").select("*, pilot_programs(mou_reference, mou_document_url, approved_plan_id, pilot_start_date, pilot_end_date), organizations(name)").order("requested_at", { ascending: false }).limit(200),
      supabaseAdmin.from("school_credit_ledger").select("*, organizations(name)").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("refund_transactions").select("*, organizations(name), pilot_benefit_requests(request_type, status)").order("created_at", { ascending: false }).limit(200),
    ]);
    return {
      programs: programs.data ?? [],
      requests: requests.data ?? [],
      credits: credits.data ?? [],
      refunds: refunds.data ?? [],
      metrics: {
        approvedPilots: programs.data?.length ?? 0,
        pendingRequests: (requests.data ?? []).filter((row: any) => ["pending_company_approval", "on_hold", "clarification_required"].includes(row.status)).length,
        activeCreditsMinor: (credits.data ?? []).filter((row: any) => row.status === "active").reduce((sum: number, row: any) => sum + Number(row.remaining_amount_minor ?? 0), 0),
        refundsInitiatedMinor: (refunds.data ?? []).reduce((sum: number, row: any) => sum + Number(row.approved_refund_amount_minor ?? 0), 0),
      },
    };
  });

export const listMyPilotBenefits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await loadMyOrg(context.supabase, context.userId);
    if (!isSchoolAdmin(me.role)) throw new Error("Only School Super Admin or school admin can view pilot benefit controls.");
    const [programs, requests, credits, refunds] = await Promise.all([
      context.supabase.from("pilot_programs").select("*").eq("school_id", me.org_id).order("created_at", { ascending: false }),
      context.supabase.from("pilot_benefit_requests").select("*").eq("school_id", me.org_id).order("requested_at", { ascending: false }),
      context.supabase.from("school_credit_ledger").select("*").eq("school_id", me.org_id).order("created_at", { ascending: false }),
      context.supabase.from("refund_transactions").select("*").eq("school_id", me.org_id).order("created_at", { ascending: false }),
    ]);
    return {
      programs: programs.data ?? [],
      requests: requests.data ?? [],
      credits: credits.data ?? [],
      refunds: refunds.data ?? [],
    };
  });

const benefitRequestSchema = z.object({
  pilot_program_id: z.string().uuid(),
  request_type: z.enum(["refund", "credit"]),
  original_razorpay_payment_id: z.string().trim().max(120).optional().nullable(),
  school_notes: z.string().trim().max(2000).optional().nullable(),
});

export const submitPilotBenefitRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => benefitRequestSchema.parse(input))
  .handler(async ({ context, data }) => {
    const me = await loadMyOrg(context.supabase, context.userId);
    if (!isSchoolAdmin(me.role)) throw new Error("Only School Super Admin or school admin can submit a pilot benefit request.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: program, error: programError } = await supabaseAdmin
      .from("pilot_programs")
      .select("*")
      .eq("id", data.pilot_program_id)
      .eq("school_id", me.org_id)
      .maybeSingle();
    if (programError) throw new Error(programError.message);
    if (!program) throw new Error("Approved pilot record was not found for this school.");
    if (program.refund_credit_eligibility_status === "not_eligible") throw new Error("This pilot is not marked eligible for refund or credit benefit.");
    if (data.request_type === "refund" && !data.original_razorpay_payment_id) throw new Error("Original Razorpay payment ID is required for refund request.");
    const calculation = buildCalculation(program, data.request_type);
    const idempotencyKey = `${data.pilot_program_id}:${data.request_type}:${context.userId}`;
    const { data: row, error } = await supabaseAdmin
      .from("pilot_benefit_requests")
      .upsert({
        pilot_program_id: program.id,
        school_id: me.org_id,
        request_type: data.request_type,
        status: "pending_company_approval",
        requested_by: context.userId,
        requested_at: new Date().toISOString(),
        original_razorpay_payment_id: data.original_razorpay_payment_id || null,
        total_paid_minor: Number(program.total_paid_minor ?? 0),
        base_amount_minor: calculation.baseAmountMinor,
        gst_amount_minor: calculation.gstAmountMinor,
        gateway_charges_minor: calculation.gatewayChargesMinor,
        bank_charges_minor: calculation.bankChargesMinor,
        other_deductions_minor: calculation.otherDeductionsMinor,
        eligible_amount_minor: calculation.eligibleAmountMinor,
        school_notes: data.school_notes || null,
        calculation_snapshot: calculation,
        idempotency_key: idempotencyKey,
      }, { onConflict: "idempotency_key" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await audit(supabaseAdmin, {
      orgId: me.org_id,
      userId: context.userId,
      action: `pilot_${data.request_type}_requested`,
      entityType: "pilot_benefit_requests",
      entityId: row.id,
      metadata: calculation,
    });
    await notifyCompanySuperAdmins(
      supabaseAdmin,
      "Pilot benefit request needs approval",
      `A school has requested ${data.request_type === "refund" ? "pilot refund" : "pilot participation credit"} review. Eligible amount: ${formatInrMinor(calculation.eligibleAmountMinor)}.`,
      `pilot-benefit-request:${row.id}`,
    );
    return row;
  });

const reviewSchema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(["approve", "reject", "clarification_required", "on_hold"]),
  admin_secret_code: z.string().trim().min(1),
  company_adjusted_deductions: z.number().min(0).default(0),
  company_adjustment_reason: z.string().trim().max(1000).optional().nullable(),
  rejection_reason: z.string().trim().max(1000).optional().nullable(),
  internal_notes: z.string().trim().max(3000).optional().nullable(),
});

export const reviewPilotBenefitRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertCompanySuperAdmin(context);
    const expectedSecret = process.env.COMPANY_ADMIN_SECRET_CODE;
    if (!expectedSecret) throw new Error("COMPANY_ADMIN_SECRET_CODE is not configured on the server.");
    if (data.admin_secret_code !== expectedSecret) throw new Error("Company admin secret code is incorrect.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: request, error } = await supabaseAdmin
      .from("pilot_benefit_requests")
      .select("*, pilot_programs(*)")
      .eq("id", data.request_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!request) throw new Error("Pilot benefit request was not found.");

    const nonApprovalStatus =
      data.action === "reject" ? "rejected" :
        data.action === "clarification_required" ? "clarification_required" :
          data.action === "on_hold" ? "on_hold" :
            null;
    if (nonApprovalStatus) {
      await supabaseAdmin.from("pilot_benefit_requests").update({
        status: nonApprovalStatus,
        rejection_reason: data.rejection_reason || null,
        internal_notes: data.internal_notes || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", request.id);
      await audit(supabaseAdmin, {
        orgId: request.school_id,
        userId: context.userId,
        action: `pilot_benefit_${nonApprovalStatus}`,
        entityType: "pilot_benefit_requests",
        entityId: request.id,
        metadata: { reason: data.rejection_reason, notes: data.internal_notes },
      });
      await notifySchoolAdmins(supabaseAdmin, request.school_id, "Pilot benefit request updated", `Your request status is now ${nonApprovalStatus}.`, `pilot-benefit-review:${request.id}:${nonApprovalStatus}`);
      return { ok: true, status: nonApprovalStatus };
    }

    if (request.status === "approved" || request.status === "processed") return { ok: true, status: request.status };
    const adjustedMinor = toMinor(data.company_adjusted_deductions);
    if (adjustedMinor > 0 && !data.company_adjustment_reason) throw new Error("Adjustment reason is required when extra deductions are added.");
    const calculation = buildCalculation(request.pilot_programs, request.request_type, adjustedMinor);
    const approvedAmountMinor = calculation.eligibleAmountMinor;
    if (approvedAmountMinor <= 0) throw new Error("Approved amount must be greater than zero.");

    if (request.request_type === "credit") {
      const { data: ledger, error: ledgerError } = await supabaseAdmin
        .from("school_credit_ledger")
        .upsert({
          school_id: request.school_id,
          source_type: "pilot_participation_credit",
          source_reference_id: request.id,
          credit_amount_minor: approvedAmountMinor,
          used_amount_minor: 0,
          remaining_amount_minor: approvedAmountMinor,
          currency: "inr",
          status: "active",
          notes: data.internal_notes || "Pilot Participation Credit approved for future invoice adjustment.",
          approved_by: context.userId,
          approved_at: new Date().toISOString(),
        }, { onConflict: "source_reference_id" })
        .select()
        .single();
      if (ledgerError) throw new Error(ledgerError.message);
      await supabaseAdmin.from("pilot_benefit_requests").update({
        status: "approved",
        company_adjusted_deductions_minor: adjustedMinor,
        company_adjustment_reason: data.company_adjustment_reason || null,
        approved_amount_minor: approvedAmountMinor,
        internal_notes: data.internal_notes || null,
        calculation_snapshot: calculation,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", request.id);
      await audit(supabaseAdmin, {
        orgId: request.school_id,
        userId: context.userId,
        action: "pilot_credit_approved",
        entityType: "school_credit_ledger",
        entityId: ledger.id,
        metadata: calculation,
      });
      await notifySchoolAdmins(supabaseAdmin, request.school_id, "Pilot participation credit approved", `Credit of ${formatInrMinor(approvedAmountMinor)} is now available for future invoices.`, `pilot-credit-approved:${request.id}`);
      return { ok: true, status: "approved", creditLedgerId: ledger.id };
    }

    if (!request.original_razorpay_payment_id) throw new Error("Original Razorpay payment ID is missing.");
    let refundPayload: any = null;
    try {
      refundPayload = await initiateRazorpayRefund({
        paymentId: request.original_razorpay_payment_id,
        amountMinor: approvedAmountMinor,
        requestId: request.id,
        schoolId: request.school_id,
      });
      await supabaseAdmin.from("refund_transactions").upsert({
        school_id: request.school_id,
        benefit_request_id: request.id,
        payment_gateway: "razorpay",
        original_payment_id: request.original_razorpay_payment_id,
        gateway_refund_id: refundPayload?.id ?? null,
        approved_refund_amount_minor: approvedAmountMinor,
        currency: "inr",
        refund_status: "initiated",
        initiated_at: new Date().toISOString(),
        raw_gateway_response: refundPayload,
      }, { onConflict: "benefit_request_id" });
      await supabaseAdmin.from("pilot_benefit_requests").update({
        status: "approved",
        company_adjusted_deductions_minor: adjustedMinor,
        company_adjustment_reason: data.company_adjustment_reason || null,
        approved_amount_minor: approvedAmountMinor,
        internal_notes: data.internal_notes || null,
        calculation_snapshot: calculation,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", request.id);
      await audit(supabaseAdmin, {
        orgId: request.school_id,
        userId: context.userId,
        action: "pilot_refund_initiated",
        entityType: "refund_transactions",
        entityId: refundPayload?.id ?? request.id,
        metadata: calculation,
      });
      await notifySchoolAdmins(supabaseAdmin, request.school_id, "Pilot refund approved", `Refund of ${formatInrMinor(approvedAmountMinor)} has been initiated through Razorpay.`, `pilot-refund-approved:${request.id}`);
      return { ok: true, status: "approved", refundId: refundPayload?.id ?? null };
    } catch (refundError: any) {
      await supabaseAdmin.from("refund_transactions").upsert({
        school_id: request.school_id,
        benefit_request_id: request.id,
        payment_gateway: "razorpay",
        original_payment_id: request.original_razorpay_payment_id,
        approved_refund_amount_minor: approvedAmountMinor,
        currency: "inr",
        refund_status: "failed",
        failure_reason: refundError.message,
        raw_gateway_response: refundPayload ?? {},
      }, { onConflict: "benefit_request_id" });
      await supabaseAdmin.from("pilot_benefit_requests").update({
        status: "failed",
        approved_amount_minor: approvedAmountMinor,
        internal_notes: data.internal_notes || refundError.message,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", request.id);
      await audit(supabaseAdmin, {
        orgId: request.school_id,
        userId: context.userId,
        action: "pilot_refund_failed",
        entityType: "refund_transactions",
        entityId: request.id,
        metadata: { error: refundError.message, calculation },
      });
      throw refundError;
    }
  });

const creditAdjustmentSchema = z.object({
  credit_ledger_id: z.string().uuid(),
  invoice_id: z.string().trim().max(160).optional().nullable(),
  amount: z.number().min(0.01),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const applyPilotCreditAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creditAdjustmentSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertCompanySuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const amountMinor = toMinor(data.amount);
    const { data: ledger, error } = await supabaseAdmin
      .from("school_credit_ledger")
      .select("*")
      .eq("id", data.credit_ledger_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ledger) throw new Error("Credit ledger entry was not found.");
    if (Number(ledger.remaining_amount_minor ?? 0) < amountMinor) throw new Error("Credit adjustment exceeds remaining balance.");
    const newUsed = Number(ledger.used_amount_minor ?? 0) + amountMinor;
    const newRemaining = Number(ledger.remaining_amount_minor ?? 0) - amountMinor;
    await supabaseAdmin.from("credit_adjustments").insert({
      school_id: ledger.school_id,
      credit_ledger_id: ledger.id,
      invoice_id: data.invoice_id || null,
      amount_applied_minor: amountMinor,
      notes: data.notes || null,
      applied_by: context.userId,
    });
    await supabaseAdmin.from("school_credit_ledger").update({
      used_amount_minor: newUsed,
      remaining_amount_minor: newRemaining,
      status: newRemaining === 0 ? "exhausted" : "active",
    }).eq("id", ledger.id);
    await audit(supabaseAdmin, {
      orgId: ledger.school_id,
      userId: context.userId,
      action: "pilot_credit_applied_to_invoice",
      entityType: "school_credit_ledger",
      entityId: ledger.id,
      metadata: { invoice_id: data.invoice_id, amount_minor: amountMinor },
    });
    return { ok: true, remainingAmount: fromMinor(newRemaining) };
  });
