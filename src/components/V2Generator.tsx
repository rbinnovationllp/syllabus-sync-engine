import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, FileText, Save, Sparkles } from "lucide-react";
import { generateV2Draft, listV2Outputs, saveV2Output } from "@/lib/v2.functions";
import { recordAuthenticatedActivity, recordReviewConfirmation } from "@/lib/governance.functions";
import { AiContentDisclaimer } from "@/components/AiContentDisclaimer";
import { ReviewConfirmationCheckbox } from "@/components/ReviewConfirmationCheckbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type V2Module = "principal_dashboard" | "teacher_copilot" | "content_studio" | "assessment_generator";

const MODULE_LABELS: Record<V2Module, string> = {
  principal_dashboard: "AI Principal Dashboard",
  teacher_copilot: "AI Teacher Copilot",
  content_studio: "AI Content Studio",
  assessment_generator: "Assessment Generator",
};

function downloadBlob(filename: string, mime: string, content: BlobPart) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return value.replace(/[^\w.-]+/g, "_").slice(0, 120) || "ai-draft";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function downloadDocx(title: string, content: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const children = content.split(/\n{2,}/).map((block) =>
    new Paragraph({
      children: [new TextRun(block.replace(/\n/g, " "))],
      spacing: { after: 180 },
    }),
  );
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })], spacing: { after: 240 } }),
        ...children,
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(`${safeFileName(title)}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", blob);
}

function printAsPdf(title: string, content: string) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    toast.error("Popup blocked. Allow popups to print or save as PDF.");
    return;
  }
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;line-height:1.55;margin:32px;color:#111827}h1{font-size:24px}pre{white-space:pre-wrap;font-family:Arial,sans-serif}</style></head><body><h1>${escapeHtml(title)}</h1><pre>${escapeHtml(content)}</pre></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export function V2Generator({
  module,
  title,
  description,
  resourceTypes,
  defaultPrompt,
}: {
  module: V2Module;
  title: string;
  description: string;
  resourceTypes: string[];
  defaultPrompt: string;
}) {
  const generateFn = useServerFn(generateV2Draft);
  const saveFn = useServerFn(saveV2Output);
  const listFn = useServerFn(listV2Outputs);
  const auditFn = useServerFn(recordAuthenticatedActivity);
  const confirmFn = useServerFn(recordReviewConfirmation);
  const [resourceType, setResourceType] = useState(resourceTypes[0] ?? "Draft");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [draft, setDraft] = useState<{ id?: string; title: string; content: string; notice?: string } | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  const [examType, setExamType] = useState(resourceTypes[0] ?? "Class test");
  const [fromChapter, setFromChapter] = useState("");
  const [toChapter, setToChapter] = useState("");
  const [marks, setMarks] = useState("40");
  const [duration, setDuration] = useState("60 minutes");
  const [difficulty, setDifficulty] = useState("Balanced");
  const [questionPattern, setQuestionPattern] = useState("MCQ, short answer, long answer, and application questions with answer key");

  const isAssessment = module === "assessment_generator";

  const history = useQuery({
    queryKey: ["v2-outputs", module],
    queryFn: () => listFn({ data: { module, limit: 8 } }),
  });

  const effectivePrompt = useMemo(() => {
    if (!isAssessment) return prompt;
    return [
      `Create a ${marks}-mark ${examType} for ${grade || "selected class"} ${subject || "selected subject"}.`,
      `Chapter range: from ${fromChapter || "teacher-selected starting chapter"} to ${toChapter || "teacher-selected ending chapter"}.`,
      `Duration: ${duration}. Difficulty: ${difficulty}.`,
      `Question pattern: ${questionPattern}.`,
      `Teacher request: ${prompt}`,
      "Include clear instructions, marks distribution, Bloom/difficulty balance, and a complete answer key.",
    ].join("\n");
  }, [difficulty, duration, examType, fromChapter, grade, isAssessment, marks, prompt, questionPattern, subject, toChapter]);

  const generate = useMutation({
    mutationFn: () => generateFn({
      data: {
        module,
        resource_type: isAssessment ? examType : resourceType,
        grade: grade || null,
        subject: subject || null,
        prompt: effectivePrompt,
        params: isAssessment ? { examType, fromChapter, toChapter, marks, duration, difficulty, questionPattern } : {},
        save: true,
      },
    }),
    onSuccess: (result: any) => {
      setDraft({ id: result.saved?.id, title: result.title, content: result.content, notice: result.notice ?? result.saveError });
      setReviewConfirmed(false);
      void auditFn({ data: { action: "content.created", entity_type: module, entity_id: result.saved?.id ?? null, metadata: { resourceType: isAssessment ? examType : resourceType } } });
      if (result.saveError) toast.warning("Draft generated, but saving needs the V2 SQL migration.");
      else toast.success("Draft generated");
      history.refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Generation failed"),
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { id: draft?.id ?? null, module, resource_type: isAssessment ? examType : resourceType, title: draft?.title ?? title, content: draft?.content ?? "", grade: grade || null, subject: subject || null } }),
    onSuccess: (row: any) => {
      setDraft((d) => d ? { ...d, id: row?.id ?? d.id } : d);
      void auditFn({ data: { action: "content.edited_saved", entity_type: module, entity_id: row?.id ?? draft?.id ?? null, metadata: { title: row?.title ?? draft?.title } } });
      toast.success("Saved");
      history.refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const historyRows = useMemo(() => (history.data as any)?.rows ?? [], [history.data]);

  async function confirmBeforeDownload(format: "pdf" | "docx" | "txt") {
    if (!draft) return false;
    if (!reviewConfirmed) {
      toast.error("Please confirm human review before download.");
      return false;
    }
    await confirmFn({ data: { output_type: module, output_id: draft.id ?? null, title: draft.title, action: `download_${format}` } });
    return true;
  }

  async function handleDownload(format: "pdf" | "docx" | "txt") {
    if (!draft) return;
    if (!(await confirmBeforeDownload(format))) return;
    if (format === "pdf") printAsPdf(draft.title, draft.content);
    if (format === "docx") await downloadDocx(draft.title, draft.content);
    if (format === "txt") downloadBlob(`${safeFileName(draft.title)}.txt`, "text/plain;charset=utf-8", draft.content);
  }

  return (
    <div className="grid w-full gap-5 xl:grid-cols-[minmax(420px,0.95fr)_minmax(560px,1.35fr)] 2xl:grid-cols-[minmax(460px,0.85fr)_minmax(720px,1.5fr)]">
      <section className="min-w-0 space-y-5">
        <AiContentDisclaimer compact />

        <Card className="overflow-visible">
          <CardHeader className="pb-4">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 overflow-visible">
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <div className="space-y-2">
                <Label>{isAssessment ? "Exam type" : "Resource"}</Label>
                <Select value={isAssessment ? examType : resourceType} onValueChange={isAssessment ? setExamType : setResourceType}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[120] max-h-72">
                    {resourceTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class / Grade</Label>
                <Input className="h-11" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade 8" />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input className="h-11" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" />
              </div>
            </div>

            {isAssessment && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>From chapter</Label>
                  <Input className="h-11" value={fromChapter} onChange={(e) => setFromChapter(e.target.value)} placeholder="Chapter 1: Number Systems" />
                </div>
                <div className="space-y-2">
                  <Label>To chapter</Label>
                  <Input className="h-11" value={toChapter} onChange={(e) => setToChapter(e.target.value)} placeholder="Chapter 4: Linear Equations" />
                </div>
                <div className="space-y-2">
                  <Label>Total marks</Label>
                  <Input className="h-11" value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="40" />
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input className="h-11" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60 minutes" />
                </div>
                <div className="space-y-2">
                  <Label>Difficulty mix</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[120]">
                      <SelectItem value="Easy">Easy</SelectItem>
                      <SelectItem value="Balanced">Balanced</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Challenging">Challenging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Question format</Label>
                  <Input className="h-11" value={questionPattern} onChange={(e) => setQuestionPattern(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Request</Label>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} className="min-h-40 resize-y" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="h-11 flex-1" onClick={() => generate.mutate()} disabled={generate.isPending || effectivePrompt.trim().length < 3}>
                <Sparkles className="mr-2 h-4 w-4" /> {generate.isPending ? "Generating..." : "Generate editable draft"}
              </Button>
              <Button className="h-11 sm:w-36" variant="outline" onClick={() => save.mutate()} disabled={!draft || save.isPending}>
                <Save className="mr-2 h-4 w-4" /> Save edits
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Recent {MODULE_LABELS[module]} outputs</CardTitle>
            <CardDescription>Saved drafts stay editable and auditable.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {(history.data as any)?.missingTable && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Run the V2 Supabase migration to enable saved history.
              </div>
            )}
            {history.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : historyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved drafts yet.</p>
            ) : (
              historyRows.map((row: any) => (
                <button
                  key={row.id}
                  className="w-full rounded-md border p-3 text-left transition hover:border-primary hover:bg-muted/30"
                  onClick={() => {
                    setDraft({ id: row.id, title: row.title, content: row.content });
                    setReviewConfirmed(false);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 font-medium leading-snug">{row.title}</span>
                    <Badge variant="outline" className="shrink-0">{row.resource_type}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{row.grade || "All grades"} {row.subject ? `- ${row.subject}` : ""}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="min-w-0">
        <Card className="min-h-[680px]">
          <CardHeader className="border-b pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{draft ? "Editable draft" : "Draft preview"}</CardTitle>
                <CardDescription>{draft ? "Review, edit, approve, save, export, and download the generated output." : "Generate a draft to fill this workspace."}</CardDescription>
              </div>
              <Badge variant="secondary" className="max-w-full truncate">{isAssessment ? examType : resourceType}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {draft ? (
              <>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input className="h-11 text-base font-medium" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Editable output</Label>
                  <Textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} rows={24} className="min-h-[520px] resize-y whitespace-pre-wrap text-sm leading-6" />
                </div>
                <ReviewConfirmationCheckbox checked={reviewConfirmed} onCheckedChange={setReviewConfirmed} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => handleDownload("pdf")}>
                    <Download className="mr-2 h-4 w-4" /> Print / PDF
                  </Button>
                  <Button variant="outline" onClick={() => handleDownload("docx")}>
                    <FileText className="mr-2 h-4 w-4" /> DOCX
                  </Button>
                  <Button variant="outline" onClick={() => handleDownload("txt")}>
                    <FileText className="mr-2 h-4 w-4" /> TXT
                  </Button>
                </div>
                {draft.notice && <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">{draft.notice}</p>}
              </>
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 p-8 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
                <h2 className="text-lg font-semibold">No draft generated yet</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Choose the resource type, grade, subject, and request on the left. Your editable output will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
