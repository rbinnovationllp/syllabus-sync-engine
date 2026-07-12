import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAcademicExecutionDashboard,
  getTeacherExecutionWorkspace,
  recordTeachingProgress,
} from "@/lib/academic-execution.functions";
import { BookOpenCheck, CalendarCheck, ClipboardCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/academic-execution")({
  head: () => ({ meta: [{ title: "Academic Execution Monitoring - CurriculumOS" }] }),
  component: AcademicExecutionPage,
});

function riskLabel(risk: string) {
  if (risk === "completed") return "Completed";
  if (risk === "on_schedule") return "On Schedule";
  if (risk === "behind_schedule") return "Behind Schedule";
  return "At Risk";
}

function riskVariant(risk: string) {
  if (risk === "at_risk") return "destructive";
  if (risk === "behind_schedule") return "secondary";
  return "outline";
}

function progressStatusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AcademicExecutionPage() {
  const qc = useQueryClient();
  const teacherFn = useServerFn(getTeacherExecutionWorkspace);
  const monitorFn = useServerFn(getAcademicExecutionDashboard);
  const saveFn = useServerFn(recordTeachingProgress);

  const teacher = useQuery({
    queryKey: ["teacher-execution-workspace"],
    queryFn: () => teacherFn(),
  });
  const monitor = useQuery({
    queryKey: ["academic-execution-dashboard"],
    queryFn: () => monitorFn(),
    retry: false,
  });

  const assignments = teacher.data?.assignments ?? [];
  const firstAssignment = assignments[0];
  const [assignmentId, setAssignmentId] = useState("");
  const selectedAssignment = useMemo(
    () => assignments.find((a: any) => a.id === assignmentId) ?? firstAssignment,
    [assignments, assignmentId, firstAssignment],
  );

  const [form, setForm] = useState({
    actual_date: new Date().toISOString().slice(0, 10),
    planned_date: "",
    planned_topic: "",
    actual_chapter: "",
    actual_topics: "",
    portion_completed: "",
    student_participation: "",
    activity_or_assessment: "",
    delay_reason: "",
    next_planned_topic: "",
    status: "completed",
    periods_taken: "1",
    remarks: "",
  });

  const save = useMutation({
    mutationFn: () => {
      if (!teacher.data?.year?.id) throw new Error("No academic year found.");
      if (!selectedAssignment) throw new Error("No teacher assignment found.");
      return saveFn({
        data: {
          academic_year_id: teacher.data.year.id,
          teacher_assignment_id: selectedAssignment.id,
          grade: selectedAssignment.grade,
          section: selectedAssignment.section,
          subject: selectedAssignment.subject,
          actual_date: form.actual_date,
          planned_date: form.planned_date || null,
          planned_topic: form.planned_topic || null,
          actual_chapter: form.actual_chapter || null,
          actual_topics: form.actual_topics,
          status: form.status,
          periods_taken: Number(form.periods_taken || 1),
          remarks: [
            form.remarks,
            form.portion_completed ? `Portion completed: ${form.portion_completed}` : "",
            form.student_participation ? `Student participation: ${form.student_participation}` : "",
            form.activity_or_assessment ? `Activity/assessment conducted: ${form.activity_or_assessment}` : "",
            form.delay_reason ? `Reason for delay: ${form.delay_reason}` : "",
            form.next_planned_topic ? `Next planned topic: ${form.next_planned_topic}` : "",
          ].filter(Boolean).join("\n") || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Teaching progress recorded");
      setForm({
        actual_date: new Date().toISOString().slice(0, 10),
        planned_date: "",
        planned_topic: "",
        actual_chapter: "",
        actual_topics: "",
        portion_completed: "",
        student_participation: "",
        activity_or_assessment: "",
        delay_reason: "",
        next_planned_topic: "",
        status: "completed",
        periods_taken: "1",
        remarks: "",
      });
      qc.invalidateQueries({ queryKey: ["teacher-execution-workspace"] });
      qc.invalidateQueries({ queryKey: ["academic-execution-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const d = monitor.data;

  return (
    <AppShell title="Academic Execution">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic Execution & Syllabus Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Track which teacher taught which topic, in which class, on which date, and how the syllabus is progressing.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/assignments">Teacher Assignments</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/school-governance">Governance</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4" /> Daily Teaching Progress
            </CardTitle>
            <CardDescription>Teachers update every scheduled chapter or AI session after class.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!teacher.data?.year ? (
              <p className="text-sm text-muted-foreground">Create an academic year before recording progress.</p>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignment found for your account. Ask the School Admin to assign class and subject access.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Assigned class and subject</Label>
                  <Select value={selectedAssignment?.id ?? ""} onValueChange={setAssignmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignments.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>
                          Grade {a.grade}{a.section ? `-${a.section}` : ""} - {a.subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Class date</Label>
                    <Input type="date" value={form.actual_date} onChange={(e) => setForm({ ...form, actual_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Planned date</Label>
                    <Input type="date" value={form.planned_date} onChange={(e) => setForm({ ...form, planned_date: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Planned topic</Label>
                  <Input value={form.planned_topic} onChange={(e) => setForm({ ...form, planned_topic: e.target.value })} placeholder="Topic planned for this class" />
                </div>
                <div className="space-y-1.5">
                  <Label>Actual chapter</Label>
                  <Input value={form.actual_chapter} onChange={(e) => setForm({ ...form, actual_chapter: e.target.value })} placeholder="Chapter actually taught" />
                </div>
                <div className="space-y-1.5">
                  <Label>Topic taught / session update *</Label>
                  <Textarea value={form.actual_topics} onChange={(e) => setForm({ ...form, actual_topics: e.target.value })} rows={4} placeholder="Write the topic/subtopic taught today, or the scheduled topic if not started/rescheduled" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="partially_completed">Partially Completed</SelectItem>
                        <SelectItem value="rescheduled">Rescheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Periods taken</Label>
                    <Input type="number" min="0" max="20" step="0.5" value={form.periods_taken} onChange={(e) => setForm({ ...form, periods_taken: e.target.value })} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Portion completed</Label>
                    <Input value={form.portion_completed} onChange={(e) => setForm({ ...form, portion_completed: e.target.value })} placeholder="Example: 60%, exercise 2.1, activity 1" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Student participation</Label>
                    <Input value={form.student_participation} onChange={(e) => setForm({ ...form, student_participation: e.target.value })} placeholder="High / moderate / low, notes..." />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Activity or assessment conducted</Label>
                  <Textarea value={form.activity_or_assessment} onChange={(e) => setForm({ ...form, activity_or_assessment: e.target.value })} rows={2} placeholder="Quiz, worksheet, AI demo, lab activity, group discussion..." />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Reason for delay, if any</Label>
                    <Textarea value={form.delay_reason} onChange={(e) => setForm({ ...form, delay_reason: e.target.value })} rows={2} placeholder="Holiday, assembly, slow progress, rescheduled class..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Next planned topic</Label>
                    <Textarea value={form.next_planned_topic} onChange={(e) => setForm({ ...form, next_planned_topic: e.target.value })} rows={2} placeholder="Topic/chapter/session planned next" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Remarks</Label>
                  <Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={3} placeholder="Delay reason, student response, homework, next action..." />
                </div>

                <Button className="w-full" disabled={save.isPending || !form.actual_topics.trim()} onClick={() => save.mutate()}>
                  Save teaching progress
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <Metric icon={CalendarCheck} label="Classes conducted" value={d?.summary.classesConducted ?? 0} />
            <Metric icon={BookOpenCheck} label="Avg. completion" value={`${d?.summary.averageCompletion ?? 0}%`} />
            <Metric icon={ShieldAlert} label="Behind schedule" value={d?.summary.behind ?? 0} />
            <Metric icon={ShieldAlert} label="At risk" value={d?.summary.atRisk ?? 0} danger />
            <Metric icon={ShieldAlert} label="Delayed / rescheduled" value={d?.summary.delayedOrRescheduled ?? 0} danger={(d?.summary.delayedOrRescheduled ?? 0) > 0} />
            <Metric icon={ClipboardCheck} label="Missed updates" value={d?.summary.missedProgressUpdates ?? 0} danger={(d?.summary.missedProgressUpdates ?? 0) > 0} />
            <Metric icon={BookOpenCheck} label="Monthly completion" value={`${d?.summary.monthlyCompletionStatus ?? 0}%`} />
            <Metric icon={CalendarCheck} label="Today's AI classes" value="Schedule sync pending" />
          </div>

          {((d?.summary.missedProgressUpdates ?? 0) > 0 || (d?.summary.delayedOrRescheduled ?? 0) > 0) && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-950">
                Automatic alerts should be reviewed for missed teacher updates and chapters not completed within the scheduled period.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Principal & School Super Admin Monitoring Dashboard</CardTitle>
              <CardDescription>Today&apos;s AI classes, chapter status, teacher-wise progress, class-wise completion, delays, missed updates, and monthly completion status.</CardDescription>
            </CardHeader>
            <CardContent>
              {!d?.rows?.length ? (
                <p className="text-sm text-muted-foreground">No progress records yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last taught</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.rows.map((row: any) => (
                      <TableRow key={`${row.teacher_user_id}-${row.grade}-${row.subject}`}>
                        <TableCell>{row.teacher}</TableCell>
                        <TableCell>Grade {row.grade}{row.section ? `-${row.section}` : ""}</TableCell>
                        <TableCell>{row.subject}</TableCell>
                        <TableCell>
                          <div className="min-w-36">
                            <Progress value={row.completion} />
                            <span className="text-xs text-muted-foreground">{row.completion}% completed</span>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={riskVariant(row.risk) as any}>{riskLabel(row.risk)}</Badge></TableCell>
                        <TableCell>{row.lastTaught ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Teaching Records</CardTitle>
            </CardHeader>
            <CardContent>
              {!d?.logs?.length ? (
                <p className="text-sm text-muted-foreground">No class records yet.</p>
              ) : (
                <div className="space-y-3">
                  {d.logs.map((log: any) => (
                    <div key={log.id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">
                          Grade {log.grade}{log.section ? `-${log.section}` : ""} - {log.subject}
                        </div>
                        <Badge variant="outline">{progressStatusLabel(log.status)}</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{log.actual_date} - {log.actual_topics}</p>
                      {log.remarks && <p className="mt-1 text-xs text-muted-foreground">Remarks: {log.remarks}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ icon: Icon, label, value, danger }: { icon: any; label: string; value: any; danger?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Icon className={danger ? "h-4 w-4 text-red-600" : "h-4 w-4"} /> {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={danger ? "text-3xl font-bold text-red-700" : "text-3xl font-bold"}>{value}</div>
      </CardContent>
    </Card>
  );
}
