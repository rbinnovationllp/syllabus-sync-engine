import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const THRESHOLDS = {
  connections_warn: 70,
  latency_warn_ms: 500,
  error_rate_critical: 1,
  cache_hit_info: 80,
};

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("super_admin")) throw new Error("Forbidden");
}

type Severity = "ok" | "info" | "warn" | "critical";
function rankSeverity(s: Severity) {
  return { ok: 0, info: 1, warn: 2, critical: 3 }[s];
}
function maxSev(a: Severity, b: Severity): Severity {
  return rankSeverity(a) >= rankSeverity(b) ? a : b;
}

async function buildSnapshot() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: metricsRaw, error: mErr } = await supabaseAdmin.rpc("get_health_metrics");
  if (mErr) throw new Error(mErr.message);
  const metrics = metricsRaw as Record<string, any>;

  // ai_runs error rate (last 5 min)
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: runs } = await supabaseAdmin
    .from("ai_runs").select("status").gte("created_at", since);
  const total = runs?.length ?? 0;
  const errors = (runs ?? []).filter((r: any) => r.status === "error" || r.status === "failed").length;
  const errorRate = total > 0 ? (errors / total) * 100 : 0;

  // Severity rollup
  const issues: { rule: string; severity: Severity; message: string }[] = [];
  if ((metrics.connections_pct ?? 0) > THRESHOLDS.connections_warn) {
    issues.push({
      rule: "connections",
      severity: "warn",
      message: `Connection pool at ${metrics.connections_pct}% (${metrics.connections_active}/${metrics.connections_max})`,
    });
  }
  if (errorRate > THRESHOLDS.error_rate_critical) {
    issues.push({
      rule: "error_rate",
      severity: "critical",
      message: `AI error rate ${errorRate.toFixed(1)}% over last 5 min (${errors}/${total})`,
    });
  }
  if ((metrics.cache_hit_pct ?? 100) < THRESHOLDS.cache_hit_info) {
    issues.push({
      rule: "cache_hit",
      severity: "info",
      message: `Cache hit ratio ${metrics.cache_hit_pct}% (below ${THRESHOLDS.cache_hit_info}%)`,
    });
  }

  let severity: Severity = "ok";
  for (const i of issues) severity = maxSev(severity, i.severity);

  return {
    metrics,
    errorRate,
    total,
    errors,
    severity,
    issues,
    thresholds: THRESHOLDS,
  };
}

// Live read for super-admin dashboard (no write)
export const getLiveHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    return await buildSnapshot();
  });

// Recent snapshots (history)
export const listHealthSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ hours: z.number().int().min(1).max(168).default(24) }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.hours * 3600 * 1000).toISOString();
    const { data: snaps, error } = await supabaseAdmin
      .from("health_snapshots")
      .select("*")
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return snaps ?? [];
  });

// Persist a snapshot + alert super_admins on CRITICAL (called by dashboard "Capture now" or cron)
export const captureHealthSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    return await persistAndAlert();
  });

export async function persistAndAlert() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const snap = await buildSnapshot();

  const { data: row, error } = await supabaseAdmin
    .from("health_snapshots")
    .insert({
      connections_active: snap.metrics.connections_active,
      connections_max: snap.metrics.connections_max,
      connections_pct: snap.metrics.connections_pct,
      db_size_mb: snap.metrics.db_size_mb,
      cache_hit_pct: snap.metrics.cache_hit_pct,
      deadlocks: snap.metrics.deadlocks,
      rollbacks: snap.metrics.rollbacks,
      errors_5m: snap.errors,
      total_runs_5m: snap.total,
      error_rate_pct: snap.errorRate,
      severity: snap.severity,
      notes: { issues: snap.issues, thresholds: snap.thresholds },
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Alert super_admins (in-app notification; email when infra is wired)
  if (snap.severity === "critical" || snap.severity === "warn") {
    const { data: admins } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "super_admin");
    const summary = snap.issues.map((i) => `• ${i.message}`).join("\n");
    const dedupeBucket = Math.floor(Date.now() / (15 * 60 * 1000)); // dedupe 15-min bucket
    for (const a of admins ?? []) {
      await supabaseAdmin.from("notifications").insert({
        user_id: a.user_id,
        type: "system_health",
        severity: snap.severity === "critical" ? "critical" : "warn",
        title: snap.severity === "critical" ? "Platform health: CRITICAL" : "Platform health: warning",
        body: summary || "Threshold breached.",
        link: "/super-admin/health",
        dedupe_key: `health:${snap.severity}:${dedupeBucket}`,
      }).then(() => {}, () => {}); // ignore dedupe-key conflict
    }
  }

  return row;
}
