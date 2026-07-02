import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { grantTesterAccess, listTesterAccessGrants, revokeTesterAccess, updateTesterAccess, TESTER_MODULES } from "@/lib/tester-access.functions";
import { Beaker, Clock, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tester-access")({
  component: TesterAccessPage,
});

const MODULE_LABELS: Record<string, string> = {
  full_platform: "Entire platform",
  annual_curriculum: "Annual curriculum planning",
  exports: "Exports and downloads",
  v2_ai: "AI Leadership Suite",
  assessment_ai: "Assessment generator",
  school_crm: "School CRM",
  parent_hub: "Parent communication",
  storage: "School storage",
  company_demo: "Demo/pilot workspace",
};

function isoLocal(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function TesterAccessPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listTesterAccessGrants);
  const grantFn = useServerFn(grantTesterAccess);
  const updateFn = useServerFn(updateTesterAccess);
  const revokeFn = useServerFn(revokeTesterAccess);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [scope, setScope] = useState<"full_platform" | "selected_modules">("full_platform");
  const [modules, setModules] = useState<string[]>(["full_platform"]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");
  const [inviteEmail, setInviteEmail] = useState(true);

  const grants = useQuery({
    queryKey: ["tester-access-grants"],
    queryFn: () => listFn(),
  });

  const activeCount = useMemo(
    () => (grants.data ?? []).filter((row: any) => row.status === "active" || row.status === "invited").length,
    [grants.data],
  );

  const grant = useMutation({
    mutationFn: () => grantFn({
      data: {
        email,
        display_name: displayName || null,
        access_scope: scope,
        modules: scope === "full_platform" ? ["full_platform"] : modules,
        starts_at: isoLocal(startsAt),
        ends_at: isoLocal(endsAt),
        notes: notes || null,
        invite_email: inviteEmail,
      },
    }),
    onSuccess: () => {
      toast.success("Tester access saved");
      setEmail("");
      setDisplayName("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["tester-access-grants"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Could not save tester"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Tester access revoked");
      queryClient.invalidateQueries({ queryKey: ["tester-access-grants"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Could not revoke tester"),
  });

  const extend = useMutation({
    mutationFn: ({ id, ends_at }: { id: string; ends_at: string | null }) => updateFn({ data: { id, ends_at } }),
    onSuccess: () => {
      toast.success("Tester validity updated");
      queryClient.invalidateQueries({ queryKey: ["tester-access-grants"] });
    },
    onError: (error: any) => toast.error(error.message ?? "Could not update tester"),
  });

  function toggleModule(module: string, checked: boolean) {
    setModules((current) => checked ? Array.from(new Set([...current.filter((m) => m !== "full_platform"), module])) : current.filter((m) => m !== module));
  }

  return (
    <AppShell title="Tester Access">
      <section className="space-y-6">
        <div className="rounded-2xl border bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-sm">
                <Beaker className="mr-2 h-4 w-4" /> Company Super Admin
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">Tester Access Management</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Invite testers, grant temporary or permanent access, bypass subscription payment gates, select modules, and keep all tester activity auditable.
              </p>
            </div>
            <Badge className="bg-white text-slate-950 hover:bg-white">{activeCount} active / invited testers</Badge>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Grant tester access</CardTitle>
              <CardDescription>Use the registered email address. If the user has not registered, the access remains invited until they sign up.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tester@school.com" />
              </div>
              <div className="space-y-2">
                <Label>Name / label</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Pilot school principal" />
              </div>
              <div className="space-y-2">
                <Label>Access scope</Label>
                <Select value={scope} onValueChange={(value: any) => {
                  setScope(value);
                  if (value === "full_platform") setModules(["full_platform"]);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_platform">Entire platform</SelectItem>
                    <SelectItem value="selected_modules">Selected modules</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scope === "selected_modules" && (
                <div className="space-y-2 rounded-md border p-3">
                  <Label>Modules</Label>
                  <div className="grid gap-2">
                    {TESTER_MODULES.filter((m) => m !== "full_platform").map((module) => (
                      <label key={module} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={modules.includes(module)} onCheckedChange={(checked) => toggleModule(module, checked === true)} />
                        {MODULE_LABELS[module]}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Starts</Label>
                  <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Ends</Label>
                  <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Demo, pilot program, partner evaluation, QA testing..." />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={inviteEmail} onCheckedChange={(checked) => setInviteEmail(checked === true)} />
                Send invite email if user has not registered
              </label>

              <Button className="w-full" disabled={!email || grant.isPending} onClick={() => grant.mutate()}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {grant.isPending ? "Saving..." : "Grant tester access"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tester accounts</CardTitle>
              <CardDescription>Modify, extend, or revoke tester privileges at any time.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {grants.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading testers...</p>
              ) : grants.error ? (
                <p className="text-sm text-destructive">{(grants.error as Error).message}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tester</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Validity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(grants.data ?? []).map((row: any) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.display_name || row.email}</div>
                          <div className="text-xs text-muted-foreground">{row.email}</div>
                          {row.notes && <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{row.notes}</div>}
                        </TableCell>
                        <TableCell><Badge variant={row.status === "active" ? "default" : "secondary"}>{row.status}</Badge></TableCell>
                        <TableCell>
                          <div className="text-sm">{row.access_scope === "full_platform" ? "Entire platform" : "Selected modules"}</div>
                          {row.access_scope !== "full_platform" && (
                            <div className="mt-1 max-w-xs text-xs text-muted-foreground">
                              {Object.entries(row.module_flags ?? {}).filter(([, v]) => v).map(([k]) => MODULE_LABELS[k] ?? k).join(", ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm"><Clock className="h-3.5 w-3.5" />{row.ends_at ? new Date(row.ends_at).toLocaleString() : "Permanent"}</div>
                          <div className="text-xs text-muted-foreground">From {new Date(row.starts_at).toLocaleDateString()}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => extend.mutate({ id: row.id, ends_at: null })}>Make permanent</Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              const next = new Date();
                              next.setDate(next.getDate() + 30);
                              extend.mutate({ id: row.id, ends_at: next.toISOString() });
                            }}>+30 days</Button>
                            <Button size="sm" variant="destructive" disabled={row.status === "revoked"} onClick={() => revoke.mutate(row.id)}>Revoke</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

