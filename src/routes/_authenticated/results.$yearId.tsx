import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getYearResults } from "@/lib/onboarding.functions";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

function ResultsPage() {
  const { yearId } = Route.useParams();
  const fetchResults = useServerFn(getYearResults);
  const { data, isLoading, error } = useQuery({
    queryKey: ["year-results", yearId],
    queryFn: () => fetchResults({ data: { academic_year_id: yearId } }),
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

  // Per-subject available blocks
  const weeks = Math.max(1, Math.floor(capacity.t_available / Math.max(1, year.working_days_per_week)));
  const perSubject = grade_subjects.map((gs) => ({
    label: `Grade ${gs.grade} · ${gs.subject}`,
    blocks: weeks * gs.periods_per_week,
    teacher: gs.teacher_name,
  }));

  return (
    <AppShell title={year.label}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{year.label}</h1>
        <p className="text-sm text-muted-foreground">{school?.name} · {school?.country} · {school?.board?.toUpperCase()}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Teaching days available</CardDescription></CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{capacity.t_available}</div>
            <div className="text-xs text-muted-foreground mt-1">out of {capacity.c_total} calendar days</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total teaching periods</CardDescription></CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{capacity.total_periods_available.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">{year.periods_per_day} periods/day × {capacity.t_available} days</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Utilization</CardDescription></CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{Math.round((capacity.t_available / capacity.c_total) * 100)}%</div>
            <div className="text-xs text-muted-foreground mt-1">of the calendar year</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Capacity breakdown</CardTitle>
          <CardDescription>How {capacity.c_total} calendar days split across the year.</CardDescription>
        </CardHeader>
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

      <Card>
        <CardHeader>
          <CardTitle>Per-subject teaching blocks</CardTitle>
          <CardDescription>Estimated periods available across the year per grade-subject row.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4">Grade · Subject</th>
                  <th className="py-2 pr-4">Teacher</th>
                  <th className="py-2 pr-4 text-right">Total periods</th>
                </tr>
              </thead>
              <tbody>
                {perSubject.map((p) => (
                  <tr key={p.label} className="border-b">
                    <td className="py-2 pr-4 font-medium">{p.label}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{p.teacher || "—"}</td>
                    <td className="py-2 pr-4 text-right">{p.blocks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" asChild><Link to="/dashboard">Back to dashboard</Link></Button>
      </div>
    </AppShell>
  );
}
