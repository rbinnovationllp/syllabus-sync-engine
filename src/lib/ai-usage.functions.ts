import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("admin") && !roles.includes("super_admin")) {
    throw new Error("Forbidden");
  }
}

const filterSchema = z.object({
  days: z.number().int().min(1).max(180).default(30),
  action: z.string().trim().max(80).optional().nullable(),
  status: z.string().trim().max(40).optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
});

export const getAiUsageReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    let q = supabaseAdmin
      .from("ai_runs")
      .select("id, user_id, action, status, credits_spent, error, created_at, year_id, details")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.action) q = q.eq("action", data.action);
    if (data.status) q = q.eq("status", data.status);
    if (data.user_id) q = q.eq("user_id", data.user_id);

    const { data: runs, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((runs ?? []).map((r: any) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, display_name").in("id", userIds)
      : { data: [] as any[] };
    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // Aggregates
    const totals = {
      total_runs: runs?.length ?? 0,
      total_credits: (runs ?? []).reduce((s: number, r: any) => s + (r.credits_spent ?? 0), 0),
      success: (runs ?? []).filter((r: any) => r.status === "success").length,
      failed: (runs ?? []).filter((r: any) => r.status === "error" || r.status === "failed").length,
    };

    const byActionMap = new Map<string, { action: string; runs: number; credits: number; failed: number }>();
    for (const r of runs ?? []) {
      const k = r.action ?? "unknown";
      const cur = byActionMap.get(k) ?? { action: k, runs: 0, credits: 0, failed: 0 };
      cur.runs += 1;
      cur.credits += r.credits_spent ?? 0;
      if (r.status === "error" || r.status === "failed") cur.failed += 1;
      byActionMap.set(k, cur);
    }

    const byUserMap = new Map<string, { user_id: string; email: string; runs: number; credits: number }>();
    for (const r of runs ?? []) {
      const cur = byUserMap.get(r.user_id) ?? {
        user_id: r.user_id,
        email: (profMap.get(r.user_id) as any)?.email ?? r.user_id.slice(0, 8),
        runs: 0,
        credits: 0,
      };
      cur.runs += 1;
      cur.credits += r.credits_spent ?? 0;
      byUserMap.set(r.user_id, cur);
    }

    // Day buckets
    const byDayMap = new Map<string, { day: string; runs: number; credits: number }>();
    for (const r of runs ?? []) {
      const d = r.created_at.slice(0, 10);
      const cur = byDayMap.get(d) ?? { day: d, runs: 0, credits: 0 };
      cur.runs += 1;
      cur.credits += r.credits_spent ?? 0;
      byDayMap.set(d, cur);
    }

    return {
      totals,
      byAction: Array.from(byActionMap.values()).sort((a, b) => b.credits - a.credits),
      byUser: Array.from(byUserMap.values()).sort((a, b) => b.credits - a.credits).slice(0, 50),
      byDay: Array.from(byDayMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
      recent: (runs ?? []).slice(0, 100).map((r: any) => ({
        ...r,
        email: (profMap.get(r.user_id) as any)?.email ?? null,
      })),
    };
  });
