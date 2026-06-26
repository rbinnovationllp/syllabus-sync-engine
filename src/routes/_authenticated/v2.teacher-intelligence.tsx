import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getTeacherPerformanceIntelligence } from "@/lib/v2.phase2.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/v2/teacher-intelligence")({ component: TeacherIntelligencePage });

function riskVariant(risk: string) {
  return risk === "high" ? "destructive" : risk === "watch" ? "secondary" : "outline";
}

function TeacherIntelligencePage() {
  const fn = useServerFn(getTeacherPerformanceIntelligence);
  const { data, isLoading } = useQuery({ queryKey: ["v2-teacher-intelligence"], queryFn: () => fn() });

  return (
    <AppShell title="Teacher Performance Intelligence">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teacher Performance Intelligence</h1>
          <p className="text-sm text-muted-foreground">Department-level completion, pending workload, and intervention signals.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to={"/v2/principal" as any}>Principal Dashboard</Link></Button>
          <Button asChild variant="outline"><Link to={"/v2/digital-twin" as any}>Digital Twin</Link></Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardDescription>Teachers tracked</CardDescription></CardHeader><CardContent><div className="text-3xl font-bold">{data?.summary.teachers ?? 0}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Average completion</CardDescription></CardHeader><CardContent><div className="text-3xl font-bold">{data?.summary.averageCompletion ?? 0}%</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>High risk</CardDescription></CardHeader><CardContent><div className="text-3xl font-bold text-red-700">{data?.summary.highRisk ?? 0}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Watch list</CardDescription></CardHeader><CardContent><div className="text-3xl font-bold text-amber-700">{data?.summary.watch ?? 0}</div></CardContent></Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader><CardTitle>Teacher workload board</CardTitle><CardDescription>Completion is currently based on generated grade-subject plans.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {(data?.teachers ?? []).map((teacher: any) => (
                  <div key={teacher.teacher} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{teacher.teacher}</div>
                        <p className="text-xs text-muted-foreground">{teacher.subjects.slice(0, 4).join(", ")}</p>
                      </div>
                      <Badge variant={riskVariant(teacher.risk) as any}>{teacher.risk}</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px]">
                      <Progress value={teacher.completion} />
                      <div className="text-sm text-muted-foreground">{teacher.completed}/{teacher.assigned} complete, {teacher.pending} pending</div>
                    </div>
                  </div>
                ))}
                {(!data?.teachers || data.teachers.length === 0) && <p className="text-sm text-muted-foreground">No teacher rows found yet.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Monthly recommendations</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(data?.recommendations ?? []).map((item: string) => <div key={item} className="rounded-md border p-3 text-sm">{item}</div>)}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
