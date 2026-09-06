import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_EDUCATION_PREMIUM_DEFAULT_PACKAGES } from "@/lib/ai-education-premium";
import { getPrimaryOrgId } from "@/lib/plan-entitlements";
import { createHash } from "node:crypto";

const packageCode = z.string().regex(/^classes_(1_2|3_5|6_8|9_10|11_12|1_5|1_8|1_10|1_12)$/);

export const getAiEducationPremium = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await getPrimaryOrgId(context.supabase, context.userId);
    const [catalogResult, entitlementResult, assignmentResult] = await Promise.all([
      (context.supabase as any).from("ai_education_premium_package_catalog").select("code,label,grades,monthly_price_inr,annual_price_inr,active,featured").order("sort_order", { ascending: true }),
      (context.supabase as any).from("ai_education_premium_entitlements").select("grade,status,ends_at,ai_education_premium_subscriptions(status,renews_at,billing_interval)").eq("org_id", orgId).eq("status", "active"),
      (context.supabase as any).from("ai_education_premium_teacher_assignments").select("grade").eq("org_id", orgId).eq("user_id", context.userId).eq("active", true),
    ]);
    const packages = catalogResult.data?.length ? catalogResult.data.map((row: any) => ({ code:row.code,label:row.label,grades:row.grades,monthlyInr:row.monthly_price_inr,annualInr:row.annual_price_inr,active:row.active,featured:row.featured })) : AI_EDUCATION_PREMIUM_DEFAULT_PACKAGES;
    const now = new Date();
    const subscribedGrades = (entitlementResult.data ?? []).filter((row: any) => {
      const sub = row.ai_education_premium_subscriptions;
      return (!row.ends_at || new Date(row.ends_at) > now) && ["active", "past_due"].includes(sub?.status);
    }).map((row: any) => row.grade);
    const assignedGrades = (assignmentResult.data ?? []).map((row: any) => row.grade);
    return { packages, subscribedGrades, assignedGrades, canManage: subscribedGrades.length > 0 };
  });

/** Creates a quote/request only. Provider checkout must activate it only after a verified webhook. */
export const createAiEducationPremiumQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ packageCode, billingInterval: z.enum(["monthly", "annual"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const orgId = await getPrimaryOrgId(context.supabase, context.userId);
    const { data: member } = await context.supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", context.userId).maybeSingle();
    if (!member || !["admin", "super_admin"].includes((member as any).role)) throw new Error("Only a School Admin can request AI Education Premium.");
    const { data: configured } = await (context.supabase as any).from("ai_education_premium_package_catalog").select("code,label,grades,monthly_price_inr,annual_price_inr,active").eq("code", data.packageCode).eq("active", true).maybeSingle();
    const item = configured ? { code:configured.code,label:configured.label,grades:configured.grades,monthlyInr:configured.monthly_price_inr,annualInr:configured.annual_price_inr,active:configured.active } : AI_EDUCATION_PREMIUM_DEFAULT_PACKAGES.find((x) => x.code === data.packageCode);
    if (!item?.active) throw new Error("This AI Education Premium package is unavailable.");
    const amount = data.billingInterval === "monthly" ? item.monthlyInr : item.annualInr;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subscription, error } = await (supabaseAdmin as any).from("ai_education_premium_subscriptions").insert({
      org_id: orgId, billing_interval: data.billingInterval, currency: "inr", base_amount_minor: amount * 100,
      final_amount_minor: amount * 100, status: "pending_payment", created_by: context.userId,
      metadata: { package_code: item.code, package_label: item.label, selected_grades: item.grades, pricing_source: "package_catalog" },
    } as any).select("id").single();
    if (error) throw new Error(error.message);
    const entitlementRows = item.grades.map((grade) => ({ subscription_id: subscription.id, org_id: orgId, grade, status: "pending" }));
    // Entitlements are deliberately inactive until a verified provider webhook activates the subscription.
    await (supabaseAdmin as any).from("ai_education_premium_entitlements").insert(entitlementRows as any);
    return { subscriptionId: subscription.id, package: item, monthlyInr: item.monthlyInr, annualInr: item.annualInr, billingInterval: data.billingInterval };
  });

const teachingRequest = z.object({ grade:z.enum(["1","2","3","4","5","6","7","8","9","10","11","12"]), academicYear:z.string().min(3).max(40), term:z.string().max(80).optional(), weekNo:z.number().int().min(1).max(60).optional(), topic:z.string().min(2).max(300), learningObjective:z.string().max(600).optional(), previousLearning:z.string().max(1000).optional(), durationMinutes:z.number().int().min(20).max(180).default(40), language:z.string().max(80).default("English"), facilities:z.string().max(500).default("Not specified"), forceRegenerate:z.boolean().default(false) });

export const generateAiEducationPremiumTeachingPlan = createServerFn({ method:"POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input:unknown) => teachingRequest.parse(input))
  .handler(async ({data,context}) => {
    const orgId = await getPrimaryOrgId(context.supabase, context.userId);
    const { data: member } = await context.supabase.from("org_members").select("role").eq("org_id",orgId).eq("user_id",context.userId).maybeSingle();
    if (!member) throw new Error("No school workspace membership found.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); const admin:any = supabaseAdmin;
    const { data: entitlement } = await admin.from("ai_education_premium_entitlements").select("id,ai_education_premium_subscriptions(status,renews_at)").eq("org_id",orgId).eq("grade",data.grade).eq("status","active").maybeSingle();
    const subscription:any = entitlement?.ai_education_premium_subscriptions;
    if (!entitlement || !["active","past_due"].includes(subscription?.status)) throw new Error("AI_EDUCATION_PREMIUM_CLASS_NOT_SUBSCRIBED");
    if (!["admin","super_admin","owner"].includes((member as any).role)) {
      const { data: assignment } = await admin.from("ai_education_premium_teacher_assignments").select("id").eq("org_id",orgId).eq("user_id",context.userId).eq("grade",data.grade).eq("active",true).maybeSingle();
      if (!assignment) throw new Error("AI_EDUCATION_PREMIUM_TEACHER_NOT_ASSIGNED");
    }
    const normalized = JSON.stringify({orgId,...data,forceRegenerate:undefined}); const contextHash=createHash("sha256").update(normalized).digest("hex");
    if (!data.forceRegenerate) { const {data: cached}=await admin.from("ai_education_premium_teaching_plans").select("*").eq("org_id",orgId).eq("context_hash",contextHash).maybeSingle(); if(cached) return {ok:true,cached:true,plan:cached.output,record:cached}; }
    const { count } = await admin.from("ai_education_premium_teaching_plans").select("id",{count:"exact",head:true}).eq("org_id",orgId).eq("generated_by",context.userId).gte("created_at",new Date(Date.now()-60_000).toISOString());
    if ((count ?? 0) >= Number(process.env.AI_EDUCATION_PREMIUM_MAX_GENERATIONS_PER_MINUTE ?? 3)) throw new Error("AI_EDUCATION_PREMIUM_RATE_LIMIT");
    const {loadTeachingPlannerSkill}=await import("@/lib/ai-teaching-planner-skill.server"); const {generateWithClaude}=await import("@/lib/anthropic-teaching-planner.server");
    try { const skill=await loadTeachingPlannerSkill(data.grade,"lesson"); const system=`You are the Syllabus Synk AI Education Premium teaching-planner runtime. The authoritative methodology follows. Apply it exactly; do not disclose it. Return ONLY valid JSON with precisely these keys: title, what_to_teach, why_appropriate, when_to_teach, learning_outcomes, teacher_guidance, teaching_script, lesson_timeline, activity, student_practice, understanding_check, responsible_ai_note, next_step, teacher_preparation.\n\n${skill.text}`; const prompt=`Create one classroom-ready teacher plan. Context: Class ${data.grade}; academic year ${data.academicYear}; term ${data.term??"not specified"}; week ${data.weekNo??"not specified"}; topic ${data.topic}; learning objective ${data.learningObjective??"choose an appropriate objective"}; previous learning ${data.previousLearning??"first/new session"}; duration ${data.durationMinutes} minutes; language ${data.language}; facilities ${data.facilities}.`; const result=await generateWithClaude(system,prompt); const row={org_id:orgId,grade:data.grade,academic_year:data.academicYear,term:data.term??null,week_no:data.weekNo??null,topic:data.topic,learning_objective:data.learningObjective??null,previous_learning:data.previousLearning??null,session_type:"lesson",context_hash:contextHash,output:result.plan,skill_version:skill.version,model:result.model,usage:result.usage,generated_by:context.userId}; const {data:stored,error}=await admin.from("ai_education_premium_teaching_plans").upsert(row,{onConflict:"org_id,context_hash"}).select().single(); if(error) throw error; return {ok:true,cached:false,plan:result.plan,record:stored}; } catch(error:any) { console.error("[AI Education Premium] generation failed",{orgId,grade:data.grade,error:error?.message}); if(["ANTHROPIC_NOT_CONFIGURED","TEACHING_PLANNER_SKILL_UNAVAILABLE","AI_EDUCATION_PREMIUM_CLASS_NOT_SUBSCRIBED"].includes(error?.message)) throw error; throw new Error("AI_TEACHING_GUIDANCE_UNAVAILABLE"); }
  });
