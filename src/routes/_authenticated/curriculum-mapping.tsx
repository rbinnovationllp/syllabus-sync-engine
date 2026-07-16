import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpenCheck, CheckCircle2, HelpCircle, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  approveCurriculumMappingRun,
  generateCurriculumMapping,
  getCurriculumMappingWorkspace,
  submitUniqueChapterInformation,
} from "@/lib/curriculum-mapping.functions";

export const Route = createFileRoute("/_authenticated/curriculum-mapping")({
  head: () => ({ meta: [{ title: "Curriculum Mapping - CurriculumOS" }] }),
  component: CurriculumMappingPage,
});

const sampleChapters = [
  "Nutrition in Plants | topics: photosynthesis, chlorophyll, autotrophs",
  "Nutrition in Animals | topics: digestion, food habits",
  "Heat | topics: temperature, conduction, convection, radiation",
  "Acids, Bases and Salts | topics: indicators, neutralisation",
].join("\n");

function confidenceTone(value: number) {
  if (value >= 0.72) return "default";
  if (value >= 0.42) return "secondary";
  return "destructive";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function CurriculumMappingPage() {
  const qc = useQueryClient();
  const workspaceFn = useServerFn(getCurriculumMappingWorkspace);
  const generateFn = useServerFn(generateCurriculumMapping);
  const approveFn = useServerFn(approveCurriculumMappingRun);
  const submitUniqueFn = useServerFn(submitUniqueChapterInformation);
  const { data, isLoading } = useQuery({
    queryKey: ["curriculum-mapping-workspace"],
    queryFn: () => workspaceFn(),
  });
  const latestYear = data?.years?.[0];
  const [form, setForm] = useState({
    academic_year_id: "",
    board: "",
    grade: "7",
    subject: "Science",
    book_name: "",
    publisher: "",
    chapter_text: sampleChapters,
  });
  const [uniqueResponses, setUniqueResponses] = useState<Record<string, {
    chapter_summary: string;
    learning_objectives: string;
    topics_covered: string;
    key_concepts: string;
    rights_confirmation: boolean;
  }>>({});

  const selectedYearId = form.academic_year_id || latestYear?.id || null;
  const runs = useMemo(() => data?.runs ?? [], [data]);

  const generate = useMutation({
    mutationFn: () => generateFn({ data: { ...form, academic_year_id: selectedYearId } }),
    onSuccess: () => {
      toast.success("Curriculum mapping generated");
      qc.invalidateQueries({ queryKey: ["curriculum-mapping-workspace"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Mapping failed"),
  });

  const approve = useMutation({
    mutationFn: (mapping_run_id: string) => approveFn({ data: { mapping_run_id, notes: "Approved by school admin for syllabus planning." } }),
    onSuccess: () => {
      toast.success("Mapping approved");
      qc.invalidateQueries({ queryKey: ["curriculum-mapping-workspace"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Approval failed"),
  });

  const submitUnique = useMutation({
    mutationFn: (requestId: string) => {
      const response = uniqueResponses[requestId];
      return submitUniqueFn({
        data: {
          request_id: requestId,
          chapter_summary: response?.chapter_summary ?? "",
          learning_objectives: response?.learning_objectives ?? "",
          topics_covered: response?.topics_covered ?? "",
          key_concepts: response?.key_concepts ?? "",
          rights_confirmation: response?.rights_confirmation === true,
        },
      });
    },
    onSuccess: () => {
      toast.success("Unique chapter information submitted");
      qc.invalidateQueries({ queryKey: ["curriculum-mapping-workspace"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Submission failed"),
  });

  function updateUniqueResponse(requestId: string, patch: Partial<Record<string, any>>) {
    setUniqueResponses((current) => ({
      ...current,
      [requestId]: {
        chapter_summary: "",
        learning_objectives: "",
        topics_covered: "",
        key_concepts: "",
        rights_confirmation: false,
        ...(current[requestId] ?? {}),
        ...patch,
      },
    }));
  }

  return (
    <AppShell title="Curriculum Mapping">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Curriculum Mapping</h1>
          <p className="text-sm text-muted-foreground">
            Map private-publisher chapter lists to recognized curriculum structures without uploading full textbooks.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard">Open planning</Link>
        </Button>
      </div>

      {data?.needsMigration ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base">Migration required</CardTitle>
            <CardDescription>Apply `20260717000100_curriculum_mapping_framework.sql` in Supabase before using this module.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[440px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpenCheck className="h-4 w-4" /> Create Mapping
              </CardTitle>
              <CardDescription>
                Enter metadata and chapter/topic names only. Full book upload is not needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Academic year</Label>
                  <Select value={selectedYearId ?? ""} onValueChange={(v) => setForm({ ...form, academic_year_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Latest year" /></SelectTrigger>
                    <SelectContent>
                      {(data?.years ?? []).map((year: any) => (
                        <SelectItem key={year.id} value={year.id}>{year.name ?? year.start_date}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Board</Label>
                  <Input value={form.board || latestYear?.schools?.board || ""} onChange={(e) => setForm({ ...form, board: e.target.value })} placeholder="CBSE / ICSE / State" />
                </div>
                <div className="space-y-1.5">
                  <Label>Class</Label>
                  <Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="7" />
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Science" />
                </div>
                <div className="space-y-1.5">
                  <Label>Book name</Label>
                  <Input value={form.book_name} onChange={(e) => setForm({ ...form, book_name: e.target.value })} placeholder="Private publisher book name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Publisher</Label>
                  <Input value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })} placeholder="Publisher" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Chapter and topic list</Label>
                <Textarea
                  value={form.chapter_text}
                  onChange={(e) => setForm({ ...form, chapter_text: e.target.value })}
                  rows={9}
                  className="resize-y"
                  placeholder="One chapter per line. Optional: topics: topic 1, topic 2"
                />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                Copyright-safe rule: provide chapter names, topic names, summaries, or learning objectives. Do not upload full copyrighted books unless the school has authorization.
              </div>
              <Button className="w-full" disabled={generate.isPending || isLoading} onClick={() => generate.mutate()}>
                {generate.isPending ? "Mapping..." : "Generate Curriculum Mapping"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {runs.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No mapping runs yet</CardTitle>
                <CardDescription>Create a mapping to see matched standards, confidence, unique chapters, and information requests.</CardDescription>
              </CardHeader>
            </Card>
          ) : runs.map((run: any) => {
            const mappings = run.curriculum_chapter_mappings ?? [];
            const requests = run.curriculum_unique_chapter_requests ?? [];
            return (
              <Card key={run.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{run.grade} {run.subject}</CardTitle>
                      <CardDescription>
                        {run.book_name || "Book not specified"} {run.publisher ? `- ${run.publisher}` : ""} · {run.total_chapters} chapters
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={run.status === "approved" ? "default" : "secondary"}>{statusLabel(run.status)}</Badge>
                      <Badge variant="outline">{Math.round(Number(run.average_confidence ?? 0) * 100)}% avg confidence</Badge>
                    </div>
                  </div>
                  <div className="grid gap-2 pt-2 text-sm sm:grid-cols-3">
                    <Metric label="Mapped" value={run.mapped_chapters ?? 0} />
                    <Metric label="Needs info" value={run.unique_chapters ?? 0} />
                    <Metric label="Created" value={new Date(run.created_at).toLocaleDateString()} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Private book chapter</TableHead>
                          <TableHead>Comparable standard</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Periods</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappings.map((row: any) => (
                          <TableRow key={row.id}>
                            <TableCell className="min-w-56">
                              <div className="font-medium">{row.chapter_name}</div>
                              {row.topic_names?.length ? <div className="text-xs text-muted-foreground">{row.topic_names.join(", ")}</div> : null}
                            </TableCell>
                            <TableCell className="min-w-64">
                              <div>{row.matched_chapter_name || "No confident public match yet"}</div>
                              <div className="text-xs text-muted-foreground">{row.matched_source || "School-specific review"}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={confidenceTone(Number(row.confidence ?? 0)) as any}>
                                {statusLabel(row.mapping_status)} · {Math.round(Number(row.confidence ?? 0) * 100)}%
                              </Badge>
                            </TableCell>
                            <TableCell>{row.estimated_periods ?? "-"} + {row.revision_periods ?? 1} revision</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {requests.length ? (
                    <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                      <div className="font-medium text-amber-950"><HelpCircle className="mr-1 inline h-4 w-4" /> Unique chapter information needed</div>
                      <p className="mt-1 text-amber-900">
                        {requests.length} chapter{requests.length === 1 ? "" : "s"} could not be confidently mapped. Ask the school for summary, learning objectives, topics covered, or key concepts. Avoid requesting full book content.
                      </p>
                      {requests.map((request: any) => {
                        const response = uniqueResponses[request.id] ?? {
                          chapter_summary: "",
                          learning_objectives: "",
                          topics_covered: "",
                          key_concepts: "",
                          rights_confirmation: false,
                        };
                        return (
                          <div key={request.id} className="rounded-md border bg-white p-3">
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium">{request.chapter_name}</div>
                              <Badge variant={request.status === "submitted" ? "default" : "secondary"}>{statusLabel(request.status)}</Badge>
                            </div>
                            {request.status === "submitted" ? (
                              <p className="text-xs text-muted-foreground">Information submitted for school review and planning.</p>
                            ) : (
                              <div className="space-y-3">
                                <Textarea rows={2} placeholder="Chapter summary, not full copyrighted text" value={response.chapter_summary} onChange={(e) => updateUniqueResponse(request.id, { chapter_summary: e.target.value })} />
                                <Textarea rows={2} placeholder="Learning objectives" value={response.learning_objectives} onChange={(e) => updateUniqueResponse(request.id, { learning_objectives: e.target.value })} />
                                <Textarea rows={2} placeholder="Topics covered" value={response.topics_covered} onChange={(e) => updateUniqueResponse(request.id, { topics_covered: e.target.value })} />
                                <Textarea rows={2} placeholder="Key concepts" value={response.key_concepts} onChange={(e) => updateUniqueResponse(request.id, { key_concepts: e.target.value })} />
                                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                                  <Checkbox checked={response.rights_confirmation} onCheckedChange={(checked) => updateUniqueResponse(request.id, { rights_confirmation: checked === true })} />
                                  <span>The school confirms it has permission to use this information internally and is not submitting full copyrighted textbook content.</span>
                                </label>
                                <Button size="sm" disabled={submitUnique.isPending || !response.rights_confirmation} onClick={() => submitUnique.mutate(request.id)}>
                                  Submit unique chapter info
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <Button disabled={run.status === "approved" || approve.isPending} onClick={() => approve.mutate(run.id)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Mapping
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
