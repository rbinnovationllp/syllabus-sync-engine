import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns current-month usage counts for the signed-in user so the plan
 * limits page can render usage-vs-quota bars. Tier resolution + limit
 * lookup stays client-side (uses `plans.ts` + `useSubscription`).
 */
export const getMyUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const periodMonth = month.toISOString().slice(0, 10);

    const [usageRes, gradesRes, yearsRes, seatsRes, grantsRes] = await Promise.all([
      supabase
        .from("plan_usage")
        .select("ai_credits_used, exports_used")
        .eq("user_id", userId)
        .eq("period_month", periodMonth)
        .maybeSingle(),
      supabase.from("grade_subjects").select("grade", { count: "exact", head: true }),
      supabase.from("academic_years").select("id", { count: "exact", head: true }),
      supabase.from("org_members").select("user_id", { count: "exact", head: true }),
      supabase
        .from("ai_credit_grants")
        .select("credits_remaining")
        .eq("user_id", userId),
    ]);

    const grantBalance = ((grantsRes.data ?? []) as Array<{ credits_remaining: number }>)
      .reduce((sum, g) => sum + (g.credits_remaining ?? 0), 0);

    return {
      periodMonth,
      aiCreditsUsed: (usageRes.data as { ai_credits_used: number } | null)?.ai_credits_used ?? 0,
      aiCreditsTopUpRemaining: grantBalance,
      exportsUsed: (usageRes.data as { exports_used: number } | null)?.exports_used ?? 0,
      gradeCount: gradesRes.count ?? 0,
      academicYearCount: yearsRes.count ?? 0,
      seatCount: seatsRes.count ?? 0,
    };
  });
