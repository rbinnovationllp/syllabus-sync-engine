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
            Historical AI Future Force course records. New purchases use AI Education Premium.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/pricing">View Plans</Link>
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card><CardHeader><CardTitle>AI Education Premium</CardTitle><CardDescription>The old AI Future Force plans are closed to new purchases. Existing course records remain available below.</CardDescription></CardHeader><CardContent><Button asChild><Link to="/ai-education-premium">View AI Education Premium</Link></Button></CardContent></Card>
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
                  Visit AI Education Premium for new school coverage.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
