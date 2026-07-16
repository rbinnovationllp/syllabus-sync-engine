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
import {
  generateDailyTeachingHelp,
  getDailyTeachingAssistantPlan,
} from "@/lib/teaching-assistant.functions";
import { BookOpenCheck, CalendarCheck, ClipboardCheck, Lightbulb, Scale, ShieldAlert, Sparkles } from "lucide-react";

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
  const dailyPlanFn = useServerFn(getDailyTeachingAssistantPlan);
  const dailyHelpFn = useServerFn(generateDailyTeachingHelp);

  const teacher = useQuery({
    queryKey: ["teacher-execution-workspace"],
    queryFn: () => teacherFn(),
  });
  const monitor = useQuery({
    queryKey: ["academic-execution-dashboard"],
    queryFn: () => monitorFn(),
    retry: false,
  });
  const dailyPlan = useQuery({
    queryKey: ["daily-teaching-assistant-plan"],
    queryFn: () => dailyPlanFn(),
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
  const [dailyHelpOptions, setDailyHelpOptions] = useState({
    selected_portion: "",
    student_question: "",
    local_context: "",
  });
  const [dailyHelpResult, setDailyHelpResult] = useState<any>(null);

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

  const generateDailyHelp = useMutation({
    mutationFn: ({ lesson, request_type }: { lesson: any; request_type: string }) => dailyHelpFn({
      data: {
        academic_year_id: lesson.academic_year_id,
        teacher_assignment_id: lesson.teacher_assignment_id,
        planned_date: lesson.planned_date,
        grade: lesson.grade,
        section: lesson.section,
        subject: lesson.subject,
        board: lesson.board,
        book: lesson.book,
        chapter: lesson.chapter,
        topic: lesson.topic,
        learning_objectives: lesson.learning_objectives ?? [],
        selected_portion: dailyHelpOptions.selected_portion || null,
        student_question: dailyHelpOptions.student_question || null,
        local_context: dailyHelpOptions.local_context || null,
        request_type,
      } as any,
    }),
    onSuccess: (row: any) => {
      setDailyHelpResult(row);
      toast.success(`Teaching help generated using ${row.cost} credit${row.cost === 1 ? "" : "s"}`);
      dailyPlan.refetch();
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
        <div className="space-y-5">
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

        <DailyTeachingAssistantPanel
          dailyPlan={dailyPlan}
          options={dailyHelpOptions}
          setOptions={setDailyHelpOptions}
          result={dailyHelpResult}
          generate={generateDailyHelp}
        />
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <Metric icon={CalendarCheck} label="Classes conducted" value={d?.summary.classesConducted ?? 0} />
            <Metric icon={BookOpenCheck} label="Avg. completion" value={`${d?.summary.averageCompletion ?? 0}%`} />
            <Metric icon={ShieldAlert} label="Behind schedule" value={d?.summary.behind ?? 0} />
            <Metric icon={ShieldAlert} label="At risk" value={d?.summary.atRisk ?? 0} danger />
            <Metric icon={ShieldAlert} label="Delayed / rescheduled" value={d?.summary.delayedOrRescheduled ?? 0} danger={(d?.summary.delayedOrRescheduled ?? 0) > 0} />
            <Metric icon={ClipboardCheck} label="Missed updates" value={d?.summary.missedProgressUpdates ?? 0} danger={(d?.summary.missedProgressUpdates ?? 0) > 0} />
            <Metric icon={BookOpenCheck} label="Monthly completion" value={`${d?.summary.monthlyCompletionStatus ?? 0}%`} />
            <Metric icon={Scale} label="Workload alerts" value={d?.summary.overloadedTeachers ?? 0} danger={(d?.summary.overloadedTeachers ?? 0) > 0} />
            <Metric icon={CalendarCheck} label="Today's AI classes" value="Schedule sync pending" />
          </div>

          {((d?.summary.missedProgressUpdates ?? 0) > 0 || (d?.summary.delayedOrRescheduled ?? 0) > 0) && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm text-amber-950">
                Automatic alerts and exception reports should be reviewed for missed teacher updates and chapters not completed within the scheduled period.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Syllabus Exception Reports</CardTitle>
              <CardDescription>
                Automatic comparison of assigned work against completed work, pending portions, delay impact, and corrective recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!d?.exceptionReports?.length ? (
                <p className="text-sm text-muted-foreground">No daily syllabus exceptions found.</p>
              ) : (
                <div className="space-y-3">
                  {d.exceptionReports.map((report: any) => (
                    <div key={report.id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">
                          {report.teacher} - Grade {report.grade}{report.section ? `-${report.section}` : ""} - {report.subject}
                        </div>
                        <Badge variant={["not_started", "not_covered", "rescheduled"].includes(report.status) ? "destructive" : "secondary"}>
                          {progressStatusLabel(report.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <ReportLine label="Assigned work" value={report.assignedWork} />
                        <ReportLine label="Completed work" value={report.completedWork} />
                        <ReportLine label="Pending portion" value={report.pendingPortion} />
                        <ReportLine label="Delay duration" value={`${report.delayDurationDays} day${report.delayDurationDays === 1 ? "" : "s"}`} />
                        <ReportLine label="Syllabus impact" value={report.impact} />
                        <ReportLine label="Corrective recommendation" value={report.recommendation} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Teacher Credit Distribution Recommendations</CardTitle>
              <CardDescription>
                Advisory workload scoring for School Super Admin review across classes, subjects, weekly periods, duties, and additional responsibilities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!d?.teacherCreditRecommendations?.length ? (
                <p className="text-sm text-muted-foreground">No teacher assignment data available for workload recommendations.</p>
              ) : (
                <div className="space-y-3">
                  {d.teacherCreditRecommendations.map((row: any) => (
                    <div key={row.teacher_user_id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{row.teacher}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {row.classCount} class{row.classCount === 1 ? "" : "es"} · {row.subjectCount} subject{row.subjectCount === 1 ? "" : "s"} · {row.weeklyPeriods} weekly periods
                          </div>
                        </div>
                        <Badge variant={workloadVariant(row.workloadStatus) as any}>
                          {workloadLabel(row.workloadStatus)} · Score {row.creditScore}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <ReportLine label="Academic responsibilities" value={row.academicResponsibilities} />
                        <ReportLine label="Examination duties" value={row.examinationDuties} />
                        <ReportLine label="Co-curricular responsibilities" value={row.coCurricularResponsibilities} />
                        <ReportLine label="Special projects" value={row.specialProjects} />
                      </div>
                      <p className="mt-3 text-muted-foreground">{row.recommendation}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.advisoryNote}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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

function ReportLine({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="mt-1">{value || "-"}</div>
    </div>
  );
}

const DAILY_HELP_ACTIONS = [
  { type: "explain_full_topic", label: "Explain Full Topic" },
  { type: "explain_selected_portion", label: "Explain Selected Portion" },
  { type: "activity_support", label: "Generate Activity" },
  { type: "real_life_examples", label: "Real-Life Examples" },
  { type: "teacher_notes", label: "Teacher Notes" },
  { type: "student_question_help", label: "Student Question Help" },
  { type: "beyond_textbook_explanation", label: "Beyond Textbook" },
  { type: "revision_summary", label: "Revision Summary" },
];

function DailyTeachingAssistantPanel({ dailyPlan, options, setOptions, result, generate }: any) {
  const lessons = dailyPlan.data?.lessons ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4" /> Daily Teaching Assistant
        </CardTitle>
        <CardDescription>
          Syllabus-aware help for today&apos;s planned lessons. Uses class, subject, board, book, chapter, topic, objectives, and academic calendar context automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {dailyPlan.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading today&apos;s scheduled topics...</p>
        ) : dailyPlan.error ? (
          <p className="text-sm text-muted-foreground">{(dailyPlan.error as Error).message}</p>
        ) : lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scheduled lesson was found for your account today. Confirm teacher assignments and generated subject curriculum.</p>
        ) : (
          <>
            <div className="space-y-3">
              {lessons.map((lesson: any) => (
                <div key={lesson.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        Grade {lesson.grade}{lesson.section ? `-${lesson.section}` : ""} - {lesson.subject}
                      </div>
                      <div className="text-muted-foreground">{lesson.chapter}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {lesson.board || "Board not set"} · {lesson.book || "Book not linked"} · Week {lesson.current_week_no}
                      </div>
                    </div>
                    <Badge variant="outline">{lesson.source === "subject_curriculum_week" ? "Planned topic" : "Assignment fallback"}</Badge>
                  </div>
                  {lesson.learning_objectives?.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {lesson.learning_objectives.slice(0, 3).map((objective: string, index: number) => <li key={`${lesson.id}-${index}`}>{objective}</li>)}
                    </ul>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {DAILY_HELP_ACTIONS.map((action) => (
                      <Button
                        key={action.type}
                        size="sm"
                        variant={action.type === "activity_support" ? "default" : "outline"}
                        disabled={generate.isPending}
                        onClick={() => generate.mutate({ lesson, request_type: action.type })}
                      >
                        {generate.isPending ? <Sparkles className="mr-2 h-3.5 w-3.5 animate-pulse" /> : null}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label>Selected portion, heading, formula, definition, diagram, or paragraph</Label>
                <Textarea
                  rows={3}
                  value={options.selected_portion}
                  onChange={(e) => setOptions({ ...options, selected_portion: e.target.value })}
                  placeholder="Use before Explain Selected Portion, or leave blank for full topic."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Student question beyond the prescribed book</Label>
                <Textarea
                  rows={3}
                  value={options.student_question}
                  onChange={(e) => setOptions({ ...options, student_question: e.target.value })}
                  placeholder="Students asked..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Local context</Label>
                <Input
                  value={options.local_context}
                  onChange={(e) => setOptions({ ...options, local_context: e.target.value })}
                  placeholder="School campus, local market, farms, weather, community..."
                />
              </div>
            </div>

            {result ? (
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-medium">Generated Teaching Help</div>
                  <Badge variant="secondary">{result.credits_spent ?? result.cost ?? 0} credits</Badge>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{result.response}</pre>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function workloadLabel(status: string) {
  if (status === "high_overload") return "High overload";
  if (status === "moderate_overload") return "Moderate overload";
  if (status === "underutilized") return "Underutilized";
  return "Balanced";
}

function workloadVariant(status: string) {
  if (status === "high_overload" || status === "underutilized") return "destructive";
  if (status === "moderate_overload") return "secondary";
  return "outline";
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
