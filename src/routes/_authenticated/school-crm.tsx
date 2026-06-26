import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  getSchoolCrmDashboard,
  listSchoolCrmContacts,
  listSchoolCrmEnquiries,
  createSchoolCrmContact,
  createSchoolCrmEnquiry,
  updateSchoolCrmEnquiryStatus,
  completeSchoolCrmInteraction,
} from "@/lib/school-crm.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, CalendarClock, CheckCircle2, Loader2, Phone, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/school-crm")({
  head: () => ({ meta: [{ title: "School CRM - CurriculumOS" }] }),
  component: SchoolCrmPage,
});

function SchoolCrmPage() {
  const dashboardFn = useServerFn(getSchoolCrmDashboard);
  const q = useQuery({ queryKey: ["school-crm-dashboard"], queryFn: () => dashboardFn() });

  return (
    <AppShell title="School CRM">
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/10 p-3"><Building2 className="h-6 w-6" /></div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">School CRM</h1>
                <p className="text-sm text-slate-300">Admissions, parent contacts, PTM follow-ups, and daily relationship work for your school.</p>
              </div>
            </div>
            <p className="mt-6 max-w-3xl text-sm leading-6 text-slate-200">
              This CRM is stored against the school organisation. It is intentionally lightweight: no heavy student ERP, only the contact and follow-up records needed for professional school operations.
            </p>
          </div>
          <Card>
            <CardHeader><CardTitle>Today</CardTitle></CardHeader>
            <CardContent>
              {q.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : q.error ? (
                <p className="text-sm text-destructive">{(q.error as Error).message}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{q.data?.orgName}</p>
                  {(q.data?.followups ?? []).length === 0 ? <p className="text-sm">No pending follow-ups.</p> : q.data?.followups.map((f: any) => (
                    <div key={f.id} className="rounded-lg border p-3 text-sm">
                      <div className="font-medium">{f.subject}</div>
                      <div className="text-xs text-muted-foreground">{f.interaction_type} {f.due_at ? `- ${new Date(f.due_at).toLocaleString()}` : ""}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {!q.isLoading && !q.error && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Users} label="Contacts" value={q.data?.counts.contacts ?? 0} />
            <Metric icon={UserPlus} label="Admission enquiries" value={q.data?.counts.enquiries ?? 0} />
            <Metric icon={CheckCircle2} label="Admitted" value={q.data?.counts.admitted ?? 0} />
            <Metric icon={CalendarClock} label="Open follow-ups" value={q.data?.counts.openFollowups ?? 0} />
          </div>
        )}

        <Tabs defaultValue="contacts" className="space-y-4">
          <TabsList className="grid w-full max-w-3xl grid-cols-3">
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="enquiries">Admissions</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          </TabsList>
          <TabsContent value="contacts"><ContactsPanel /></TabsContent>
          <TabsContent value="enquiries"><EnquiriesPanel /></TabsContent>
          <TabsContent value="followups"><FollowupsPanel /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Metric({ icon: Icon, label, value }: any) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
        </div>
        <div className="rounded-xl bg-teal-50 p-3 text-teal-700"><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}

function ContactsPanel() {
  const listFn = useServerFn(listSchoolCrmContacts);
  const createFn = useServerFn(createSchoolCrmContact);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["school-crm-contacts"], queryFn: () => listFn() });
  const [form, setForm] = useState({ contact_type: "parent", full_name: "", relationship: "Parent", student_name: "", grade: "", section: "", phone: "", email: "", notes: "" });
  const create = useMutation({
    mutationFn: () => createFn({ data: form as any }),
    onSuccess: () => {
      toast.success("Contact saved");
      setForm({ contact_type: "parent", full_name: "", relationship: "Parent", student_name: "", grade: "", section: "", phone: "", email: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["school-crm-contacts"] });
      qc.invalidateQueries({ queryKey: ["school-crm-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader><CardTitle>Add parent or contact</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={form.contact_type} onValueChange={(v) => setForm({ ...form, contact_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="admission">Admission contact</SelectItem>
              <SelectItem value="vendor">Vendor</SelectItem>
              <SelectItem value="alumni">Alumni</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input placeholder="Relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Student" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
            <Input placeholder="Grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          </div>
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button className="w-full" onClick={() => create.mutate()} disabled={!form.full_name || create.isPending}>Save contact</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>School contacts</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Student</TableHead><TableHead>Contact</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell><Badge variant="secondary">{c.contact_type}</Badge></TableCell>
                  <TableCell>{[c.student_name, c.grade, c.section].filter(Boolean).join(" - ") || "-"}</TableCell>
                  <TableCell className="text-sm">{c.phone || c.email || "-"}</TableCell>
                  <TableCell className="max-w-md truncate text-sm text-muted-foreground">{c.notes || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EnquiriesPanel() {
  const listFn = useServerFn(listSchoolCrmEnquiries);
  const createFn = useServerFn(createSchoolCrmEnquiry);
  const updateFn = useServerFn(updateSchoolCrmEnquiryStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["school-crm-enquiries"], queryFn: () => listFn() });
  const [form, setForm] = useState({ guardian_name: "", student_name: "", grade_interest: "", phone: "", email: "", source: "walk-in", status: "new", notes: "" });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["school-crm-enquiries"] });
    qc.invalidateQueries({ queryKey: ["school-crm-dashboard"] });
  };
  const create = useMutation({
    mutationFn: () => createFn({ data: form as any }),
    onSuccess: () => { toast.success("Enquiry saved"); setForm({ guardian_name: "", student_name: "", grade_interest: "", phone: "", email: "", source: "walk-in", status: "new", notes: "" }); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (v: any) => updateFn({ data: v }),
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader><CardTitle>Add admission enquiry</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Guardian name" value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
          <Input placeholder="Student name" value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Grade interest" value={form.grade_interest} onChange={(e) => setForm({ ...form, grade_interest: e.target.value })} />
            <Input placeholder="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button className="w-full" onClick={() => create.mutate()} disabled={!form.guardian_name || create.isPending}>Save enquiry</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Admission pipeline</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Guardian</TableHead><TableHead>Student</TableHead><TableHead>Grade</TableHead><TableHead>Status</TableHead><TableHead>Contact</TableHead></TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.guardian_name}</TableCell>
                  <TableCell>{e.student_name || "-"}</TableCell>
                  <TableCell>{e.grade_interest || "-"}</TableCell>
                  <TableCell>
                    <Select value={e.status} onValueChange={(status) => update.mutate({ id: e.id, status })}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["new","contacted","visit_scheduled","application","admitted","lost"].map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm">{e.phone || e.email || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FollowupsPanel() {
  const dashboardFn = useServerFn(getSchoolCrmDashboard);
  const completeFn = useServerFn(completeSchoolCrmInteraction);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["school-crm-dashboard"], queryFn: () => dashboardFn() });
  const complete = useMutation({
    mutationFn: (id: string) => completeFn({ data: { id } }),
    onSuccess: () => { toast.success("Follow-up completed"); qc.invalidateQueries({ queryKey: ["school-crm-dashboard"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Open follow-ups</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {(q.data?.followups ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No follow-ups yet. Add contacts and enquiries first; interaction creation can be expanded next.</p>
        ) : q.data?.followups.map((f: any) => (
          <div key={f.id} className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="font-medium">{f.subject}</div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {f.interaction_type} {f.due_at ? new Date(f.due_at).toLocaleString() : ""}
              </div>
            </div>
            <Button variant="outline" onClick={() => complete.mutate(f.id)}>Mark done</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
