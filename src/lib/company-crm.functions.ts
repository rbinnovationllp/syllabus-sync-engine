import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("super_admin")) throw new Error("Forbidden");
}

function inferPlanCode(priceId?: string | null) {
  const id = (priceId ?? "").toLowerCase();
  if (id.includes("primary_plus")) return "PRI-PLUS";
  if (id.includes("primary")) return "PRI-BASE";
  if (id.includes("middle_plus")) return "MID-PLUS";
  if (id.includes("middle")) return "MID-BASE";
  if (id.includes("high_plus")) return "HIGH-PLUS";
  if (id.includes("high")) return "HIGH-BASE";
  if (id.includes("enterprise_plus")) return "ENT-PLUS";
  if (id.includes("enterprise")) return "ENT-BASE";
  if (id.includes("retail")) return "RET-SINGLE";
  return "UNKNOWN";
}

export const getCompanyCrmOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [accounts, deals, subscriptions, profiles, tickets, catalog, pageViews, recentPageViews] = await Promise.all([
      supabaseAdmin.from("crm_accounts").select("id, name, board, city, country, created_at").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("crm_deals").select("id, name, amount_inr, stage, status, expected_close_date").limit(500),
      supabaseAdmin.from("subscriptions").select("id, user_id, status, price_id, current_period_end, environment, created_at").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("organization_subscription_profiles").select("*, organizations(name)").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("company_crm_support_tickets").select("*, crm_accounts(name), organizations(name)").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("subscription_plan_catalog").select("*").order("monthly_inr", { ascending: true }),
      supabaseAdmin.from("site_page_views").select("visitor_id, path, created_at").gte("created_at", since7d).limit(10000),
      supabaseAdmin.from("site_page_views").select("visitor_id, path, page_title, referrer, created_at").order("created_at", { ascending: false }).limit(25),
    ]);
    if (tickets.error) throw new Error(tickets.error.message);
    const subRows = subscriptions.data ?? [];
    const byPlan: Record<string, number> = {};
    for (const s of subRows as any[]) {
      const code = inferPlanCode(s.price_id);
      byPlan[code] = (byPlan[code] ?? 0) + 1;
    }
    const viewRows = pageViews.data ?? [];
    const uniqueVisitors = new Set(viewRows.map((v: any) => v.visitor_id)).size;
    const views24h = viewRows.filter((v: any) => v.created_at >= since24h).length;
    const visitors24h = new Set(viewRows.filter((v: any) => v.created_at >= since24h).map((v: any) => v.visitor_id)).size;
    const topPages = Object.values(viewRows.reduce((acc: Record<string, any>, row: any) => {
      acc[row.path] ??= { path: row.path, views: 0, visitors: new Set<string>() };
      acc[row.path].views += 1;
      acc[row.path].visitors.add(row.visitor_id);
      return acc;
    }, {})).map((row: any) => ({ path: row.path, views: row.views, visitors: row.visitors.size })).sort((a: any, b: any) => b.views - a.views).slice(0, 10);
    const openTickets = (tickets.data ?? []).filter((t: any) => !["resolved","closed"].includes(t.status));
    const openDeals = (deals.data ?? []).filter((d: any) => d.status === "open");
    return {
      accounts: accounts.data ?? [],
      subscriptions: subRows,
      subscriptionProfiles: profiles.data ?? [],
      tickets: tickets.data ?? [],
      catalog: catalog.data ?? [],
      metrics: {
        schools: accounts.data?.length ?? 0,
        activeSubscriptions: subRows.filter((s: any) => ["active","trialing"].includes(s.status)).length,
        openTickets: openTickets.length,
        openPipelineInr: openDeals.reduce((sum: number, d: any) => sum + Number(d.amount_inr ?? 0), 0),
        visits7d: viewRows.length,
        visitors7d: uniqueVisitors,
        visits24h: views24h,
        visitors24h,
      },
      byPlan,
      siteAnalytics: {
        topPages,
        recent: recentPageViews.data ?? [],
      },
    };
  });

const ticketSchema = z.object({
  account_id: z.string().uuid().optional().nullable(),
  org_id: z.string().uuid().optional().nullable(),
  subject: z.string().trim().min(1).max(220),
  priority: z.enum(["low","normal","high","urgent"]).default("normal"),
  category: z.string().trim().max(80).default("support"),
  due_at: z.string().optional().nullable(),
  notes: z.string().trim().max(3000).optional().nullable(),
});

export const createCompanySupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ticketSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("company_crm_support_tickets").insert({
      ...data,
      owner_user_id: context.userId,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCompanySupportTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["open","waiting","resolved","closed"]),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, any> = { status: data.status };
    if (["resolved","closed"].includes(data.status)) payload.resolved_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("company_crm_support_tickets").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

