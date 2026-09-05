import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_EDUCATION_PREMIUM_DEFAULT_PRICES, calculateAiEducationPremium } from "@/lib/ai-education-premium";
import { getPrimaryOrgId } from "@/lib/plan-entitlements";

const grades = z.array(z.enum(["1","2","3","4","5","6","7","8","9","10","11","12"])).min(1).max(12);

export const getAiEducationPremium = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await getPrimaryOrgId(context.supabase, context.userId);
    const [catalogResult, entitlementResult, assignmentResult] = await Promise.all([
      (context.supabase as any).from("ai_education_premium_class_catalog").select("grade,monthly_price_inr,annual_price_inr,active").order("grade", { ascending: true }),
      (context.supabase as any).from("ai_education_premium_entitlements").select("grade,status,ends_at,ai_education_premium_subscriptions(status,renews_at,billing_interval)").eq("org_id", orgId).eq("status", "active"),
      (context.supabase as any).from("ai_education_premium_teacher_assignments").select("grade").eq("org_id", orgId).eq("user_id", context.userId).eq("active", true),
    ]);
    const catalog = catalogResult.data?.length ? catalogResult.data.map((row: any) => ({ grade: row.grade, monthlyInr: row.monthly_price_inr, annualInr: row.annual_price_inr, active: row.active })) : AI_EDUCATION_PREMIUM_DEFAULT_PRICES;
    const now = new Date();
    const subscribedGrades = (entitlementResult.data ?? []).filter((row: any) => {
      const sub = row.ai_education_premium_subscriptions;
      return (!row.ends_at || new Date(row.ends_at) > now) && ["active", "past_due"].includes(sub?.status);
    }).map((row: any) => row.grade);
    const assignedGrades = (assignmentResult.data ?? []).map((row: any) => row.grade);
    return { catalog, subscribedGrades, assignedGrades, canManage: subscribedGrades.length > 0 };
  });

/** Creates a quote/request only. Provider checkout must activate it only after a verified webhook. */
export const createAiEducationPremiumQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ grades, billingInterval: z.enum(["monthly", "annual"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const orgId = await getPrimaryOrgId(context.supabase, context.userId);
    const { data: member } = await context.supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", context.userId).maybeSingle();
    if (!member || !["admin", "super_admin"].includes((member as any).role)) throw new Error("Only a School Admin can request AI Education Premium.");
    const { data: rows } = await (context.supabase as any).from("ai_education_premium_class_catalog").select("grade,monthly_price_inr,annual_price_inr,active").in("grade", data.grades).eq("active", true);
    const prices = rows?.length === data.grades.length ? rows.map((r: any) => ({ grade:r.grade, monthlyInr:r.monthly_price_inr, annualInr:r.annual_price_inr, active:r.active })) : AI_EDUCATION_PREMIUM_DEFAULT_PRICES;
    const quote = calculateAiEducationPremium(data.grades, prices);
    if (quote.selected.length !== data.grades.length) throw new Error("One or more selected classes are unavailable.");
    const amount = data.billingInterval === "monthly" ? quote.monthlyInr : quote.annualInr;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subscription, error } = await (supabaseAdmin as any).from("ai_education_premium_subscriptions").insert({
      org_id: orgId, billing_interval: data.billingInterval, currency: "inr", base_amount_minor: amount * 100,
      final_amount_minor: amount * 100, status: "pending_payment", created_by: context.userId,
      metadata: { selected_grades: data.grades, pricing_source: "class_catalog" },
    } as any).select("id").single();
    if (error) throw new Error(error.message);
    const entitlementRows = data.grades.map((grade) => ({ subscription_id: subscription.id, org_id: orgId, grade, status: "pending" }));
    // Entitlements are deliberately inactive until a verified provider webhook activates the subscription.
    await (supabaseAdmin as any).from("ai_education_premium_entitlements").insert(entitlementRows as any);
    return { subscriptionId: subscription.id, ...quote, billingInterval: data.billingInterval };
  });
