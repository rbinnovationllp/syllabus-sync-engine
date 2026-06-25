import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Sparkles, Trash2, Printer, ShieldAlert } from "lucide-react";
import {
  openProposalDraft,
  saveProposalDraft,
  submitProposalForReview,
  acknowledgeAndProceed,
  getProposal,
} from "@/lib/proposal.functions";

const searchSchema = z.object({
  proposal: z.string().uuid().optional(),
  grade: z.string().optional(),
  subject: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/curriculum/$yearId/propose")({
  head: () => ({ meta: [{ title: "Propose curriculum changes — CurriculumOS" }] }),
  validateSearch: searchSchema,
  component: ProposePage,
});

type Chapter = {
  seq: number;
  title: string;
  week_no: number;
  periods: number;
  difficulty: "simple" | "medium" | "tough";
  objectives: string[];
  assessment?: string | null;
  notes?: string | null;
};

function ProposePage() {
  const { yearId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const openFn = useServerFn(openProposalDraft);
  const getFn = useServerFn(getProposal);

  const [grade, setGrade] = useState(search.grade ?? "");
  const [subject, setSubject] = useState(search.subject ?? "");

  const proposalQ = useQuery({
    queryKey: ["proposal", search.proposal],
    queryFn: () => getFn({ data: { proposal_id: search.proposal! } }),
    enabled: !!search.proposal,
  });

  const openMut = useMutation({
    mutationFn: () => openFn({ data: { year_id: yearId, grade, subject } }),
    onSuccess: (row: any) => {
      navigate({ to: "/curriculum/$yearId/propose", params: { yearId }, search: { proposal: row.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (search.proposal) {
    if (proposalQ.isLoading || !proposalQ.data) {
      return <AppShell title="Proposal"><Loader chip /></AppShell>;
    }
    return <Editor proposal={proposalQ.data} onChanged={() => qc.invalidateQueries({ queryKey: ["proposal", search.proposal] })} />;
  }

  return (
    <AppShell title="Propose curriculum changes">
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Start a new proposal</CardTitle>
          <CardDescription>
            Pick the grade & subject you teach. We'll preload the current AI-generated curriculum so you can add or remove chapters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Grade</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 8" /></div>
            <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" /></div>
          </div>
          <Button
            onClick={() => openMut.mutate()}
            disabled={openMut.isPending || !grade || !subject}
            className="w-full"
          >
            {openMut.isPending ? "Opening…" : "Open editor"}
          </Button>
          <p className="text-xs text-muted-foreground">
            You can only propose changes for grade-subjects assigned to you.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Loader({ chip }: { chip?: boolean }) {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className={`h-${chip ? 5 : 6} w-${chip ? 5 : 6} animate-spin text-muted-foreground`} />
    </div>
  );
}

function statusBadge(s: string) {
  const variants: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    under_ai_review: "bg-amber-100 text-amber-800",
    approved_excellent: "bg-emerald-100 text-emerald-700",
    flagged_low_quality: "bg-rose-100 text-rose-800",
    teacher_acknowledged: "bg-orange-100 text-orange-800",
    finalized: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-800",
  };
  return <Badge variant="outline" className={variants[s] ?? ""}>{s.replace(/_/g, " ")}</Badge>;
}

function Editor({ proposal, onChanged }: { proposal: any; onChanged: () => void }) {
  const saveFn = useServerFn(saveProposalDraft);
  const submitFn = useServerFn(submitProposalForReview);

  const initialChapters: Chapter[] = (proposal.proposed_payload?.chapters ?? []) as Chapter[];
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [diff, setDiff] = useState<string>(proposal.diff_summary ?? "");
  const [title, setTitle] = useState<string>(proposal.title ?? "");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [ackOpen, setAckOpen] = useState(false);

  const editable = ["draft", "flagged_low_quality"].includes(proposal.status);
  const finalized = proposal.status === "finalized";

  // Autosave on changes (debounced).
  useEffect(() => {
    if (!editable) return;
    const t = setTimeout(async () => {
      setSavingState("saving");
      try {
        await saveFn({
          data: {
            proposal_id: proposal.id,
            title,
            diff_summary: diff,
            proposed_payload: {
              chapters,
              total_periods: chapters.reduce((s, c) => s + c.periods, 0),
              summary: proposal.proposed_payload?.summary ?? "",
            },
          },
        });
        setSavingState("saved");
        setTimeout(() => setSavingState("idle"), 1200);
      } catch (e: any) {
        setSavingState("error");
        toast.error(e.message);
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, diff, title]);

  const submitMut = useMutation({
    mutationFn: () => submitFn({ data: { proposal_id: proposal.id } }),
    onSuccess: (r: any) => {
      toast.success(
        r.status === "finalized"
          ? `AI verdict: ${r.verdict} (${(r.score * 100).toFixed(0)}%). Plan finalised — ready to download.`
          : `AI flagged the plan (${(r.score * 100).toFixed(0)}%). Review the fault lines.`,
      );
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  function updateChapter(idx: number, patch: Partial<Chapter>) {
    setChapters((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }
  function addChapter() {
    const nextSeq = chapters.length === 0 ? 1 : Math.max(...chapters.map((c) => c.seq)) + 1;
    setChapters((cs) => [
      ...cs,
      { seq: nextSeq, title: "New chapter", week_no: nextSeq, periods: 4, difficulty: "medium", objectives: [] },
    ]);
  }
  function removeChapter(idx: number) {
    setChapters((cs) => cs.filter((_, i) => i !== idx));
  }

  return (
    <AppShell title={`Proposal — Grade ${proposal.grade} ${proposal.subject}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          {statusBadge(proposal.status)}
          {proposal.ai_score != null && (
            <span className="text-sm text-muted-foreground">
              AI score: <strong>{(proposal.ai_score * 100).toFixed(0)}%</strong>
              {proposal.ai_verdict && ` · ${proposal.ai_verdict}`}
            </span>
          )}
          {savingState === "saving" && <span className="text-xs text-muted-foreground">Saving…</span>}
          {savingState === "saved" && <span className="text-xs text-emerald-600">Saved ✓</span>}
          {savingState === "error" && <span className="text-xs text-rose-600">Save failed</span>}
        </div>
        <div className="flex gap-2">
          {editable && (
            <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending || chapters.length === 0}>
              <Sparkles className="h-4 w-4 mr-1" />
              {submitMut.isPending ? "Reviewing…" : "Submit for AI review"}
            </Button>
          )}
          {proposal.status === "flagged_low_quality" && (
            <Button variant="destructive" onClick={() => setAckOpen(true)}>
              Acknowledge & proceed
            </Button>
          )}
          {finalized && (
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Download / Print PDF
            </Button>
          )}
        </div>
      </div>

      {proposal.status === "flagged_low_quality" && (
        <Card className="mb-4 border-rose-200 bg-rose-50/50 print:hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-800 text-base">
              <AlertTriangle className="h-5 w-5" /> AI flagged this plan
            </CardTitle>
            <CardDescription className="text-rose-700/80">
              Either revise the chapters below or acknowledge the faults to release the amended version.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FaultLineList faults={proposal.ai_fault_lines ?? []} />
          </CardContent>
        </Card>
      )}

      {finalized && proposal.teacher_ack_at && (
        <Card className="mb-4 border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 text-base">
              <ShieldAlert className="h-5 w-5" /> Released over AI quality warning
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p><strong>Teacher acknowledgement:</strong></p>
            <p className="mt-1 whitespace-pre-wrap rounded bg-white p-3 border">{proposal.teacher_ack_text}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Acknowledged on {new Date(proposal.teacher_ack_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4 print:hidden">
        <CardHeader><CardTitle className="text-base">Proposal details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} /></div>
          <div>
            <Label>What's changing vs. the AI-generated plan?</Label>
            <Textarea rows={3} value={diff} onChange={(e) => setDiff(e.target.value)} disabled={!editable}
              placeholder="e.g. Added a remedial chapter on linear equations in week 4, removed extra Geometry depth in weeks 18-19." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Chapters ({chapters.length})</CardTitle>
          {editable && (
            <Button size="sm" variant="outline" onClick={addChapter}>
              <Plus className="h-4 w-4 mr-1" /> Add chapter
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {chapters.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-sm">No chapters yet. Add one to begin.</p>
          ) : (
            <div className="space-y-3">
              {chapters.map((c, idx) => (
                <div key={idx} className="border rounded-md p-3 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <Input className="col-span-1" type="number" value={c.seq} disabled={!editable}
                      onChange={(e) => updateChapter(idx, { seq: Number(e.target.value) })} />
                    <Input className="col-span-6" value={c.title} disabled={!editable}
                      onChange={(e) => updateChapter(idx, { title: e.target.value })} />
                    <Input className="col-span-1" type="number" value={c.week_no} disabled={!editable}
                      onChange={(e) => updateChapter(idx, { week_no: Number(e.target.value) })} />
                    <Input className="col-span-1" type="number" value={c.periods} disabled={!editable}
                      onChange={(e) => updateChapter(idx, { periods: Number(e.target.value) })} />
                    <Select value={c.difficulty} onValueChange={(v) => updateChapter(idx, { difficulty: v as any })} disabled={!editable}>
                      <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">simple</SelectItem>
                        <SelectItem value="medium">medium</SelectItem>
                        <SelectItem value="tough">tough</SelectItem>
                      </SelectContent>
                    </Select>
                    {editable && (
                      <Button size="icon" variant="ghost" className="col-span-1" onClick={() => removeChapter(idx)}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground">
                    <span className="col-span-1">seq</span>
                    <span className="col-span-6">title</span>
                    <span className="col-span-1">week</span>
                    <span className="col-span-1">prds</span>
                    <span className="col-span-2">difficulty</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {proposal.ai_report && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">AI review report</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-sans">{proposal.ai_report}</pre>
          </CardContent>
        </Card>
      )}

      {ackOpen && (
        <AckDialog proposalId={proposal.id} onClose={() => setAckOpen(false)} onDone={onChanged} />
      )}
    </AppShell>
  );
}

function FaultLineList({ faults }: { faults: any[] }) {
  if (!faults || faults.length === 0) return <p className="text-sm">No specific issues recorded.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {faults.map((f, i) => (
        <li key={i} className="rounded border bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{f.area}</span>
            <Badge variant="outline" className={
              f.severity === "high" ? "bg-rose-100 text-rose-800"
              : f.severity === "medium" ? "bg-amber-100 text-amber-800"
              : "bg-slate-100 text-slate-700"
            }>{f.severity}</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">{f.explanation}</p>
          <p className="mt-1"><strong className="text-xs text-emerald-700">Suggested fix:</strong> {f.suggestion}</p>
        </li>
      ))}
    </ul>
  );
}

function AckDialog({ proposalId, onClose, onDone }: { proposalId: string; onClose: () => void; onDone: () => void }) {
  const fn = useServerFn(acknowledgeAndProceed);
  const ACK_PHRASE = "I accept the noted faults and request the amended version";
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: () => fn({ data: { proposal_id: proposalId, ack_text: text } }),
    onSuccess: () => { toast.success("Proposal released. You can now download the PDF."); onDone(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-rose-600" /> Acknowledge & proceed</DialogTitle>
          <DialogDescription>
            The AI flagged this plan. To release the amended version, paste the exact acknowledgement phrase below, plus your reason. This text is permanent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Phrase that must appear in your reply:</p>
          <code className="block rounded bg-slate-100 p-2 text-xs">{ACK_PHRASE}</code>
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={`${ACK_PHRASE}. My reason: …`} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={m.isPending || text.trim().length < ACK_PHRASE.length}>
            {m.isPending ? "Saving…" : "Acknowledge & release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
