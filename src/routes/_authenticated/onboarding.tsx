import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { submitOnboarding } from "@/lib/onboarding.functions";
import { fullOnboardingSchema, type Step1, type Step2, type Step3, type Step4 } from "@/lib/onboarding-schema";
import { BOARDS, FEE_TIERS, CURRENCIES, GRADES, BENCHMARK_DEFAULTS } from "@/lib/regional-benchmarks";
import { sessionEndForStart, sessionLabel, getStreams, getSubjects, inferSubjectKind, SUBJECT_OTHER } from "@/lib/subject-catalog";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingWizard,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORKDAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat checkbox options for per-subject cadence
const SENIOR_GRADES = ["9", "10", "11", "12"];

function makeGS(grade: string, stream: string, subject: string, periods = 5): import("@/lib/onboarding-schema").Step3["grade_subjects"][number] {
  return {
    grade, stream, subject,
    kind: inferSubjectKind(subject),
    weekdays: [1, 2, 3, 4, 5],
    periods_per_week: periods,
    teacher_name: "",
    completed_chapters: "",
  };
}

function OnboardingWizard() {
  const submit = useServerFn(submitOnboarding);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [s1, setS1] = useState<Step1>({
    school_name: "", region: "", country: "", state_province: "", city: "", board: "cbse",
  });
  const [s2, setS2] = useState<Step2>({
    monthly_fee_per_student: undefined, currency: "USD", fee_tier: "mid", textbooks: [],
  });
  const today = new Date();
  const initialStart = today.toISOString().slice(0, 10);
  const initialEnd = sessionEndForStart(initialStart, "", "cbse");
  const [s3, setS3] = useState<Step3>({
    label: sessionLabel(initialStart, initialEnd),
    start_date: initialStart,
    end_date: initialEnd,
    working_days_per_week: BENCHMARK_DEFAULTS.working_days_per_week,
    periods_per_day: BENCHMARK_DEFAULTS.periods_per_day,
    period_duration_minutes: BENCHMARK_DEFAULTS.period_duration_minutes,
    weekly_off_days: BENCHMARK_DEFAULTS.weekly_off_days,
    buffer_days: BENCHMARK_DEFAULTS.buffer_days,
    school_start_time: "08:00",
    school_end_time: "14:30",
    lunch_start_time: "11:30",
    lunch_end_time: "12:00",
    senior_extra_classes: {},
    // Seed 6 rows: 4 core + 2 co-curricular so the timetable reflects a realistic
    // 7-period day with mixed activities (per CurriculumOS scheduling rules).
    grade_subjects: [
      makeGS("8", "", "Mathematics", 6),
      makeGS("8", "", "English", 5),
      makeGS("8", "", "Science", 5),
      makeGS("8", "", "Social Studies", 4),
      makeGS("8", "", "Sports / Games", 2),
      makeGS("8", "", "Art & Craft", 1),
    ],
  });
  const [s4, setS4] = useState<Step4>({
    holidays: [], vacation_breaks: [], events: [], exam_windows: [], training_days: [],
  });

  const progress = (step / 4) * 100;

  function toggleOff(dow: number) {
    setS3((p) => ({
      ...p,
      weekly_off_days: p.weekly_off_days.includes(dow)
        ? p.weekly_off_days.filter((d) => d !== dow)
        : [...p.weekly_off_days, dow].sort(),
    }));
  }

  async function handleSubmit() {
    const parsed = fullOnboardingSchema.safeParse({ step1: s1, step2: s2, step3: s3, step4: s4 });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return toast.error(`${first.path.join(".")}: ${first.message}`);
    }
    setSaving(true);
    try {
      const result = await submit({ data: parsed.data });
      toast.success(`Plan ready — ${result.breakdown.t_available} teaching days available.`);
      navigate({ to: "/results/$yearId", params: { yearId: result.academic_year_id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Onboarding">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Step {step} of 4</span>
            <span>
              {["Institution", "Books & Fees", "Calendar & Teachers", "Holidays & Events"][step - 1]}
            </span>
          </div>
          <Progress value={progress} />
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Institution & location</CardTitle>
              <CardDescription>Tell us where your school operates and which board it follows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="School name" required>
                <Input value={s1.school_name} onChange={(e) => setS1({ ...s1, school_name: e.target.value })} maxLength={200} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Country" required>
                  <Input value={s1.country} onChange={(e) => setS1({ ...s1, country: e.target.value })} />
                </Field>
                <Field label="Region">
                  <Input value={s1.region} onChange={(e) => setS1({ ...s1, region: e.target.value })} placeholder="e.g. South Asia" />
                </Field>
                <Field label="State / Province">
                  <Input value={s1.state_province} onChange={(e) => setS1({ ...s1, state_province: e.target.value })} />
                </Field>
                <Field label="City">
                  <Input value={s1.city} onChange={(e) => setS1({ ...s1, city: e.target.value })} />
                </Field>
              </div>
              <Field label="Examination board" required>
                <Select value={s1.board} onValueChange={(v) => setS1({ ...s1, board: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOARDS.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Fees & textbooks</CardTitle>
              <CardDescription>Leave textbooks blank to let AI suggest a tier-matched set later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Monthly fee / student">
                  <Input type="number" min="0" value={s2.monthly_fee_per_student ?? ""}
                    onChange={(e) => setS2({ ...s2, monthly_fee_per_student: e.target.value ? Number(e.target.value) : undefined })} />
                </Field>
                <Field label="Currency">
                  <Select value={s2.currency} onValueChange={(v) => setS2({ ...s2, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Fee tier" required>
                  <Select value={s2.fee_tier} onValueChange={(v) => setS2({ ...s2, fee_tier: v as Step2["fee_tier"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FEE_TIERS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Textbooks (optional)</Label>
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => setS2({ ...s2, textbooks: [...s2.textbooks, { grade: "1", subject: "Mathematics", title: "", author: "", publisher: "" }] })}>
                    <Plus className="h-3 w-3 mr-1" /> Add textbook
                  </Button>
                </div>
                {s2.textbooks.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 border rounded">No books added — AI will recommend a tier-matched set.</p>
                ) : (
                  <div className="space-y-2">
                    {s2.textbooks.map((tb, i) => (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end border p-2 rounded">
                        <SmallSelect label="Grade" value={tb.grade} onChange={(v) => updateAt(s2.textbooks, i, { ...tb, grade: v }, (v2) => setS2({ ...s2, textbooks: v2 }))} options={GRADES} />
                        <SmallInput label="Subject" value={tb.subject} onChange={(v) => updateAt(s2.textbooks, i, { ...tb, subject: v }, (v2) => setS2({ ...s2, textbooks: v2 }))} />
                        <SmallInput label="Title" value={tb.title ?? ""} onChange={(v) => updateAt(s2.textbooks, i, { ...tb, title: v }, (v2) => setS2({ ...s2, textbooks: v2 }))} />
                        <SmallInput label="Publisher" value={tb.publisher ?? ""} onChange={(v) => updateAt(s2.textbooks, i, { ...tb, publisher: v }, (v2) => setS2({ ...s2, textbooks: v2 }))} />
                        <Button type="button" size="sm" variant="ghost" onClick={() => setS2({ ...s2, textbooks: s2.textbooks.filter((_, j) => j !== i) })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Calendar & teaching matrix</CardTitle>
              <CardDescription>Define the academic year shape and per-subject period allocation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Academic year label">
                <Input value={s3.label} onChange={(e) => setS3({ ...s3, label: e.target.value })} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Start date" required>
                  <Input type="date" value={s3.start_date} onChange={(e) => {
                    const start = e.target.value;
                    const end = start ? sessionEndForStart(start, s1.country, s1.board) : s3.end_date;
                    setS3({ ...s3, start_date: start, end_date: end, label: sessionLabel(start, end) });
                  }} />
                </Field>
                <Field label="End date (auto from country session)" required>
                  <Input type="date" value={s3.end_date} onChange={(e) => setS3({ ...s3, end_date: e.target.value, label: sessionLabel(s3.start_date, e.target.value) })} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                End date is auto-filled to match the {s1.country || "selected country"} academic session
                {" "}(India: April → 31 March). You can override it if your school differs.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="Working days/week">
                  <Input type="number" min="1" max="7" value={s3.working_days_per_week} onChange={(e) => setS3({ ...s3, working_days_per_week: Number(e.target.value) })} />
                </Field>
                <Field label="Periods/day">
                  <Input type="number" min="1" max="15" value={s3.periods_per_day} onChange={(e) => setS3({ ...s3, periods_per_day: Number(e.target.value) })} />
                </Field>
                <Field label="Period (min)">
                  <Input type="number" min="15" max="120" value={s3.period_duration_minutes} onChange={(e) => setS3({ ...s3, period_duration_minutes: Number(e.target.value) })} />
                </Field>
                <Field label="Buffer days">
                  <Input type="number" min="0" max="60" value={s3.buffer_days} onChange={(e) => setS3({ ...s3, buffer_days: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Weekly off days">
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((d, i) => (
                    <Button key={i} type="button" size="sm"
                      variant={s3.weekly_off_days.includes(i) ? "default" : "outline"}
                      onClick={() => toggleOff(i)}>{d}</Button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="School start time">
                  <Input type="time" value={s3.school_start_time ?? ""} onChange={(e) => setS3({ ...s3, school_start_time: e.target.value })} />
                </Field>
                <Field label="School end time">
                  <Input type="time" value={s3.school_end_time ?? ""} onChange={(e) => setS3({ ...s3, school_end_time: e.target.value })} />
                </Field>
                <Field label="Lunch start">
                  <Input type="time" value={s3.lunch_start_time ?? ""} onChange={(e) => setS3({ ...s3, lunch_start_time: e.target.value })} />
                </Field>
                <Field label="Lunch end">
                  <Input type="time" value={s3.lunch_end_time ?? ""} onChange={(e) => setS3({ ...s3, lunch_end_time: e.target.value })} />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                School timings keep the AI plan within your real school day so the suggested
                schedule never bleeds past dismissal. Lunch fields are optional.
              </p>

              <div>
                <Label className="mb-2 block">Extra classes for senior grades (optional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Enable an after-school extra-class window per senior grade. AI will only schedule
                  remedial / board-prep work inside this window so the regular school day stays untouched.
                </p>
                <div className="grid gap-2">
                  {SENIOR_GRADES.map((g) => {
                    const w = s3.senior_extra_classes?.[g] ?? { enabled: false, start_time: "", end_time: "" };
                    const set = (next: { enabled: boolean; start_time: string; end_time: string }) =>
                      setS3({ ...s3, senior_extra_classes: { ...s3.senior_extra_classes, [g]: next } });
                    return (
                      <div key={g} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end border p-2 rounded">
                        <div className="space-y-1">
                          <Label className="text-xs">Grade {g}</Label>
                          <Button type="button" size="sm" variant={w.enabled ? "default" : "outline"}
                            onClick={() => set({ ...w, enabled: !w.enabled })}>
                            {w.enabled ? "Enabled" : "Disabled"}
                          </Button>
                        </div>
                        <SmallInput label="Start" type="time" value={w.start_time ?? ""}
                          onChange={(v) => set({ ...w, start_time: v })} />
                        <SmallInput label="End" type="time" value={w.end_time ?? ""}
                          onChange={(v) => set({ ...w, end_time: v })} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Subjects & co-curricular activities (min 6 — add as many as your school needs)</Label>
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => {
                      const last = s3.grade_subjects[s3.grade_subjects.length - 1];
                      const lastGrade = last?.grade ?? "8";
                      const lastStream = last?.stream ?? "";
                      const subs = getSubjects(s1.country, s1.board, lastGrade, lastStream);
                      setS3({ ...s3, grade_subjects: [...s3.grade_subjects, makeGS(lastGrade, lastStream, subs[0] ?? "Mathematics")] });
                    }}>
                    <Plus className="h-3 w-3 mr-1" /> Add subject row
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Mix core subjects (Math, English, Science, <b>Computer Science</b>, etc.) with co-curricular periods (Sports, Music, Dance, Art & Craft, Karate, etc.).
                  Most schools run 6–9 subjects per grade — use <b>+ Add subject row</b> for every subject taught so the timetable can schedule all of them.
                  For Grades 11–12, pick a <b>stream</b> first to filter electives. Pick <b>"Other"</b> to type any custom subject name.
                  Use <b>weekdays</b> to schedule alternate-day subjects common in senior grades.
                </p>
                <div className="space-y-2">
                  {s3.grade_subjects.map((gs, i) => {
                    const streams = getStreams(s1.country, s1.board, gs.grade);
                    const subjects = getSubjects(s1.country, s1.board, gs.grade, gs.stream);
                    const isOther = !subjects.includes(gs.subject);
                    const subjectSelectValue = isOther ? SUBJECT_OTHER : gs.subject;
                    const setRow = (next: typeof gs) => updateAt(s3.grade_subjects, i, next, (v2) => setS3({ ...s3, grade_subjects: v2 }));
                    return (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end border p-2 rounded">
                        <SmallSelect label="Grade" value={gs.grade}
                          onChange={(v) => {
                            const newStreams = getStreams(s1.country, s1.board, v);
                            const newStream = newStreams.length ? (newStreams.find((s) => s.id === gs.stream)?.id ?? newStreams[0].id) : "";
                            const subs = getSubjects(s1.country, s1.board, v, newStream);
                            setRow({ ...gs, grade: v, stream: newStream, subject: subs.includes(gs.subject) ? gs.subject : (subs[0] ?? gs.subject) });
                          }} options={GRADES} />
                        {streams.length > 0 ? (
                          <div className="space-y-1">
                            <Label className="text-xs">Stream</Label>
                            <Select value={gs.stream || streams[0].id}
                              onValueChange={(v) => {
                                const subs = getSubjects(s1.country, s1.board, gs.grade, v);
                                setRow({ ...gs, stream: v, subject: subs.includes(gs.subject) ? gs.subject : (subs[0] ?? gs.subject) });
                              }}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>{streams.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Stream</Label>
                            <div className="h-8 text-xs text-muted-foreground flex items-center px-2 border rounded bg-muted/30">N/A</div>
                          </div>
                        )}
                        <SmallSelect label="Subject" value={subjectSelectValue}
                          options={subjects}
                          onChange={(v) => {
                            if (v === SUBJECT_OTHER) {
                              setRow({ ...gs, subject: gs.subject && isOther ? gs.subject : "", kind: gs.kind });
                            } else {
                              setRow({ ...gs, subject: v, kind: inferSubjectKind(v) });
                            }
                          }} />
                        <SmallInput label="Periods/wk" type="number" value={String(gs.periods_per_week)} onChange={(v) => setRow({ ...gs, periods_per_week: Number(v) })} />
                        <SmallInput label="Teacher" value={gs.teacher_name ?? ""} onChange={(v) => setRow({ ...gs, teacher_name: v })} />
                        <Button type="button" size="sm" variant="ghost"
                          disabled={s3.grade_subjects.length <= 6}
                          title={s3.grade_subjects.length <= 6 ? "Minimum 6 subject rows required" : "Remove row"}
                          onClick={() => setS3({ ...s3, grade_subjects: s3.grade_subjects.filter((_, j) => j !== i) })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>

                        {(isOther || subjectSelectValue === SUBJECT_OTHER) && (
                          <div className="col-span-2 sm:col-span-6 space-y-1">
                            <Label className="text-xs">Custom subject name</Label>
                            <Input className="h-8 text-sm" placeholder="e.g. Robotics, Sanskrit, Vocational Skill" value={gs.subject}
                              onChange={(e) => setRow({ ...gs, subject: e.target.value })} />
                          </div>
                        )}

                        <div className="col-span-2 sm:col-span-3 space-y-1">
                          <Label className="text-xs">Kind</Label>
                          <div className="flex gap-1">
                            <Button type="button" size="sm" className="h-7"
                              variant={gs.kind === "core" ? "default" : "outline"}
                              onClick={() => setRow({ ...gs, kind: "core" })}>Core</Button>
                            <Button type="button" size="sm" className="h-7"
                              variant={gs.kind === "co_curricular" ? "default" : "outline"}
                              onClick={() => setRow({ ...gs, kind: "co_curricular" })}>Co-curricular</Button>
                          </div>
                        </div>

                        <div className="col-span-2 sm:col-span-3 space-y-1">
                          <Label className="text-xs">Weekdays taught</Label>
                          <div className="flex gap-1 flex-wrap">
                            {WORKDAYS.map((d) => {
                              const on = gs.weekdays.includes(d);
                              return (
                                <Button key={d} type="button" size="sm" className="h-7 px-2"
                                  variant={on ? "default" : "outline"}
                                  onClick={() => setRow({
                                    ...gs,
                                    weekdays: on ? gs.weekdays.filter((x) => x !== d) : [...gs.weekdays, d].sort(),
                                  })}>
                                  {DAYS[d]}
                                </Button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="col-span-2 sm:col-span-6 space-y-1">
                          <Label className="text-xs">Chapters already completed (optional)</Label>
                          <Input
                            className="h-8 text-sm"
                            placeholder="e.g. Ch 1: Number Systems, Ch 2: Polynomials — AI will plan the remaining syllabus from where you stopped"
                            value={gs.completed_chapters ?? ""}
                            onChange={(e) => setRow({ ...gs, completed_chapters: e.target.value })}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Holidays, events & exams</CardTitle>
              <CardDescription>Skip any section to use a balanced baseline calendar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ListSection title="Holidays" rows={s4.holidays}
                addLabel="Add holiday"
                onAdd={() => setS4({ ...s4, holidays: [...s4.holidays, { name: "", date: s3.start_date, scope: "school" }] })}
                onRemove={(i) => setS4({ ...s4, holidays: s4.holidays.filter((_, j) => j !== i) })}
                render={(h, i) => (
                  <>
                    <SmallInput label="Name" value={h.name} onChange={(v) => updateAt(s4.holidays, i, { ...h, name: v }, (v2) => setS4({ ...s4, holidays: v2 }))} />
                    <SmallInput label="Date" type="date" value={h.date} onChange={(v) => updateAt(s4.holidays, i, { ...h, date: v }, (v2) => setS4({ ...s4, holidays: v2 }))} />
                    <SmallSelect label="Scope" value={h.scope} options={["gov", "school"]} onChange={(v) => updateAt(s4.holidays, i, { ...h, scope: v as "gov" | "school" }, (v2) => setS4({ ...s4, holidays: v2 }))} />
                  </>
                )} />
              <ListSection title="Vacation breaks" rows={s4.vacation_breaks}
                addLabel="Add vacation"
                onAdd={() => setS4({ ...s4, vacation_breaks: [...s4.vacation_breaks, { name: "", start_date: s3.start_date, end_date: s3.start_date }] })}
                onRemove={(i) => setS4({ ...s4, vacation_breaks: s4.vacation_breaks.filter((_, j) => j !== i) })}
                render={(v, i) => (
                  <>
                    <SmallInput label="Name" value={v.name} onChange={(x) => updateAt(s4.vacation_breaks, i, { ...v, name: x }, (v2) => setS4({ ...s4, vacation_breaks: v2 }))} />
                    <SmallInput label="Start" type="date" value={v.start_date} onChange={(x) => updateAt(s4.vacation_breaks, i, { ...v, start_date: x }, (v2) => setS4({ ...s4, vacation_breaks: v2 }))} />
                    <SmallInput label="End" type="date" value={v.end_date} onChange={(x) => updateAt(s4.vacation_breaks, i, { ...v, end_date: x }, (v2) => setS4({ ...s4, vacation_breaks: v2 }))} />
                  </>
                )} />
              <ListSection title="Events (with prep days)" rows={s4.events}
                addLabel="Add event"
                onAdd={() => setS4({ ...s4, events: [...s4.events, { name: "", start_date: s3.start_date, end_date: s3.start_date, prep_days: 0 }] })}
                onRemove={(i) => setS4({ ...s4, events: s4.events.filter((_, j) => j !== i) })}
                render={(e, i) => (
                  <>
                    <SmallInput label="Name" value={e.name} onChange={(v) => updateAt(s4.events, i, { ...e, name: v }, (v2) => setS4({ ...s4, events: v2 }))} />
                    <SmallInput label="Start" type="date" value={e.start_date} onChange={(v) => updateAt(s4.events, i, { ...e, start_date: v }, (v2) => setS4({ ...s4, events: v2 }))} />
                    <SmallInput label="End" type="date" value={e.end_date} onChange={(v) => updateAt(s4.events, i, { ...e, end_date: v }, (v2) => setS4({ ...s4, events: v2 }))} />
                    <SmallInput label="Prep days" type="number" value={String(e.prep_days)} onChange={(v) => updateAt(s4.events, i, { ...e, prep_days: Number(v) }, (v2) => setS4({ ...s4, events: v2 }))} />
                  </>
                )} />
              <ListSection title="Exam windows" rows={s4.exam_windows}
                addLabel="Add exam window"
                onAdd={() => setS4({ ...s4, exam_windows: [...s4.exam_windows, { name: "", start_date: s3.start_date, end_date: s3.start_date }] })}
                onRemove={(i) => setS4({ ...s4, exam_windows: s4.exam_windows.filter((_, j) => j !== i) })}
                render={(x, i) => (
                  <>
                    <SmallInput label="Name" value={x.name} onChange={(v) => updateAt(s4.exam_windows, i, { ...x, name: v }, (v2) => setS4({ ...s4, exam_windows: v2 }))} />
                    <SmallInput label="Start" type="date" value={x.start_date} onChange={(v) => updateAt(s4.exam_windows, i, { ...x, start_date: v }, (v2) => setS4({ ...s4, exam_windows: v2 }))} />
                    <SmallInput label="End" type="date" value={x.end_date} onChange={(v) => updateAt(s4.exam_windows, i, { ...x, end_date: v }, (v2) => setS4({ ...s4, exam_windows: v2 }))} />
                  </>
                )} />
              <ListSection title="Teacher training days" rows={s4.training_days}
                addLabel="Add training day"
                onAdd={() => setS4({ ...s4, training_days: [...s4.training_days, { name: "", date: s3.start_date }] })}
                onRemove={(i) => setS4({ ...s4, training_days: s4.training_days.filter((_, j) => j !== i) })}
                render={(t, i) => (
                  <>
                    <SmallInput label="Name" value={t.name} onChange={(v) => updateAt(s4.training_days, i, { ...t, name: v }, (v2) => setS4({ ...s4, training_days: v2 }))} />
                    <SmallInput label="Date" type="date" value={t.date} onChange={(v) => updateAt(s4.training_days, i, { ...t, date: v }, (v2) => setS4({ ...s4, training_days: v2 }))} />
                  </>
                )} />
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 1 || saving}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Compute capacity
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
    </div>
  );
}

function SmallInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input className="h-8 text-sm" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SmallSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function updateAt<T>(arr: T[], i: number, item: T, set: (a: T[]) => void) {
  const next = arr.slice();
  next[i] = item;
  set(next);
}

function ListSection<T>({ title, rows, addLabel, onAdd, onRemove, render }: {
  title: string; rows: T[]; addLabel: string; onAdd: () => void; onRemove: (i: number) => void;
  render: (row: T, i: number) => React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>{title}</Label>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}><Plus className="h-3 w-3 mr-1" />{addLabel}</Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground p-2 border rounded">None added.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end border p-2 rounded">
              {render(row, i)}
              <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
