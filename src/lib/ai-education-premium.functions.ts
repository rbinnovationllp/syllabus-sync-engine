import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { entitlementActive, packageAvailable, packageFromRow } from "@/lib/ai-education-premium";
import { getPrimaryOrgId } from "@/lib/plan-entitlements";

const grade = z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
const packageCode = z.string().regex(/^[a-z0-9_]{3,80}$/);
const adminRoles = ["admin", "super_admin", "owner"];
async function school(context: any, adminOnly = false) {
  const orgId = await getPrimaryOrgId(context.supabase, context.userId);
  const member = await context.supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (member.error || !member.data || (adminOnly && !adminRoles.includes(member.data.role)))
    throw new Error("School administrator access is required.");
  return { orgId, canManage: adminRoles.includes(member.data.role) };
}
async function adminClient() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
}
const safeQuoteError = (message: string) =>
  message.includes("OVERLAPPING")
    ? "These classes already have a different paid package. Renew that package or choose uncovered classes."
    : message.includes("ALREADY_SCHEDULED")
      ? "Your next subscription term is already paid."
      : message.includes("RATE_LIMIT")
        ? "Please wait a minute before starting another checkout."
        : "This package is currently unavailable. Refresh the pricing page and try again.";

export const getAiEducationPremium = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { orgId, canManage } = await school(context);
    const db: any = context.supabase;
    const results = await Promise.all([
      db.from("ai_education_premium_package_catalog").select("*").order("sort_order"),
      db
        .from("ai_education_premium_entitlements")
        .select(
          "grade,status,starts_at,ends_at,ai_education_premium_subscriptions(status,starts_at,renews_at)",
        )
        .eq("org_id", orgId),
      db
        .from("ai_education_premium_teacher_assignments")
        .select("grade")
        .eq("org_id", orgId)
        .eq("user_id", context.userId)
        .eq("active", true),
      db
        .from("ai_education_premium_subscriptions")
        .select(
          "id,billing_interval,currency,status,starts_at,renews_at,base_amount_minor,tax_amount_minor,final_amount_minor,cancel_at_period_end,metadata,created_at",
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (results.some((r) => r.error))
      throw new Error("AI Education Premium is temporarily unavailable. Please try again later.");
    const [catalog, entitlements, assignments, subscriptions] = results.map((r) => r.data ?? []);
    const assigned = new Set(assignments.map((r: any) => r.grade));
    const subscribedGrades = [
      ...new Set<string>(
        entitlements
          .filter((r: any) => entitlementActive(r) && (canManage || assigned.has(r.grade)))
          .map((r: any) => r.grade),
      ),
    ].sort((a, b) => Number(a) - Number(b));
    const members = canManage
      ? await db
          .from("org_members")
          .select("user_id,profiles(email,display_name)")
          .eq("org_id", orgId)
      : { data: [] };
    return {
      members: members.data ?? [],
      packages: catalog.filter((p: any) => packageAvailable(p)).map(packageFromRow),
      subscribedGrades,
      canManage,
      subscriptions: canManage ? subscriptions : [],
    };
  });

export const createAiEducationPremiumQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ packageCode, billingInterval: z.enum(["monthly", "annual"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await school(context, true);
    const { data: subscription, error } = await (context.supabase as any).rpc(
      "premium_create_quote",
      { p_org: orgId, p_code: data.packageCode, p_interval: data.billingInterval },
    );
    if (error) throw new Error(safeQuoteError(error.message));
    const admin = await adminClient();
    const { premiumRazorpay } = await import("@/lib/ai-education-premium-payment.server");
    let orderId = subscription.provider_order_id;
    if (!orderId) {
      const claim = await admin
        .from("ai_education_premium_subscriptions")
        .update({ order_creation_started: new Date().toISOString() })
        .eq("id", subscription.id)
        .is("order_creation_started", null)
        .is("provider_order_id", null)
        .select("id")
        .maybeSingle();
      if (claim.error || !claim.data)
        throw new Error("Checkout is being prepared. Wait a moment, then try again.");
      try {
        const order = await premiumRazorpay("/orders", {
          amount: subscription.final_amount_minor,
          currency: subscription.currency.toUpperCase(),
          receipt: subscription.id,
          notes: { product: "ai_education_premium", premiumSubscriptionId: subscription.id },
        });
        const saved = await admin
          .from("ai_education_premium_subscriptions")
          .update({ provider_order_id: order.id })
          .eq("id", subscription.id)
          .is("provider_order_id", null)
          .select("id")
          .single();
        if (saved.error) throw new Error("PREMIUM_ORDER_SAVE_FAILED");
        orderId = order.id;
      } catch {
        // An unreturned provider order cannot be used by this UI; retry creates a fresh quote after 15 minutes.
        throw new Error(
          "Checkout could not be prepared. Please try again later or contact support.",
        );
      }
    }
    return {
      subscriptionId: subscription.id,
      orderId,
      keyId: process.env.RAZORPAY_KEY_ID!,
      amount: subscription.final_amount_minor,
      currency: subscription.currency.toUpperCase(),
      label: subscription.metadata.package_label,
    };
  });

export const confirmAiEducationPremiumPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subscriptionId: z.string().uuid(),
        paymentId: z.string().regex(/^pay_[A-Za-z0-9]+$/),
        signature: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await school(context, true);
    const admin = await adminClient();
    const row = await admin
      .from("ai_education_premium_subscriptions")
      .select("*")
      .eq("id", data.subscriptionId)
      .eq("org_id", orgId)
      .single();
    if (row.error || !row.data?.provider_order_id)
      throw new Error("Payment confirmation is pending. Refresh shortly.");
    const { verifyPremiumCheckout, settlePremiumPayment } =
      await import("@/lib/ai-education-premium-payment.server");
    if (!verifyPremiumCheckout(row.data.provider_order_id, data.paymentId, data.signature))
      throw new Error("Payment could not be verified.");
    try {
      await settlePremiumPayment(admin, row.data, data.paymentId);
    } catch {
      throw new Error("Payment confirmation is pending. Refresh shortly; do not pay again.");
    }
    return { ok: true };
  });

export const cancelAiEducationPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ subscriptionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { orgId } = await school(context, true);
    const admin = await adminClient();
    const result = await admin
      .from("ai_education_premium_subscriptions")
      .update({
        cancel_at_period_end: true,
        cancelled_at: new Date().toISOString(),
        status: "cancelled",
      })
      .eq("id", data.subscriptionId)
      .eq("org_id", orgId)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (result.error || !result.data)
      throw new Error("This subscription could not be cancelled. Refresh and try again.");
    return { ok: true };
  });

export const getAiEducationPremiumReceipt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ subscriptionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { orgId } = await school(context, true);
    const db: any = context.supabase;
    const [payment, subscription] = await Promise.all([
      db
        .from("ai_education_premium_payments")
        .select("provider_payment_id,amount_minor,currency,status,paid_at,invoice_id")
        .eq("subscription_id", data.subscriptionId)
        .eq("org_id", orgId)
        .eq("status", "captured")
        .maybeSingle(),
      db
        .from("ai_education_premium_subscriptions")
        .select(
          "metadata,base_amount_minor,tax_amount_minor,final_amount_minor,starts_at,renews_at",
        )
        .eq("id", data.subscriptionId)
        .eq("org_id", orgId)
        .single(),
    ]);
    if (payment.error || subscription.error || !payment.data)
      throw new Error("The payment receipt is not available yet.");
    return { payment: payment.data, subscription: subscription.data };
  });

const teachingRequest = z
  .object({
    grade,
    academicYear: z.string().trim().min(3).max(40),
    term: z.string().trim().max(80).optional(),
    weekNo: z.number().int().min(1).max(60).optional(),
    topic: z.string().trim().min(2).max(300),
    learningObjective: z.string().trim().max(600).optional(),
    previousLearning: z.string().trim().max(1000).optional(),
    durationMinutes: z.number().int().min(20).max(180).default(40),
    language: z.string().trim().min(1).max(80).default("English"),
    facilities: z.string().trim().max(500).default("Not specified"),
  })
  .strict();
export const generateAiEducationPremiumTeachingPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => teachingRequest.parse(input))
  .handler(async ({ data, context }) => {
    const { orgId } = await school(context);
    const admin = await adminClient();
    const { generatePremiumPlan } = await import("@/lib/ai-education-premium-generation.server");
    try {
      return await generatePremiumPlan(admin, context.userId, orgId, data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      throw new Error(
        message === "PREMIUM_CLASS_NOT_SUBSCRIBED"
          ? "This class is not available in your active subscription or teacher assignment."
          : message === "PREMIUM_GENERATION_LIMIT"
            ? "Your school has reached its teaching-plan generation limit. You can still reuse saved plans."
            : message === "PREMIUM_GENERATION_IN_PROGRESS"
              ? "This plan is already being prepared. Try again shortly."
              : "Teaching guidance is temporarily unavailable. Please try again later.",
      );
    }
  });

export const listAiEducationPremiumSavedPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ grade }).parse(input))
  .handler(async ({ data, context }) => {
    const { orgId } = await school(context);
    const db: any = context.supabase;
    const result = await db
      .from("ai_education_premium_teaching_plans")
      .select("id,topic,academic_year,output,created_at")
      .eq("org_id", orgId)
      .eq("grade", data.grade)
      .order("created_at", { ascending: false })
      .limit(30);
    if (result.error) throw new Error("Saved plans are temporarily unavailable.");
    return result.data;
  });

export const assignAiEducationPremiumTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), grade, active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await school(context, true);
    const result = await (context.supabase as any)
      .from("ai_education_premium_teacher_assignments")
      .upsert(
        {
          org_id: orgId,
          user_id: data.userId,
          grade: data.grade,
          active: data.active,
          assigned_by: context.userId,
        },
        { onConflict: "org_id,user_id,grade" },
      );
    if (result.error) throw new Error("Choose a teacher who belongs to this school.");
    return { ok: true };
  });

export const getAiEducationPremiumAdminCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (role.error || !role.data) return null;
    const result = await (context.supabase as any)
      .from("ai_education_premium_package_catalog")
      .select("*")
      .order("sort_order");
    if (result.error) throw new Error("Pricing configuration is unavailable.");
    return result.data;
  });
export const saveAiEducationPremiumPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: packageCode,
        label: z.string().trim().min(3).max(120),
        grades: z
          .array(grade)
          .min(1)
          .max(12)
          .transform((v) => [...new Set(v)]),
        monthly_price_inr: z.number().int().positive().max(1000000),
        annual_price_inr: z.number().int().positive().max(1000000),
        currency: z.string().regex(/^[a-z]{3}$/),
        active: z.boolean(),
        featured: z.boolean(),
        group_kind: z.enum(["group", "school"]),
        sort_order: z.number().int().min(0).max(1000),
        gst_rate: z.number().min(0).max(100),
        gst_inclusive: z.literal(true),
        effective_from: z.string().datetime().nullable(),
        effective_to: z.string().datetime().nullable(),
        promotional_price: z.record(z.unknown()),
        discount_rules: z.record(z.unknown()),
      })
      .refine(
        (v) => !v.effective_from || !v.effective_to || v.effective_to > v.effective_from,
        "End date must follow start date",
      )
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const role = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (role.error || !role.data) throw new Error("Super administrator access is required.");
    const result = await (context.supabase as any)
      .from("ai_education_premium_package_catalog")
      .upsert({ ...data, updated_at: new Date().toISOString() });
    if (result.error) throw new Error("Pricing changes could not be saved.");
    return { ok: true };
  });
