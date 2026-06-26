import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Bot, CalendarDays, Gauge, GraduationCap, Sparkles, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getV2PrincipalDashboard, generateV2Draft } from "@/lib/v2.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/v2/principal")({
  component: PrincipalDashboardPage,
});

function toneClass(tone: string) {
  if (tone === "good") return "text-emerald-700";
  if (tone === "risk") return "text-red-700";
  return "text-amber-700";
}

function PrincipalDashboardPage() {
  const dashboardFn = useServerFn(getV2PrincipalDashboard);
  const askFn = useServerFn(generateV2Draft);
  const [question, setQuestion] = useState("Which academic risks need principal attention this week?");
  const [answer, setAnswer] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["v2-principal-dashboard"], queryFn: () => dashboardFn() });
  const ask = useMutation({
    mutationFn: () => askFn({ data: { module: "principal_dashboard", resource_type: "Management answer", prompt: question, save: true } }),
    onSuccess: (r: any) => setAnswer(r.content),
  });

  return (
    <AppShell title="AI Principal Dashboard">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Principal Dashboard</h1>
          <p className="text-sm text-muted-foreground">Executive academic health, risk alerts, and management assistant.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to={"/v2/copilot" as any}><Sparkles className="mr-2 h-4 w-4" /> Teacher Copilot</Link></Button>
          <Button asChild variant="outline"><Link to={"/v2/content-studio" as any}>Content Studio</Link></Button>
          <Button asChild><Link to={"/v2/assessments" as any}>Assessments</Link></Button>
          <Button asChild variant="outline"><Link to={"/v2/digital-twin" as any}>Digital Twin</Link></Button>
          <Button asChild variant="outline"><Link to={"/v2/teacher-intelligence" as any}>Teachers</Link></Button>
          <Button asChild variant="outline"><Link to={"/v2/student-intelligence" as any}>Students</Link></Button>
          <Button asChild variant="outline"><Link to={"/v2/parent-hub" as any}>Parent Hub</Link></Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : !data?.year ? (
        <Card><CardHeader><CardTitle>No academic year found</CardTitle><CardDescription>Create an academic year before using V2 intelligence.</CardDescription></CardHeader></Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{data.year.label}</CardTitle>
              <CardDescription>{data.year.schools?.name} - {data.year.schools?.country} - {data.year.schools?.board?.toUpperCase()}</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.metrics.map((metric: any) => (
              <Card key={metric.label}>
                <CardHeader className="pb-2"><CardDescription>{metric.label}</CardDescription></CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${toneClass(metric.tone)}`}>{metric.value}{metric.suffix}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" /> Curriculum risk alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.alerts.length === 0 ? <p className="text-sm text-muted-foreground">No major risk alerts.</p> : data.alerts.map((alert: any) => (
                  <div key={alert.title} className="rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{alert.title}</span><Badge variant={alert.level === "critical" ? "destructive" : "secondary"}>{alert.level}</Badge></div>
                    <p className="mt-1 text-sm text-muted-foreground">{alert.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" /> Readiness</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(data.readiness).map(([label, value]: any) => (
                  <div key={label} className="space-y-1">
                    <div className="flex justify-between text-sm capitalize"><span>{label}</span><span>{value}%</span></div>
                    <Progress value={value} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Upcoming examinations</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.upcomingExams.length ? data.upcomingExams.map((e: any) => <div key={e.id} className="rounded-md border p-2">{e.name || e.label || "Exam"}<br /><span className="text-muted-foreground">{e.start_date} - {e.end_date}</span></div>) : <p className="text-muted-foreground">No upcoming exams found.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4" /> Upcoming events</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.upcomingEvents.length ? data.upcomingEvents.map((e: any) => <div key={e.id} className="rounded-md border p-2">{e.name || "Event"}<br /><span className="text-muted-foreground">{e.start_date} - {e.end_date}</span></div>) : <p className="text-muted-foreground">No upcoming events found.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Teacher interventions</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.teacherInterventions.length ? data.teacherInterventions.map((t: any) => <div key={t.teacher} className="flex justify-between rounded-md border p-2"><span>{t.teacher}</span><Badge variant="outline">{t.count} pending</Badge></div>) : <p className="text-muted-foreground">No intervention queue.</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" /> Management assistant</CardTitle><CardDescription>Ask leadership questions using the current academic context.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} />
              <Button onClick={() => ask.mutate()} disabled={ask.isPending}>{ask.isPending ? "Thinking..." : "Ask assistant"}</Button>
              {answer && <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm">{answer}</pre>}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

