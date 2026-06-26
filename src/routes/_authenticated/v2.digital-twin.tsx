import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Activity, ArrowRight, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { simulateAcademicScenario } from "@/lib/v2.phase2.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/v2/digital-twin")({ component: DigitalTwinPage });

function DigitalTwinPage() {
  const simulateFn = useServerFn(simulateAcademicScenario);
  const [scenarioType, setScenarioType] = useState("Additional school closure");
  const [lostDays, setLostDays] = useState(5);
  const [affectedTeacher, setAffectedTeacher] = useState("");
  const [examShiftDays, setExamShiftDays] = useState(0);
  const [notes, setNotes] = useState("Simulate impact on syllabus completion, revision time, and teacher workload.");
  const simulation = useMutation({
    mutationFn: () => simulateFn({ data: { scenario_type: scenarioType, lost_days: lostDays, affected_teacher: affectedTeacher || null, exam_shift_days: examShiftDays, notes, save: true } }),
  });
  const result = simulation.data as any;

  return (
    <AppShell title="Academic Digital Twin">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic Digital Twin</h1>
          <p className="text-sm text-muted-foreground">Model closures, exam shifts, teacher gaps, and recovery plans before they hit the timetable.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to={"/v2/principal" as any}>Principal Dashboard</Link></Button>
          <Button asChild variant="outline"><Link to={"/v2/teacher-intelligence" as any}>Teacher Intelligence</Link></Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Scenario controls</CardTitle>
            <CardDescription>Enter the disruption and run a planning simulation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Scenario</Label><Input value={scenarioType} onChange={(e) => setScenarioType(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Lost days</Label><Input type="number" value={lostDays} onChange={(e) => setLostDays(Number(e.target.value))} /></div>
              <div className="space-y-2"><Label>Exam shift days</Label><Input type="number" value={examShiftDays} onChange={(e) => setExamShiftDays(Number(e.target.value))} /></div>
            </div>
            <div className="space-y-2"><Label>Affected teacher</Label><Input value={affectedTeacher} onChange={(e) => setAffectedTeacher(e.target.value)} placeholder="Optional" /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <Button className="w-full" onClick={() => simulation.mutate()} disabled={simulation.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" /> {simulation.isPending ? "Simulating..." : "Run simulation"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            {(result?.metrics ?? [
              { label: "Current syllabus readiness", value: 0, suffix: "%" },
              { label: "Projected readiness", value: 0, suffix: "%" },
              { label: "Teacher load pressure", value: 0, suffix: "/100" },
              { label: "Revision risk", value: 0, suffix: "/100" },
            ]).map((metric: any) => (
              <Card key={metric.label}>
                <CardHeader className="pb-2"><CardDescription>{metric.label}</CardDescription></CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{metric.value}{metric.suffix}</div>
                  <Progress className="mt-3" value={metric.value} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recovery recommendations</CardTitle>
              <CardDescription>AI-ready recommendations based on your current academic year data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(result?.recommendations ?? ["Run a simulation to see recovery recommendations."]).map((item: string) => (
                <div key={item} className="flex gap-3 rounded-md border p-3">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm">{item}</p>
                </div>
              ))}
              {result?.saved && <Badge variant="secondary">Simulation saved</Badge>}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
