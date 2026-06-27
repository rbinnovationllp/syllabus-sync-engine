import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PUBLIC_VISITOR_BASELINE = 176;
const PUBLIC_VISIT_BASELINE = 412;
const PUBLIC_WEEK_VISITOR_BASELINE = 38;

const visitSchema = z.object({
  visitorId: z.string().trim().min(8).max(120),
  path: z.string().trim().min(1).max(500),
  pageTitle: z.string().trim().max(250).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  userAgent: z.string().trim().max(500).optional().nullable(),
  screenWidth: z.number().int().positive().max(10000).optional().nullable(),
  screenHeight: z.number().int().positive().max(10000).optional().nullable(),
});

function cleanPath(path: string) {
  try {
    const url = new URL(path, "https://syllabus-synk.in");
    return `${url.pathname}${url.search ? url.search.slice(0, 180) : ""}`;
  } catch {
    return path.slice(0, 500);
  }
}

export const recordSiteVisit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => visitSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const path = cleanPath(data.path);
    if (
      path.startsWith("/api/") ||
      path.startsWith("/assets/") ||
      path.includes("favicon") ||
      path.includes("robots.txt")
    ) {
      return { ok: true, skipped: true };
    }

    const { error } = await supabaseAdmin.from("site_page_views").insert({
      visitor_id: data.visitorId,
      path,
      page_title: data.pageTitle ?? null,
      referrer: data.referrer ?? null,
      user_agent: data.userAgent ?? null,
      screen_width: data.screenWidth ?? null,
      screen_height: data.screenHeight ?? null,
    });

    if (error) {
      console.warn("Could not record site visit", error.message);
      return { ok: false };
    }

    return { ok: true };
  });

async function countRows(supabaseAdmin: any, table: string, build?: (q: any) => any) {
  let query = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
  if (build) query = build(query);
  const { count, error } = await query;
  if (error) {
    console.warn(`Could not count ${table}`, error.message);
    return 0;
  }
  return count ?? 0;
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

async function getVisitorCounts(supabaseAdmin: any, since?: string) {
  let query = supabaseAdmin.from("site_page_views").select("visitor_id, created_at").limit(100000);
  if (since) query = query.gte("created_at", since);
  const { data, error } = await query;
  if (error) {
    console.warn("Could not read visitor analytics", error.message);
    return { visits: 0, visitors: 0 };
  }
  return {
    visits: data?.length ?? 0,
    visitors: new Set((data ?? []).map((row: any) => row.visitor_id)).size,
  };
}

export const getPublicSiteStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const all = await getVisitorCounts(supabaseAdmin);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const week = await getVisitorCounts(supabaseAdmin, since7d);

    return {
      totalVisits: all.visits,
      totalVisitors: all.visitors,
      visits7d: week.visits,
      visitors7d: week.visitors,
    };
  });

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("super_admin")) throw new Error("Forbidden");
}

export const getVisitorConversionReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [allVisitors, weekVisitors, leadsAll, leads7d, activeSubscriptions, subscriptions7d] = await Promise.all([
      getVisitorCounts(supabaseAdmin),
      getVisitorCounts(supabaseAdmin, since7d),
      countRows(supabaseAdmin, "leads"),
      countRows(supabaseAdmin, "leads", (q) => q.gte("created_at", since7d)),
      countRows(supabaseAdmin, "subscriptions", (q) => q.in("status", ["active", "trialing"])),
      countRows(supabaseAdmin, "subscriptions", (q) => q.gte("created_at", since7d)),
    ]);

    return {
      allTime: {
        visits: allVisitors.visits,
        visitors: allVisitors.visitors,
        leads: leadsAll,
        activeSubscriptions,
        visitorToLead: percent(leadsAll, allVisitors.visitors),
        visitorToSubscription: percent(activeSubscriptions, allVisitors.visitors),
      },
      last7Days: {
        visits: weekVisitors.visits,
        visitors: weekVisitors.visitors,
        leads: leads7d,
        subscriptions: subscriptions7d,
        visitorToLead: percent(leads7d, weekVisitors.visitors),
        visitorToSubscription: percent(subscriptions7d, weekVisitors.visitors),
      },
    };
  });



