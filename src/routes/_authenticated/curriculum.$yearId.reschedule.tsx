import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { reportDisruption, listDisruptions, dismissDisruption } from "@/lib/disruptions.functions";
import { getYearResults } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/curriculum/$yearId/reschedule")({
  head: () => ({ meta: [{ title: "Reschedule — CurriculumOS" }] }),
  component: ReschedulePage,
});

const CATEGORIES = [
  { v: "weather", l: "Weather closure" },
  { v: "closure", l: "Emergency closure" },
  { v: "illness", l: "Illness / outbreak" },
  { v: "exam_shift", l: "Exam date shifted" },
  { v: "event_overrun", l: "Event ran over" },
  { v: "election", l: "Election duty" },
  { v: "strike", l: "Strike / bandh" },
  { v: "other", l: "Other" },
];

function ReschedulePage() {
  const { yearId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reportFn = useServerFn(reportDisruption);
  const listFn = useServerFn(listDisruptions);
  const dismissFn = useServerFn(dismissDisruption);
  const yearFn = useServerFn(getYearResults);

  const yearQ = useQuery({
    queryKey: ["year-results", yearId],
    queryFn: () => yearFn({ data: { academic_year_id: yearId } }),
  });
  const disruptions = useQuery({
    queryKey: ["disruptions", yearId],
    queryFn: () => listFn({ data: { year_id: yearId, limit: 50 } }),
  });

  const [form, setForm] = useState({
    category: "weather",
    reason: "",
    lost_days: 1,
    lost_periods: 0,
    affected_grades: "",
    affected_sections: "",
    start_date: "",
    end_date: "",
    apply_recalibration: true,
  });

  const submit = useMutation({
    mutationFn: () =>
      reportFn({
        data: {
          year_id: yearId,
          category: form.category as any,
          reason: form.reason.trim(),
          lost_days: Number(form.lost_days) || 0,
          lost_periods: Number(form.lost_periods) || 0,
          affected_grades: form.affected_grades.split(",").map((s) => s.trim()).filter(Boolean),
          affected_sections: form.affected_sections.split(",").map((s) => s.trim()).filter(Boolean),
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          apply_recalibration: form.apply_recalibration,
        },
      }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["disruptions", yearId] });
      qc.invalidateQueries({ queryKey: ["year-artifacts", yearId] });
      qc.invalidateQueries({ queryKey: ["curriculum-versions"] });
      if (res?.recalibration?.error === "PAID_PLAN_REQUIRED") {
        toast.error("Recalibration needs a paid plan. Disruption was logged.");
      } else if (res?.recalibration?.error === "INSUFFICIENT_CREDITS") {
        toast.error("Not enough AI credits to recalibrate. Disruption was logged.");
      } else if (res?.recalibration?.error === "AI_FAILED") {
        toast.error("AI recalibration failed. Disruption was logged — try again.");
      } else if (res?.recalibration?.ok) {
        toast.success("Disruption logged and calendar recalibrated.");
      } else {
        toast.success("Disruption logged.");
      }
      setForm({ ...form, reason: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Dismissed");
      qc.invalidateQueries({ queryKey: ["disruptions", yearId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (yearQ.isLoading) {
    return (
      <AppShell title="Reschedule">
        <div className="flex justify-center min-h-[40vh] items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Reschedule">
      <div className="mb-4">
        <Link to="/results/$yearId" params={{ yearId }} className="text-sm text-muted-foreground hover:underline">
          ← Back to {yearQ.data?.year?.label ?? "year"}
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Report a disruption
            </CardTitle>
            <CardDescription>
              We'll log it and ask the AI to redistribute remaining chapters within available capacity,
              protecting tough chapters and the syllabus-completion buffer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Lost days</Label>
                  <Input type="number" min={0} max={365}
                    value={form.lost_days}
                    onChange={(e) => setForm({ ...form, lost_days: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Lost periods</Label>
                  <Input type="number" min={0}
                    value={form.lost_periods}
                    onChange={(e) => setForm({ ...form, lost_periods: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Reason / description</Label>
              <Textarea
                value={form.reason}
                maxLength={500}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="e.g. Cyclone forced closure Nov 11–13; all grades affected."
              />
              <p className="text-xs text-muted-foreground mt-1">{form.reason.length}/500</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Affected grades (comma-separated, blank = all)</Label>
                <Input value={form.affected_grades} maxLength={200}
                  onChange={(e) => setForm({ ...form, affected_grades: e.target.value })}
                  placeholder="e.g. 9, 10, 11" />
              </div>
              <div>
                <Label className="text-xs">Affected sections (optional)</Label>
                <Input value={form.affected_sections} maxLength={200}
                  onChange={(e) => setForm({ ...form, affected_sections: e.target.value })}
                  placeholder="e.g. A, B" />
              </div>
              <div>
                <Label className="text-xs">From</Label>
                <Input type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input type="date" value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.apply_recalibration}
                onChange={(e) => setForm({ ...form, apply_recalibration: e.target.checked })}
              />
              Run AI recalibration now (uses AI credits)
            </label>
            <div className="flex justify-end">
              <Button
                onClick={() => submit.mutate()}
                disabled={submit.isPending || form.reason.trim().length < 3}
              >
                {submit.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {form.apply_recalibration ? "Log & recalibrate" : "Log only"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Disruption history</CardTitle>
            <CardDescription>{disruptions.data?.length ?? 0} total</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {disruptions.isLoading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : !disruptions.data || disruptions.data.length === 0 ? (
              <p className="text-muted-foreground">No disruptions logged yet.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {disruptions.data.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(d.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs">{d.category}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{d.reason}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          d.status === "recalibrated" ? "default" :
                          d.status === "infeasible" ? "destructive" :
                          d.status === "dismissed" ? "outline" : "secondary"
                        }>{d.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {d.status === "pending" && (
                          <Button size="sm" variant="ghost"
                            onClick={() => dismiss.mutate(d.id)}>
                            Dismiss
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
