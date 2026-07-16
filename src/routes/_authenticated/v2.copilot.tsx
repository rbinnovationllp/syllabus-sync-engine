import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AiContentDisclaimer } from "@/components/AiContentDisclaimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  allocateTeachingCredits,
  bookmarkTeachingSuggestion,
  generateTeachingSuggestion,
  getTeachingAssistantWorkspace,
  reuseTeachingLibraryItem,
} from "@/lib/teaching-assistant.functions";
import { BookMarked, Coins, Lightbulb, Loader2, Save, Search, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/v2/copilot")({
  head: () => ({ meta: [{ title: "AI Teaching Assistant - CurriculumOS" }] }),
  component: TeacherCopilotPage,
});

const REQUEST_TYPES = [
  { value: "simple_activity", label: "Simple Activity Suggestion", cost: 1 },
  { value: "detailed_activity_plan", label: "Detailed Activity Plan", cost: 2 },
  { value: "complete_teaching_toolkit", label: "Complete Teaching Toolkit", cost: 5 },
  { value: "project_based_learning_plan", label: "Project-Based Learning Plan", cost: 5 },
  { value: "multi_day_activity_module", label: "Multi-Day Activity Module", cost: 10 },
];

const SUBJECTS = [
  "Science",
  "Mathematics",
  "Social Science",
  "English",
  "Hindi",
  "Environmental Studies",
  "Computer Science",
  "Commerce",
  "Economics",
  "Geography",
  "History",
  "Physics",
  "Chemistry",
  "Biology",
];

function costFor(type: string) {
  return REQUEST_TYPES.find((item) => item.value === type)?.cost ?? 1;
}

function formatRequestType(type: string) {
  return REQUEST_TYPES.find((item) => item.value === type)?.label ?? type.replaceAll("_", " ");
}

function TeacherCopilotPage() {
  const workspaceFn = useServerFn(getTeachingAssistantWorkspace);
  const generateFn = useServerFn(generateTeachingSuggestion);
  const bookmarkFn = useServerFn(bookmarkTeachingSuggestion);
  const reuseFn = useServerFn(reuseTeachingLibraryItem);
  const allocateFn = useServerFn(allocateTeachingCredits);
  const q = useQuery({ queryKey: ["teaching-assistant-workspace"], queryFn: () => workspaceFn() });

  const [form, setForm] = useState({
    academic_year_id: "",
    grade: "",
    subject: "Science",
    chapter: "",
    topic: "",
    sub_topic: "",
    learning_objective: "",
    local_context: "",
    teacher_note: "",
    request_type: "detailed_activity_plan",
  });
  const [result, setResult] = useState<any>(null);
  const [bookmarkTitle, setBookmarkTitle] = useState("");
  const [search, setSearch] = useState("");
  const [allocationForm, setAllocationForm] = useState({ teacher_user_id: "", allocated_credits: "20", notes: "" });

  const availableCredits = q.data?.balance.available ?? 0;
  const estimatedCost = costFor(form.request_type);
  const canGenerate = form.subject.trim() && form.topic.trim() && availableCredits >= estimatedCost;
  const usagePercent = q.data?.balance.allocated
    ? Math.min(100, Math.round((Number(q.data.balance.used ?? 0) / Number(q.data.balance.allocated ?? 1)) * 100))
    : 0;

  const generate = useMutation({
    mutationFn: () => generateFn({ data: { ...form, academic_year_id: form.academic_year_id || null } as any }),
    onSuccess: (row: any) => {
      setResult(row);
      setBookmarkTitle(`${row.subject}: ${row.topic}`);
      toast.success(`Teaching suggestions generated using ${row.cost} credit${row.cost === 1 ? "" : "s"}`);
      q.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bookmark = useMutation({
    mutationFn: () => bookmarkFn({ data: { generation_id: result.id, title: bookmarkTitle || `${result.subject}: ${result.topic}`, tags: [result.subject, result.grade, result.topic].filter(Boolean) } }),
    onSuccess: () => {
      toast.success("Saved to AI Teaching Innovation Library");
      q.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reuse = useMutation({
    mutationFn: (id: string) => reuseFn({ data: { library_item_id: id } }),
    onSuccess: (item: any) => {
      setResult({
        id: item.generation_id,
        subject: item.subject,
        grade: item.grade,
        topic: item.topic,
        request_type: item.request_type,
        response: item.content,
        credits_spent: 0,
        provider: "saved_library",
      });
      setBookmarkTitle(item.title);
      toast.success("Loaded saved teaching suggestion. No credits used.");
      q.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const allocate = useMutation({
    mutationFn: () => allocateFn({ data: { teacher_user_id: allocationForm.teacher_user_id, allocated_credits: Number(allocationForm.allocated_credits || 0), notes: allocationForm.notes || null } }),
    onSuccess: () => {
      toast.success("AI Teaching Credits allocated");
      setAllocationForm({ teacher_user_id: "", allocated_credits: "20", notes: "" });
      q.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredLibrary = useMemo(() => {
    const term = search.toLowerCase().trim();
    const rows = q.data?.library ?? [];
    if (!term) return rows;
    return rows.filter((item: any) =>
      [item.title, item.subject, item.grade, item.topic, item.content].filter(Boolean).join(" ").toLowerCase().includes(term),
    );
  }, [q.data?.library, search]);
  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of q.data?.members ?? []) {
      map.set(member.user_id, member.profiles?.display_name || member.profiles?.email || member.user_id);
    }
    return map;
  }, [q.data?.members]);

  return (
    <AppShell title="AI Teaching Assistant">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Teaching Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Activity-based teaching ideas, demonstrations, stories, projects, local examples, and interactive learning methods beyond the textbook.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to={"/v2/principal" as any}>Principal Dashboard</Link></Button>
          <Button asChild variant="outline"><Link to="/academic-execution">Execution</Link></Button>
        </div>
      </div>

      {q.error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">{(q.error as Error).message}</CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Available Teaching Credits</p>
                  <p className="mt-1 text-2xl font-bold">{availableCredits}</p>
                </div>
                <Coins className="h-6 w-6 text-amber-600" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly Usage</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>{q.data?.balance.used ?? 0} used</span>
                  <span>{q.data?.balance.allocated ?? 0} allocated</span>
                </div>
                <Progress className="mt-3" value={usagePercent} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Request Cost</p>
                  <p className="mt-1 text-2xl font-bold">{estimatedCost}</p>
                </div>
                <Sparkles className="h-6 w-6 text-indigo-600" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
            <div className="space-y-5">
              <AiContentDisclaimer compact />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="h-4 w-4" /> How can I teach this topic effectively?
                  </CardTitle>
                  <CardDescription>
                    Enter any chapter, topic, sub-topic, or learning objective. The assistant creates practical teaching ideas aligned to age group and curriculum goals.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Academic year</Label>
                      <Select value={form.academic_year_id || "none"} onValueChange={(academic_year_id) => setForm({ ...form, academic_year_id: academic_year_id === "none" ? "" : academic_year_id })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not linked</SelectItem>
                          {(q.data?.years ?? []).map((year: any) => <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Class / grade</Label>
                      <Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="Class 6" />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Subject</Label>
                      <Select value={form.subject} onValueChange={(subject) => setForm({ ...form, subject })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {SUBJECTS.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Request type</Label>
                      <Select value={form.request_type} onValueChange={(request_type) => setForm({ ...form, request_type })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {REQUEST_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label} · {type.cost} credits</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Chapter</Label>
                    <Input value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} placeholder="Chapter name or number" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Topic</Label>
                    <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="What is Environment?" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sub-topic</Label>
                    <Input value={form.sub_topic} onChange={(e) => setForm({ ...form, sub_topic: e.target.value })} placeholder="Optional" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Learning objective</Label>
                    <Textarea rows={3} value={form.learning_objective} onChange={(e) => setForm({ ...form, learning_objective: e.target.value })} placeholder="What should students understand or be able to do?" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Local environment examples</Label>
                    <Input value={form.local_context} onChange={(e) => setForm({ ...form, local_context: e.target.value })} placeholder="School campus, market, river, farms, local weather..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Teacher note</Label>
                    <Textarea rows={3} value={form.teacher_note} onChange={(e) => setForm({ ...form, teacher_note: e.target.value })} placeholder="Mention available material, class size, period duration, or constraints." />
                  </div>
                  <Button className="w-full" disabled={!canGenerate || generate.isPending} onClick={() => generate.mutate()}>
                    {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate Teaching Suggestions
                  </Button>
                  {!canGenerate && form.topic ? (
                    <p className="text-xs text-muted-foreground">This request needs {estimatedCost} credit{estimatedCost === 1 ? "" : "s"}. Ask the School Super Admin to allocate more AI Teaching Credits if needed.</p>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Generated Teaching Suggestions</CardTitle>
                      <CardDescription>Review before classroom use. Save useful ideas to the library for reuse without credits.</CardDescription>
                    </div>
                    {result ? <Badge variant="secondary">{formatRequestType(result.request_type)} · {result.credits_spent ?? 0} credits</Badge> : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!result ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Generate a topic plan or load a saved library item.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border bg-muted/20 p-4">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{result.response}</pre>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Input value={bookmarkTitle} onChange={(e) => setBookmarkTitle(e.target.value)} placeholder="Library title" />
                        <Button disabled={!result.id || bookmark.isPending} onClick={() => bookmark.mutate()}>
                          <Save className="mr-2 h-4 w-4" /> Save to Library
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base"><BookMarked className="h-4 w-4" /> AI Teaching Innovation Library</CardTitle>
                      <CardDescription>Reusable activity methods, project ideas, and teaching toolkits saved by the school.</CardDescription>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search library" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {q.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading library...</p>
                  ) : filteredLibrary.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No saved teaching ideas yet.</p>
                  ) : filteredLibrary.slice(0, 12).map((item: any) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.grade || "Any class"} · {item.subject} · {item.topic}</div>
                        </div>
                        <Button size="sm" variant="outline" disabled={reuse.isPending} onClick={() => reuse.mutate(item.id)}>
                          Reuse
                        </Button>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {q.data?.isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> School Super Admin Credit Allocation</CardTitle>
                <CardDescription>Allocate monthly AI Teaching Credits to teachers and monitor consumption.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-xs uppercase text-muted-foreground">Base pool</div>
                    <div className="mt-1 text-xl font-semibold">{q.data?.pool?.monthly_base_credits ?? 0}</div>
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-xs uppercase text-muted-foreground">Purchased</div>
                    <div className="mt-1 text-xl font-semibold">{q.data?.pool?.purchased_credits ?? 0}</div>
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-xs uppercase text-muted-foreground">Allocated</div>
                    <div className="mt-1 text-xl font-semibold">{q.data?.pool?.allocated_credits ?? 0}</div>
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-xs uppercase text-muted-foreground">Used</div>
                    <div className="mt-1 text-xl font-semibold">{q.data?.pool?.used_credits ?? 0}</div>
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <div className="text-xs uppercase text-muted-foreground">Unallocated</div>
                    <div className="mt-1 text-xl font-semibold">
                      {Math.max(0, Number(q.data?.pool?.monthly_base_credits ?? 0) + Number(q.data?.pool?.purchased_credits ?? 0) - Number(q.data?.pool?.allocated_credits ?? 0))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto]">
                  <Select value={allocationForm.teacher_user_id || "none"} onValueChange={(teacher_user_id) => setAllocationForm({ ...allocationForm, teacher_user_id: teacher_user_id === "none" ? "" : teacher_user_id })}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="none">Select teacher</SelectItem>
                      {(q.data?.members ?? []).map((member: any) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.profiles?.display_name || member.profiles?.email || member.user_id} · {member.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" value={allocationForm.allocated_credits} onChange={(e) => setAllocationForm({ ...allocationForm, allocated_credits: e.target.value })} />
                  <Input value={allocationForm.notes} onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })} placeholder="Allocation note" />
                  <Button disabled={!allocationForm.teacher_user_id || allocate.isPending} onClick={() => allocate.mutate()}>Allocate</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Teacher</TableHead><TableHead>Allocated</TableHead><TableHead>Used</TableHead><TableHead>Available</TableHead><TableHead>Notes</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {(q.data?.adminAllocations ?? []).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-muted-foreground">No teacher allocations for this month yet.</TableCell></TableRow>
                    ) : (q.data?.adminAllocations ?? []).map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{memberNameById.get(row.teacher_user_id) || row.teacher_user_id}</TableCell>
                        <TableCell>{row.allocated_credits}</TableCell>
                        <TableCell>{row.used_credits}</TableCell>
                        <TableCell>{Math.max(0, Number(row.allocated_credits ?? 0) - Number(row.used_credits ?? 0))}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
