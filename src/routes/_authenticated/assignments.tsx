import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, Lock, Plus, Trash2, UserPlus } from "lucide-react";
import { listMyAcademicYears } from "@/lib/onboarding.functions";
import {
  listSchoolTeachers,
  assignTeacher,
  revokeAssignment,
} from "@/lib/assignments.functions";

const searchSchema = z.object({ year: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/assignments")({
  head: () => ({ meta: [{ title: "Teacher Assignments — CurriculumOS" }] }),
  validateSearch: searchSchema,
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchYears = useServerFn(listMyAcademicYears);
  const fetchData = useServerFn(listSchoolTeachers);
  const assign = useServerFn(assignTeacher);
  const revoke = useServerFn(revokeAssignment);

  const years = useQuery({ queryKey: ["my-years"], queryFn: () => fetchYears() });
  const yearId = search.year ?? years.data?.[0]?.id;

  const data = useQuery({
    queryKey: ["school-teachers", yearId],
    queryFn: () => fetchData({ data: { academic_year_id: yearId } }),
    enabled: !!yearId,
  });

  const assignMut = useMutation({
    mutationFn: (input: any) => assign({ data: input }),
    onSuccess: () => {
      toast.success("Teacher assigned");
      qc.invalidateQueries({ queryKey: ["school-teachers", yearId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Assignment removed");
      qc.invalidateQueries({ queryKey: ["school-teachers", yearId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [form, setForm] = useState({ teacher_user_id: "", grade: "", section: "", subject: "" });

  if (years.isLoading || (yearId && data.isLoading)) {
    return (
      <AppShell title="Teacher Assignments">
        <div className="flex justify-center min-h-[40vh] items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!yearId) {
    return (
      <AppShell title="Teacher Assignments">
        <Card>
          <CardHeader>
            <CardTitle>No academic year yet</CardTitle>
            <CardDescription>Create one in onboarding first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: "/onboarding" })}>Start onboarding</Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const d = data.data!;
  const teachers = d.members.filter((m: any) => m.role === "teacher" || m.role === "coordinator");

  return (
    <AppShell title="Teacher Assignments">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teacher Assignments</h1>
          <p className="text-sm text-muted-foreground">
            Scope each teacher to the classes and subjects they teach.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(years.data ?? []).length > 1 && (
            <select
              className="text-sm border rounded-md px-2 py-1 bg-background"
              value={yearId}
              onChange={(e) => navigate({ to: "/assignments", search: { year: e.target.value } })}
            >
              {(years.data ?? []).map((y: any) => (
                <option key={y.id} value={y.id}>{y.label}</option>
              ))}
            </select>
          )}
          <Link to="/seats">
            <Button variant="outline"><UserPlus className="h-4 w-4 mr-1" /> Invite teachers</Button>
          </Link>
        </div>
      </div>

      {!d.can_edit && (
        <div className="mb-4">
          <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Admin-only edits</Badge>
        </div>
      )}

      {d.can_edit && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> New assignment</CardTitle>
            <CardDescription>Assign a teacher to one grade/section/subject.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="md:col-span-2">
                <Label className="text-xs">Teacher</Label>
                <Select value={form.teacher_user_id} onValueChange={(v) => setForm({ ...form, teacher_user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a teacher" /></SelectTrigger>
                  <SelectContent>
                    {teachers.length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">No teachers yet. Invite one first.</div>
                    ) : teachers.map((t: any) => (
                      <SelectItem key={t.user_id} value={t.user_id}>
                        {t.display_name || t.email || t.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Grade</Label>
                <Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="e.g. 8" maxLength={20} />
              </div>
              <div>
                <Label className="text-xs">Section</Label>
                <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="optional" maxLength={20} />
              </div>
              <div>
                <Label className="text-xs">Subject</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Math" maxLength={80} />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                disabled={assignMut.isPending || !form.teacher_user_id || !form.grade.trim() || !form.subject.trim()}
                onClick={() => assignMut.mutate({ academic_year_id: yearId, ...form, section: form.section || null })}
              >
                {assignMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Assign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assignments — {d.year?.label}</CardTitle>
          <CardDescription>{d.assignments.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {d.assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Subject</TableHead>
                {d.can_edit && <TableHead></TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {d.assignments.map((a: any) => {
                  const t = d.members.find((m: any) => m.user_id === a.teacher_user_id);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{t?.display_name || t?.email || a.teacher_user_id.slice(0, 8)}</TableCell>
                      <TableCell>{a.grade}</TableCell>
                      <TableCell>{a.section ?? "—"}</TableCell>
                      <TableCell>{a.subject}</TableCell>
                      {d.can_edit && (
                        <TableCell className="text-right">
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => { if (confirm("Remove this assignment?")) revokeMut.mutate(a.id); }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">School members ({d.members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
            <TableBody>
              {d.members.map((m: any) => (
                <TableRow key={m.user_id}>
                  <TableCell>{m.display_name ?? "—"}</TableCell>
                  <TableCell>{m.email ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{m.role}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
