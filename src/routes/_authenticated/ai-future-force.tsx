import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { activateAiFutureForce, getAiFutureForce } from "@/lib/ai-future-force.functions";
import { BrainCircuit, CalendarDays, Lock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ai-future-force")({
  head: () => ({ meta: [{ title: "AI Future Force - Syllabus Synk" }] }),
  component: AiFutureForcePage,
});

function AiFutureForcePage() {
  const qc = useQueryClient();
  const fetchModule = useServerFn(getAiFutureForce);
  const activate = useServerFn(activateAiFutureForce);
  const { data, isLoading } = useQuery({
    queryKey: ["ai-future-force"],
    queryFn: () => fetchModule(),
  });

  const [form, setForm] = useState({
    wants_ai_future_force: false,
    band: "primary",
    session_start_date: new Date().toISOString().slice(0, 10),
    session_end_date: "",
    remaining_teaching_months: "12",
    weekly_classes_per_week: "1",
  });

  const activation = useMutation({
    mutationFn: () => activate({ data: { ...form, wants_ai_future_force: true } }),
    onSuccess: () => {
      toast.success("AI Future Force activation request saved. Activate after payment confirmation.");
      qc.invalidateQueries({ queryKey: ["ai-future-force"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bands = data?.bands ?? {};
  const selected = (bands as any)[form.band];
  const remainingMonths = Number(form.remaining_teaching_months || 0);
  const finalMonthEnrollment = remainingMonths <= 1;

  return (
    <AppShell title="AI Future Force">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BrainCircuit className="h-7 w-7 text-primary" /> AI Future Force
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Premium AI education curriculum for schools. Monthly content updates keep students aligned
            with new AI tools, case studies, technologies, projects, and global industry developments.
          </p>
          <p className="mt-2 max-w-3xl text-sm font-medium text-primary">
            {data?.adoptionMessage ?? "AI Future Force is optional and can be reviewed before activation."}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/pricing">View Plans</Link>
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Activate Course</CardTitle>
              <CardDescription>
                Optional add-on. Schools choose it only after reviewing pricing, preview, schedule, and benefits.
              </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!data?.plusEligible && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-semibold">
                  <Lock className="h-4 w-4" /> Plus plan required
                </div>
                <p className="mt-1">
                  Upgrade to Primary Plus, Middle Plus, High Plus, or Enterprise Plus to activate this module.
                </p>
              </div>
            )}

            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <Checkbox
                checked={form.wants_ai_future_force}
                onCheckedChange={(checked) => setForm({ ...form, wants_ai_future_force: checked === true })}
                className="mt-0.5"
              />
              <span>
                <span className="block font-semibold">Activate AI Future Force as an optional add-on</span>
                <span className="text-muted-foreground">
                  This is not automatically included with a normal school subscription. The school confirms it wants this AI education program.
                </span>
              </span>
            </label>

            <div className="space-y-1.5">
              <Label>Course band</Label>
              <Select value={form.band} onValueChange={(band) => setForm({ ...form, band })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary School - Classes 1-5 - Rs. 1,000 + GST</SelectItem>
                  <SelectItem value="middle">Middle School - Classes 6-8 - Rs. 2,000 + GST</SelectItem>
                  <SelectItem value="higher">Higher Secondary - Classes 9-12 - Rs. 5,000 + GST</SelectItem>
                  <SelectItem value="enterprise">Enterprise - Classes 1-12 - Rs. 10,000/mo + GST</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Session start</Label>
                <Input
                  type="date"
                  value={form.session_start_date}
                  onChange={(e) => setForm({ ...form, session_start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Session end</Label>
                <Input
                  type="date"
                  value={form.session_end_date}
                  onChange={(e) => setForm({ ...form, session_end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Preferred AI class frequency</Label>
              <Select
                value={form.weekly_classes_per_week}
                onValueChange={(weekly_classes_per_week) => setForm({ ...form, weekly_classes_per_week })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">One AI class per week</SelectItem>
                  <SelectItem value="2">Two AI classes per week</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This choice is stored for the school and used by the AI curriculum planning engine.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Remaining teaching months</Label>
              <Input
                type="number"
                min="0"
                max="12"
                value={form.remaining_teaching_months}
                onChange={(e) => setForm({ ...form, remaining_teaching_months: e.target.value })}
              />
            </div>

            {finalMonthEnrollment && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                <div className="font-semibold">Late-session enrollment rule</div>
                <p className="mt-1">
                  Since less than one teaching month remains, the system will generate an AI Foundation Module now.
                  The remaining grade-level curriculum will be carried forward into the next academic session.
                </p>
              </div>
            )}

            {selected && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-semibold">{selected.label}</div>
                <div className="mt-1 text-muted-foreground">
                  {selected.billing === "monthly subscription" ? "Monthly subscription" : "One-time activation"}: Rs. {selected.price.toLocaleString()}
                  {selected.billing === "monthly subscription" ? " / mo" : ""} + GST
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {selected.focus.map((item: string) => <Badge key={item} variant="outline">{item}</Badge>)}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {form.weekly_classes_per_week === "1"
                    ? "One weekly class keeps AI adoption gradual without disturbing regular academic work."
                    : "Two weekly classes allow more project work, practical activities, and guided lab time."}
                </p>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!data?.plusEligible || !form.wants_ai_future_force || activation.isPending || !form.session_end_date}
              onClick={() => activation.mutate()}
            >
              Request AI Future Force activation
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" /> Monthly Release Model
              </CardTitle>
              <CardDescription>
                Content is released one month at a time. The next month opens 2 days before the current month ends.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {[
                "AI technology evolves continuously worldwide.",
                "Monthly updates keep tools, examples, projects, and case studies current.",
                "Inactive subscriptions do not receive future monthly content.",
                "The plan compresses automatically when fewer teaching months remain.",
                "Final-month enrollments receive an AI Foundation Module first, then continue in the next session.",
                "Previously released content remains visible; future content requires active payment verification.",
              ].map((item) => (
                <div key={item} className="rounded-md border p-3 text-sm">{item}</div>
              ))}
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Curriculum Preview Before Subscription</CardTitle>
                <CardDescription>
                  Grade-wise structure, objectives, outcomes, and activity examples for management review.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="font-semibold">{selected.label}</div>
                  <p className="mt-1 text-muted-foreground">
                    Designed to prepare students for future careers while complementing existing education,
                    regular subject periods, revision, examinations, and school activities.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.grades.map((grade: string) => <Badge key={grade} variant="secondary">Grade {grade}</Badge>)}
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  {selected.preview.map((chapter: any) => (
                    <div key={chapter.chapter} className="rounded-md border p-3 text-sm">
                      <div className="font-semibold">{chapter.chapter}</div>
                      <div className="mt-2 text-xs font-medium uppercase text-muted-foreground">Learning objectives</div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {chapter.objectives.map((item: string) => <li key={item}>{item}</li>)}
                      </ul>
                      <div className="mt-3 text-xs font-medium uppercase text-muted-foreground">Expected outcomes</div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {chapter.outcomes.map((item: string) => <li key={item}>{item}</li>)}
                      </ul>
                      <div className="mt-3 text-xs font-medium uppercase text-muted-foreground">Projects and activities</div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {chapter.activities.map((item: string) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(data?.activations ?? []).map((activation: any) => (
            <Card key={activation.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4" /> {activation.band.toUpperCase()} Course Plan
                </CardTitle>
                <CardDescription>{activation.compression_note}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">Status: {activation.status}</Badge>
                  <Badge variant="outline">{activation.remaining_teaching_months} teaching months</Badge>
                  <Badge variant="outline">{activation.weekly_classes_per_week ?? 1} AI class{(activation.weekly_classes_per_week ?? 1) === 1 ? "" : "es"} / week</Badge>
                  <Badge variant="outline">{activation.expected_sessions ?? 0} planned sessions</Badge>
                  <Badge variant="outline">
                    Rs. {activation.one_time_price_inr.toLocaleString()}
                    {activation.access_model === "enterprise_monthly" ? " / mo" : ""} + GST
                  </Badge>
                  {activation.foundation_mode && <Badge>Foundation module</Badge>}
                </div>
                {activation.schedule_summary && (
                  <p className="text-sm text-muted-foreground">{activation.schedule_summary}</p>
                )}

                {activation.foundation_mode && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
                    <div className="font-semibold">Pending for next academic session</div>
                    <p className="mt-1">
                      This school joined near session completion. The foundation topics are completed first,
                      and the remaining curriculum continues from the next appropriate learning stage next session.
                    </p>
                    {(activation.carry_forward_topics ?? []).length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {activation.carry_forward_topics.map((topic: string) => <li key={topic}>{topic}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {activation.releases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No monthly content is unlocked yet. Content opens after payment confirmation and then follows the monthly release calendar.
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {activation.releases.map((release: any) => (
                      <div key={release.id} className="rounded-md border p-3 text-sm">
                        <div className="font-semibold">{release.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Release month: {release.release_month}
                        </div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                          {(release.learning_outcomes ?? []).map((item: string) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {!isLoading && (!data?.activations || data.activations.length === 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No activation yet</CardTitle>
                <CardDescription>
                  Choose the band, session dates, and remaining months to generate the first adaptive release plan.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
