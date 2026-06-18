import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { getLiveHealth, listHealthSnapshots, captureHealthSnapshot } from "@/lib/health.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle2, Database, Gauge, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/super-admin/health")({
  head: () => ({ meta: [{ title: "Platform health — CurriculumOS" }] }),
  component: HealthPage,
});

function HealthPage() {
  const liveFn = useServerFn(getLiveHealth);
  const histFn = useServerFn(listHealthSnapshots);
  const captureFn = useServerFn(captureHealthSnapshot);
  const qc = useQueryClient();

  const live = useQuery({ queryKey: ["health-live"], queryFn: () => liveFn(), refetchInterval: 60_000 });
  const hist = useQuery({ queryKey: ["health-hist", 24], queryFn: () => histFn({ data: { hours: 24 } }) });

  const capture = useMutation({
    mutationFn: () => captureFn(),
    onSuccess: () => {
      toast.success("Snapshot saved");
      qc.invalidateQueries({ queryKey: ["health-hist", 24] });
      qc.invalidateQueries({ queryKey: ["health-live"] });
    },
    onError: (e: any) => {
      if (e?.message === "Forbidden") toast.error("Super-admin only");
      else toast.error(e?.message ?? "Failed");
    },
  });

  useEffect(() => {
    if (live.error && (live.error as any)?.message === "Forbidden") {
      toast.error("Super-admin only");
    }
  }, [live.error]);

  if (live.isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (live.error) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Super-admin only</h1>
        <Button asChild className="mt-6"><Link to="/admin">Back to admin</Link></Button>
      </div>
    );
  }

  const d = live.data!;
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" /> Platform health
          </h1>
          <p className="text-sm text-muted-foreground">
            Live database metrics + threshold alerts. Auto-refreshing every 60 s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SeverityBadge severity={d.severity} />
          <Button variant="outline" onClick={() => live.refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button onClick={() => capture.mutate()} disabled={capture.isPending}>
            {capture.isPending ? "Saving…" : "Capture snapshot"}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Gauge} label="Connections" value={`${d.metrics.connections_pct ?? 0}%`}
          sub={`${d.metrics.connections_active}/${d.metrics.connections_max}`}
          tone={(d.metrics.connections_pct ?? 0) > d.thresholds.connections_warn ? "warn" : "ok"} />
        <Metric icon={Database} label="DB size" value={`${d.metrics.db_size_mb ?? 0} MB`} tone="ok" />
        <Metric icon={CheckCircle2} label="Cache hit" value={`${d.metrics.cache_hit_pct ?? 0}%`}
          tone={(d.metrics.cache_hit_pct ?? 100) < d.thresholds.cache_hit_info ? "info" : "ok"} />
        <Metric icon={AlertTriangle} label="AI error rate (5m)" value={`${d.errorRate.toFixed(1)}%`}
          sub={`${d.errors}/${d.total} runs`}
          tone={d.errorRate > d.thresholds.error_rate_critical ? "critical" : "ok"} />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Active alerts</CardTitle></CardHeader>
        <CardContent>
          {d.issues.length === 0 ? (
            <p className="text-sm text-emerald-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> All thresholds within range.
            </p>
          ) : (
            <ul className="space-y-2">
              {d.issues.map((i, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <SeverityBadge severity={i.severity} />
                  <div>
                    <p className="font-medium text-sm">{i.rule}</p>
                    <p className="text-xs text-muted-foreground">{i.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <HistorySection snaps={hist.data ?? []} loading={hist.isLoading} />

      <Card className="mt-6">
        <CardHeader><CardTitle>Thresholds</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• Connections &gt; {d.thresholds.connections_warn}% → <Badge variant="secondary">WARN</Badge></p>
          <p>• AI error rate &gt; {d.thresholds.error_rate_critical}% over 5 min → <Badge variant="destructive">CRITICAL</Badge></p>
          <p>• Cache hit &lt; {d.thresholds.cache_hit_info}% → <Badge>INFO</Badge></p>
          <p className="pt-2">Cron `/api/public/cron/health-check` should run every 5 min to persist snapshots and notify super-admins on warn/critical.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function HistorySection({ snaps, loading }: { snaps: any[]; loading: boolean }) {
  const max = useMemo(() => Math.max(1, ...snaps.map((s) => s.connections_pct ?? 0)), [snaps]);
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>Last 24 h — connection pool %</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : snaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No snapshots yet — click "Capture snapshot" or wait for the cron tick.</p>
        ) : (
          <>
            <div className="flex items-end gap-1 h-32">
              {snaps.map((s) => {
                const tone =
                  s.severity === "critical" ? "from-red-500 to-rose-400" :
                  s.severity === "warn" ? "from-amber-500 to-orange-400" :
                  s.severity === "info" ? "from-sky-500 to-cyan-400" :
                  "from-emerald-500 to-teal-400";
                return (
                  <div
                    key={s.id}
                    className={`flex-1 bg-gradient-to-t ${tone} rounded-t hover:opacity-80 transition`}
                    style={{ height: `${((s.connections_pct ?? 0) / max) * 100}%`, minHeight: 3 }}
                    title={`${new Date(s.captured_at).toLocaleString()} • ${s.severity} • conn ${s.connections_pct ?? 0}%, err ${s.error_rate_pct?.toFixed?.(1) ?? 0}%`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{new Date(snaps[0].captured_at).toLocaleString()}</span>
              <span>{new Date(snaps[snaps.length - 1].captured_at).toLocaleString()}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, label, value, sub, tone }: any) {
  const tones: Record<string, string> = {
    ok: "from-emerald-500 to-teal-500",
    info: "from-sky-500 to-cyan-500",
    warn: "from-amber-500 to-orange-500",
    critical: "from-red-500 to-rose-500",
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} p-2.5 text-white shadow-md`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ok: { cls: "bg-emerald-500 text-white", label: "OK" },
    info: { cls: "bg-sky-500 text-white", label: "INFO" },
    warn: { cls: "bg-amber-500 text-white", label: "WARN" },
    critical: { cls: "bg-red-600 text-white", label: "CRITICAL" },
  };
  const v = map[severity] ?? map.ok;
  return <Badge className={v.cls}>{v.label}</Badge>;
}
