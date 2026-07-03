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
import { ShieldCheck, Users, Monitor, ArchiveRestore } from "lucide-react";

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
