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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  declareSchoolSuperAdmin,
  getSchoolGovernance,
} from "@/lib/academic-execution.functions";
import {
  listMyPilotBenefits,
  submitPilotBenefitRequest,
} from "@/lib/pilot-benefits.functions";
import { ShieldCheck, Users, Monitor, ArchiveRestore, ReceiptIndianRupee } from "lucide-react";

export const Route = createFileRoute("/_authenticated/school-governance")({
  head: () => ({ meta: [{ title: "School Governance - CurriculumOS" }] }),
  component: SchoolGovernancePage,
});

function SchoolGovernancePage() {
  const qc = useQueryClient();
  const governanceFn = useServerFn(getSchoolGovernance);
  const declareFn = useServerFn(declareSchoolSuperAdmin);
  const { data, isLoading } = useQuery({
    queryKey: ["school-governance"],
    queryFn: () => governanceFn(),
  });

  const [form, setForm] = useState({
    super_admin_name: "",
    designation: "",
    email: "",
    mobile: "",
    authorization_notes: "",
  });

  const save = useMutation({
    mutationFn: () => declareFn({ data: form }),
    onSuccess: () => {
      toast.success("School Super Admin declaration saved");
      setForm({ super_admin_name: "", designation: "", email: "", mobile: "", authorization_notes: "" });
      qc.invalidateQueries({ queryKey: ["school-governance"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell title="School Governance">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">School Governance & Data Protection</h1>
          <p className="text-sm text-muted-foreground">
            Control authority, permissions, sessions, and protected school data.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/academic-execution">Academic Execution</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading governance controls...</p>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <PilotBenefitPanel />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4" /> Official School Super Admin
                </CardTitle>
                <CardDescription>
                  This person is treated as the highest authority for the school account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data?.declaration && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <div className="font-semibold">{data.declaration.super_admin_name}</div>
                    <div className="text-muted-foreground">{data.declaration.designation}</div>
                    <div className="text-muted-foreground">{data.declaration.email}</div>
                    {data.declaration.mobile && <div className="text-muted-foreground">{data.declaration.mobile}</div>}
                    <Badge className="mt-2" variant="outline">Authorized {new Date(data.declaration.authorized_at).toLocaleDateString()}</Badge>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={form.super_admin_name} onChange={(e) => setForm({ ...form, super_admin_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Designation</Label>
                  <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Principal / Director / Authorized Signatory" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mobile</Label>
                  <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Authorization notes</Label>
                  <Textarea rows={3} value={form.authorization_notes} onChange={(e) => setForm({ ...form, authorization_notes: e.target.value })} />
                </div>
                <Button
                  className="w-full"
                  disabled={save.isPending || !form.super_admin_name || !form.designation || !form.email}
                  onClick={() => save.mutate()}
                >
                  Save School Super Admin declaration
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArchiveRestore className="h-4 w-4" /> Recycle Bin Governance
                </CardTitle>
                <CardDescription>Important records should be archived before permanent deletion.</CardDescription>
              </CardHeader>
              <CardContent>
                {!data?.recycle_bin?.length ? (
                  <p className="text-sm text-muted-foreground">No archived records waiting for review.</p>
                ) : (
                  <div className="space-y-2">
                    {data.recycle_bin.map((item: any) => (
                      <div key={item.id} className="rounded-md border p-3 text-sm">
                        <div className="font-medium">{item.record_label || item.source_table}</div>
                        <div className="text-muted-foreground">Retention until {new Date(item.retention_until).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Members & Delegated Authority
                </CardTitle>
                <CardDescription>
                  Teachers cannot delete school profile, subscription, institutional settings, or other users.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Governance note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.members ?? []).map((m: any) => (
                      <TableRow key={m.user_id}>
                        <TableCell>{m.profiles?.display_name ?? "-"}</TableCell>
                        <TableCell>{m.profiles?.email ?? "-"}</TableCell>
                        <TableCell><Badge variant="outline">{m.role}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.role === "teacher"
                            ? "Restricted to assigned academic work"
                            : m.role === "coordinator"
                              ? "Can monitor academic execution"
                              : "Can manage school administration"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4" /> Data Privacy & Confidentiality Framework
                </CardTitle>
                <CardDescription>
                  School-facing assurance for ownership, tenant isolation, role-based access, auditability, exports, and recovery.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  All academic, administrative, student, teacher, examination, and operational data remains the property of the respective school. Syllabus Synk acts as a technology platform and custodian.
                </p>
                <p>
                  School data is designed to remain logically separated between institutions. Users should only access records allowed by their role, school membership, and assigned responsibilities.
                </p>
                <p>
                  Company administrator access should be limited to authorized support, troubleshooting, and maintenance, with important administrative actions recorded in audit logs where implemented.
                </p>
                <div className="rounded-md border bg-muted/30 p-3 text-foreground">
                  All school data stored within Syllabus Synk is protected using industry-standard security practices, access controls, encryption, monitoring, and backup systems. Each school&apos;s data remains isolated and confidential. The platform is designed to prevent unauthorized access, cross-school visibility, and accidental disclosure of information.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Monitor className="h-4 w-4" /> Active Session Registry
                </CardTitle>
                <CardDescription>
                  Foundation for persistent login review and forced logout controls.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!data?.sessions?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No session registry rows yet. Login persistence is handled by Supabase Auth; device registry rows can be expanded when forced logout policy is finalized.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Last seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.sessions.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.user_id.slice(0, 8)}</TableCell>
                          <TableCell>{s.device_info ?? s.session_label ?? "-"}</TableCell>
                          <TableCell>{new Date(s.last_seen_at).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function PilotBenefitPanel() {
  const listFn = useServerFn(listMyPilotBenefits);
  const submitFn = useServerFn(submitPilotBenefitRequest);
  const q = useQuery({ queryKey: ["my-pilot-benefits"], queryFn: () => listFn(), retry: false });
  const [form, setForm] = useState({
    pilot_program_id: "",
    request_type: "credit",
    original_razorpay_payment_id: "",
    school_notes: "",
  });
  const submit = useMutation({
    mutationFn: () => submitFn({ data: form as any }),
    onSuccess: () => {
      toast.success("Pilot benefit request submitted for Company Super Admin approval");
      setForm({ pilot_program_id: "", request_type: "credit", original_razorpay_payment_id: "", school_notes: "" });
      q.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.error) return null;
  const programs = q.data?.programs ?? [];
  const requests = q.data?.requests ?? [];
  const credits = q.data?.credits ?? [];
  const refunds = q.data?.refunds ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ReceiptIndianRupee className="h-4 w-4" /> Paid Pilot Refund / Subscription Credit
        </CardTitle>
        <CardDescription>
          After the approved paid pilot period, request either continuation credit or refund review as per the MOU. Final approval remains with the Company Super Admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading pilot benefit records...</p>
        ) : programs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approved paid pilot program is linked to this school account yet.</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Approved pilot</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.pilot_program_id}
                  onChange={(e) => setForm({ ...form, pilot_program_id: e.target.value })}
                >
                  <option value="">Select pilot program</option>
                  {programs.map((program: any) => (
                    <option key={program.id} value={program.id}>
                      {program.approved_plan_id || "Paid pilot"} · {program.pilot_start_date} to {program.pilot_end_date}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Requested benefit</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.request_type}
                  onChange={(e) => setForm({ ...form, request_type: e.target.value })}
                >
                  <option value="credit">Continue subscription and claim pilot credit</option>
                  <option value="refund">Discontinue subscription and request refund</option>
                </select>
              </div>
            </div>
            {form.request_type === "refund" ? (
              <div className="space-y-1.5">
                <Label>Original Razorpay payment ID</Label>
                <Input value={form.original_razorpay_payment_id} onChange={(e) => setForm({ ...form, original_razorpay_payment_id: e.target.value })} placeholder="pay_..." />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>School note</Label>
              <Textarea rows={3} value={form.school_notes} onChange={(e) => setForm({ ...form, school_notes: e.target.value })} placeholder="Optional note for Company Super Admin review" />
            </div>
            <Button
              disabled={submit.isPending || !form.pilot_program_id || (form.request_type === "refund" && !form.original_razorpay_payment_id)}
              onClick={() => submit.mutate()}
            >
              Submit pilot benefit request
            </Button>
          </>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Requests</div>
            <div className="mt-2 space-y-1 text-muted-foreground">
              {requests.length === 0 ? "No request submitted yet." : requests.slice(0, 3).map((request: any) => (
                <div key={request.id}>{request.request_type} · {request.status} · Rs {Math.round(Number(request.eligible_amount_minor ?? 0) / 100).toLocaleString("en-IN")}</div>
              ))}
            </div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Credits</div>
            <div className="mt-2 space-y-1 text-muted-foreground">
              {credits.length === 0 ? "No credit ledger entry yet." : credits.slice(0, 3).map((credit: any) => (
                <div key={credit.id}>{credit.status} · remaining Rs {Math.round(Number(credit.remaining_amount_minor ?? 0) / 100).toLocaleString("en-IN")}</div>
              ))}
            </div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Refunds</div>
            <div className="mt-2 space-y-1 text-muted-foreground">
              {refunds.length === 0 ? "No refund transaction yet." : refunds.slice(0, 3).map((refund: any) => (
                <div key={refund.id}>{refund.refund_status} · Rs {Math.round(Number(refund.approved_refund_amount_minor ?? 0) / 100).toLocaleString("en-IN")}</div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
