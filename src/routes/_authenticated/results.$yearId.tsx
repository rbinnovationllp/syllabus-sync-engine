import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getYearResults } from "@/lib/onboarding.functions";
import {
  generateAnnualCalendar,
  generateSubjectCurriculum,
  recalculateSchedule,
  getYearArtifacts,
  listAiRunsForYear,
  getAiCreditBalance,
} from "@/lib/ai-generation.functions";
import { exportYearPdf, exportYearDocx } from "@/lib/exports.functions";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Sparkles, RotateCcw, FileDown, FileText, Loader2 } from "lucide-react";
import { VersionHistoryDialog } from "@/components/VersionHistoryDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/results/$yearId")({
  component: ResultsPage,
});

const BUCKET_COLORS: Record<string, string> = {
  Available: "hsl(var(--primary))",
  "Gov holidays": "#ef4444",
  "School holidays": "#f97316",
  Vacations: "#eab308",
  Events: "#a855f7",
  Exams: "#ec4899",
  Training: "#06b6d4",
  "Weekly offs": "#94a3b8",
  Buffer: "#64748b",
};

function handleAiError(res: any): boolean {
  if (!res || typeof res !== "object") return false;
  if ("error" in res) {
    if (res.error === "PAID_PLAN_REQUIRED") {
      toast.error(
        res.message ??
          "Subscribe to your category plan to generate full annual curricula. Your free 30-day preview covers one subject only.",
        {
          action: { label: "View plans", onClick: () => (window.location.href = "/pricing") },
        },
      );
    } else if (res.error === "INSUFFICIENT_CREDITS") {
      toast.error("Not enough AI credits.", {
        action: { label: "Top up", onClick: () => (window.location.href = "/pricing") },
      });
    } else {
      toast.error(res.message || res.error);
    }
    return true;
  }
  return false;
}

function downloadBase64(filename: string, mime: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ResultsPage() {
  const { yearId } = Route.useParams();
  const fetchResults = useServerFn(getYearResults);
  const fetchArtifacts = useServerFn(getYearArtifacts);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["year-results", yearId],
    queryFn: () => fetchResults({ data: { academic_year_id: yearId } }),
  });
  const artifacts = useQuery({
    queryKey: ["year-artifacts", yearId],
    queryFn: () => fetchArtifacts({ data: { year_id: yearId } }),
  });
  const fetchRuns = useServerFn(listAiRunsForYear);
  const runs = useQuery({
    queryKey: ["year-ai-runs", yearId],
    queryFn: () => fetchRuns({ data: { year_id: yearId } }),
  });
  const fetchBalance = useServerFn(getAiCreditBalance);
  const balance = useQuery({
    queryKey: ["ai-credit-balance"],
    queryFn: () => fetchBalance(),
  });
  const invalidateRunBits = () => {
    qc.invalidateQueries({ queryKey: ["year-artifacts", yearId] });
    qc.invalidateQueries({ queryKey: ["year-ai-runs", yearId] });
    qc.invalidateQueries({ queryKey: ["ai-credit-balance"] });
  };

  const genCalFn = useServerFn(generateAnnualCalendar);
  const genSubFn = useServerFn(generateSubjectCurriculum);
  const recalcFn = useServerFn(recalculateSchedule);
  const exportPdfFn = useServerFn(exportYearPdf);
  const exportDocxFn = useServerFn(exportYearDocx);

  const genCal = useMutation({
    mutationFn: () => genCalFn({ data: { year_id: yearId } }),
    onSuccess: (r) => {
      if (handleAiError(r)) return;
      toast.success("Annual calendar generated");
      invalidateRunBits();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const genSub = useMutation({
    mutationFn: (v: { grade: string; subject: string }) =>
      genSubFn({ data: { year_id: yearId, grade: v.grade, subject: v.subject } }),
    onSuccess: (r) => {
      if (handleAiError(r)) return;
      toast.success("Curriculum generated");
      invalidateRunBits();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const [disruption, setDisruption] = useState("");
  const [recalcOpen, setRecalcOpen] = useState(false);
  const recalc = useMutation({
    mutationFn: () => recalcFn({ data: { year_id: yearId, disruption } }),
    onSuccess: (r) => {
      if (handleAiError(r)) return;
      toast.success("Schedule recalibrated");
      setRecalcOpen(false);
      setDisruption("");
      invalidateRunBits();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const exportPdf = useMutation({
    mutationFn: () => exportPdfFn({ data: { year_id: yearId } }),
    onSuccess: (r: any) => {
      downloadBase64(r.filename, r.mime, r.base64);
      if (r.unpaid) toast.info("Exported with DEMO watermark — subscribe to remove.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const exportDocx = useMutation({
    mutationFn: () => exportDocxFn({ data: { year_id: yearId } }),
    onSuccess: (r: any) => {
      downloadBase64(r.filename, r.mime, r.base64);
      if (r.unpaid) toast.info("Exported with DEMO watermark — subscribe to remove.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (isLoading) return <AppShell><div className="text-sm text-muted-foreground">Loading…</div></AppShell>;
  if (error || !data) return <AppShell><div className="text-sm text-destructive">Failed to load.</div></AppShell>;

  const { year, school, capacity, grade_subjects } = data;
  if (!capacity) return <AppShell><div>No capacity computed yet.</div></AppShell>;

  const chartData = [
    { name: "Available", days: capacity.t_available },
    { name: "Gov holidays", days: capacity.h_gov },
    { name: "School holidays", days: capacity.h_school },
    { name: "Vacations", days: capacity.v_vacation },
    { name: "Events", days: capacity.e_events },
    { name: "Exams", days: capacity.x_exams },
    { name: "Training", days: capacity.t_training },
    { name: "Weekly offs", days: capacity.w_offs },
    { name: "Buffer", days: capacity.b_buffer },
  ].filter((d) => d.days > 0);

  const weeks = Math.max(1, Math.floor(capacity.t_available / Math.max(1, year.working_days_per_week)));
  const perSubject = grade_subjects.map((gs) => ({
    label: `Grade ${gs.grade} · ${gs.subject}`,
    grade: String(gs.grade),
    subject: gs.subject,
    blocks: weeks * gs.periods_per_week,
    teacher: gs.teacher_name,
  }));

  const calendar = (artifacts.data as any)?.calendar ?? null;
  const curricula: any[] = (artifacts.data as any)?.curricula ?? [];
  const hasSub = (artifacts.data as any)?.hasSubscription ?? false;

  return (
    <AppShell title={year.label}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{year.label}</h1>
          <p className="text-sm text-muted-foreground">{school?.name} · {school?.country} · {school?.board?.toUpperCase()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => genCal.mutate()} disabled={genCal.isPending}>
            {genCal.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate annual calendar
          </Button>
          <Dialog open={recalcOpen} onOpenChange={setRecalcOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><RotateCcw className="mr-2 h-4 w-4" />Recalculate</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Recalculate schedule</DialogTitle></DialogHeader>
              <Label htmlFor="dis">Describe the disruption</Label>
              <Input id="dis" value={disruption} onChange={(e) => setDisruption(e.target.value)} placeholder="e.g. 5-day cyclone closure in October" />
              <DialogFooter>
                <Button onClick={() => recalc.mutate()} disabled={disruption.length < 5 || recalc.isPending}>
                  {recalc.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Recalibrate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => exportPdf.mutate()} disabled={exportPdf.isPending}>
            <FileDown className="mr-2 h-4 w-4" />PDF
          </Button>
          <Button variant="outline" onClick={() => exportDocx.mutate()} disabled={exportDocx.isPending}>
            <FileText className="mr-2 h-4 w-4" />DOCX
          </Button>
        </div>
      </div>

      {!hasSub && (
        <Card className="mb-4 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 text-sm">
            <span className="font-medium">Free trial:</span> generate a 30-day preview curriculum for <b>one subject</b> from today.
            To unlock the full annual curriculum across all your subjects, <Link to="/pricing" className="text-primary underline">subscribe to your category plan</Link>. Exports remain watermarked until you subscribe.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card><CardHeader className="pb-2"><CardDescription>Teaching days available</CardDescription></CardHeader>
          <CardContent><div className="text-4xl font-bold text-primary">{capacity.t_available}</div>
            <div className="text-xs text-muted-foreground mt-1">out of {capacity.c_total} calendar days</div>
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total teaching periods</CardDescription></CardHeader>
          <CardContent><div className="text-4xl font-bold">{capacity.total_periods_available.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{year.periods_per_day} periods/day × {capacity.t_available} days</div>
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Utilization</CardDescription></CardHeader>
          <CardContent><div className="text-4xl font-bold">{Math.round((capacity.t_available / capacity.c_total) * 100)}%</div>
            <div className="text-xs text-muted-foreground mt-1">of the calendar year</div>
          </CardContent></Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">AI credit balance</CardTitle>
            <CardDescription>Credits are reserved when you click Generate and refunded automatically if the AI run fails.</CardDescription>
          </div>
          <Button size="sm" variant="outline" asChild><Link to="/pricing">Top up</Link></Button>
        </CardHeader>
        <CardContent>
          {balance.isLoading || !balance.data ? (
            <div className="text-sm text-muted-foreground">Loading balance…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><div className="text-2xl font-bold">{balance.data.total_remaining}</div><div className="text-xs text-muted-foreground">Total remaining</div></div>
              <div><div className="text-2xl font-bold">{balance.data.monthly_remaining}</div><div className="text-xs text-muted-foreground">Plan quota left</div></div>
              <div><div className="text-2xl font-bold">{balance.data.grant_remaining}</div><div className="text-xs text-muted-foreground">Top-up credits</div></div>
              <div><div className="text-2xl font-bold">{balance.data.monthly_used}</div><div className="text-xs text-muted-foreground">Used this month</div></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Capacity breakdown</CardTitle>
          <CardDescription>How {capacity.c_total} calendar days split across the year.</CardDescription></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="days">
                  {chartData.map((d, i) => <Cell key={i} fill={BUCKET_COLORS[d.name] ?? "#888"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {calendar?.plan?.months?.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Annual calendar</CardTitle>
                <CardDescription>AI-generated month-by-month plan.</CardDescription>
              </div>
              <VersionHistoryDialog year_id={yearId} entity_type="annual_calendar" canRestore />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {calendar.plan.months.map((m: any, i: number) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{m.label || m.month}</div>
                    <Badge variant="secondary">{m.teaching_days} days</Badge>
                  </div>
                  {m.focus_topics?.length > 0 && <div className="mt-2 text-xs"><span className="font-medium">Focus:</span> {m.focus_topics.join(", ")}</div>}
                  {m.assessments?.length > 0 && <div className="text-xs"><span className="font-medium">Assessments:</span> {m.assessments.join(", ")}</div>}
                  {m.events?.length > 0 && <div className="text-xs"><span className="font-medium">Events:</span> {m.events.join(", ")}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Per-subject curriculum</CardTitle>
          <CardDescription>Generate a chapter-by-chapter plan for each grade-subject row.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Grade · Subject</th>
                <th className="py-2 pr-4">Teacher</th>
                <th className="py-2 pr-4 text-right">Total periods</th>
                <th className="py-2 pr-4 text-right">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {perSubject.map((p) => {
                const cur = curricula.find((c) => String(c.grade) === p.grade && c.subject === p.subject);
                const isPending = genSub.isPending && genSub.variables?.grade === p.grade && genSub.variables?.subject === p.subject;
                return (
                  <tr key={p.label} className="border-b align-top">
                    <td className="py-2 pr-4 font-medium">{p.label}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{p.teacher || "—"}</td>
                    <td className="py-2 pr-4 text-right">{p.blocks.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">
                      {cur ? <Badge>{(cur.chapters as any[])?.length ?? 0} chapters</Badge> : <span className="text-xs text-muted-foreground">not generated</span>}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Button size="sm" variant="outline" disabled={isPending}
                        onClick={() => genSub.mutate({ grade: p.grade, subject: p.subject })}>
                        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : cur ? "Regenerate" : "Generate"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {curricula.length > 0 && (
        <div className="mt-6 space-y-4">
          {curricula.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Grade {c.grade} · {c.subject}
                  {c.meta?.preview && <Badge variant="secondary" className="text-[10px]">30-day preview</Badge>}
                </CardTitle>
                {c.meta?.summary && <CardDescription>{c.meta.summary}</CardDescription>}
                {c.meta?.preview && (
                  <CardDescription className="text-amber-700 dark:text-amber-300">
                    Preview only — subscribe to your category plan to unlock the full annual curriculum.
                  </CardDescription>
                )}
                {c.meta?.completed_chapters && (
                  <CardDescription className="text-xs">Resuming after: {c.meta.completed_chapters}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  {((c.chapters as any[]) ?? []).map((ch: any, i: number) => (
                    <li key={i} className="flex gap-3">
                      <span className="font-mono text-xs text-muted-foreground w-8 pt-0.5">{ch.seq}.</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{ch.title}</span>
                          <Badge variant={ch.difficulty === "tough" ? "destructive" : ch.difficulty === "medium" ? "secondary" : "outline"} className="text-[10px]">{ch.difficulty}</Badge>
                          <span className="text-xs text-muted-foreground">wk {ch.week_no} · {ch.periods} pds</span>
                        </div>
                        {ch.objectives?.length > 0 && <div className="text-xs text-muted-foreground">{ch.objectives.join(" · ")}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">AI generation history</CardTitle>
          <CardDescription>Every annual calendar, subject curriculum and recalculation run for this year — with status, credits, and any errors returned by the model.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {runs.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (runs.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">No AI runs yet. Generate a calendar or curriculum to see history here.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Credits</th>
                  <th className="py-2 pr-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {(runs.data ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b align-top">
                    <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3 text-xs">{String(r.action).replaceAll("_", " ")}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={r.status === "success" ? "default" : "destructive"} className="text-[10px]">{r.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-right">{r.credits_spent}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {r.error ? <span className="text-destructive">{r.error}</span>
                        : r.details && Object.keys(r.details).length > 0
                          ? Object.entries(r.details).map(([k, v]) => `${k}: ${v}`).join(" · ")
                          : r.lovable_run_id ? <span className="font-mono">{String(r.lovable_run_id).slice(0, 12)}…</span> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" asChild><Link to="/dashboard">Back to dashboard</Link></Button>
      </div>
    </AppShell>
  );
}
