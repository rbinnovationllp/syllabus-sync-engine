import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getStudentLearningIntelligence } from "@/lib/v2.phase2.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/v2/student-intelligence")({ component: StudentIntelligencePage });

function StudentIntelligencePage() {
  const fn = useServerFn(getStudentLearningIntelligence);
  const { data, isLoading } = useQuery({ queryKey: ["v2-student-intelligence"], queryFn: () => fn() });

  return (
    <AppShell title="Student Learning Intelligence">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Learning Intelligence</h1>
          <p className="text-sm text-muted-foreground">At-risk cohorts, weak-area planning, and intervention readiness.</p>
        </div>
        <Button asChild variant="outline"><Link to={"/v2/parent-hub" as any}>Parent Hub</Link></Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><CardTitle>Learning cohorts</CardTitle><CardDescription>Prepared for attendance, homework, assessment, and weak-chapter signals.</CardDescription></div>
                <Badge variant={data?.hasStudentData ? "secondary" : "outline"}>{data?.hasStudentData ? `${data.studentCount} students` : "Student data pending"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {(data?.cohorts ?? []).map((cohort: any) => (
                <div key={cohort.label} className="rounded-md border p-4">
                  <div className="flex justify-between gap-3 text-sm"><span className="font-medium">{cohort.label}</span><span>{cohort.value}%</span></div>
                  <Progress className="mt-3" value={cohort.value} />
                  <p className="mt-2 text-xs text-muted-foreground">{cohort.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Intervention plan</CardTitle><CardDescription>Next steps before individual student scoring.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {(data?.interventionPlan ?? []).map((item: string) => <div key={item} className="rounded-md border p-3 text-sm">{item}</div>)}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
