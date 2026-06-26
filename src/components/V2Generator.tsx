import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Save, Sparkles } from "lucide-react";
import { generateV2Draft, listV2Outputs, saveV2Output } from "@/lib/v2.functions";
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
  const [resourceType, setResourceType] = useState(resourceTypes[0] ?? "Draft");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [draft, setDraft] = useState<{ id?: string; title: string; content: string; notice?: string } | null>(null);

  const history = useQuery({
    queryKey: ["v2-outputs", module],
    queryFn: () => listFn({ data: { module, limit: 8 } }),
  });

  const generate = useMutation({
    mutationFn: () => generateFn({ data: { module, resource_type: resourceType, grade: grade || null, subject: subject || null, prompt, save: true } }),
    onSuccess: (result: any) => {
      setDraft({ id: result.saved?.id, title: result.title, content: result.content, notice: result.notice ?? result.saveError });
      if (result.saveError) toast.warning("Draft generated, but saving needs the V2 SQL migration.");
      else toast.success("Draft generated");
      history.refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Generation failed"),
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { id: draft?.id ?? null, module, resource_type: resourceType, title: draft?.title ?? title, content: draft?.content ?? "", grade: grade || null, subject: subject || null } }),
    onSuccess: (row: any) => {
      setDraft((d) => d ? { ...d, id: row?.id ?? d.id } : d);
      toast.success("Saved");
      history.refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const historyRows = useMemo(() => (history.data as any)?.rows ?? [], [history.data]);

  return (
    <div className="grid w-full gap-5 xl:grid-cols-[minmax(420px,0.95fr)_minmax(560px,1.35fr)] 2xl:grid-cols-[minmax(460px,0.85fr)_minmax(720px,1.5fr)]">
      <section className="min-w-0 space-y-5">
        <Card className="overflow-visible">
          <CardHeader className="pb-4">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 overflow-visible">
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <div className="space-y-2">
                <Label>Resource</Label>
                <Select value={resourceType} onValueChange={setResourceType}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[120] max-h-72">
                    {resourceTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grade</Label>
                <Input className="h-11" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade 8" />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input className="h-11" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mathematics" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Request</Label>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} className="min-h-40 resize-y" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="h-11 flex-1" onClick={() => generate.mutate()} disabled={generate.isPending || prompt.trim().length < 3}>
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
                  onClick={() => setDraft({ id: row.id, title: row.title, content: row.content })}
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
                <CardDescription>{draft ? "Review, edit, and save the generated output." : "Generate a draft to fill this workspace."}</CardDescription>
              </div>
              <Badge variant="secondary" className="max-w-full truncate">{resourceType}</Badge>
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
