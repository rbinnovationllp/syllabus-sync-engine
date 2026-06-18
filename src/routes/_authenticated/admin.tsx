import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getAdminOverview,
  listLeadsFull,
  updateLeadStage,
  promoteToAdmin,
  revokeAdmin,
  listAdmins,
  getMyAdminStatus,
  listAuditLog,
} from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { toast } from "sonner";
import {
  Users,
  CreditCard,
  Sparkles,
  Inbox,
  ShieldCheck,
  School,
  Loader2,
} from "lucide-react";
import { EnforcementTab } from "@/components/admin/EnforcementTab";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin & CRM — CurriculumOS" }] }),
  component: AdminPage,
});

function AdminPage() {
  const statusFn = useServerFn(getMyAdminStatus);
  const status = useQuery({ queryKey: ["admin-status"], queryFn: () => statusFn() });

  if (status.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!status.data?.isAdmin) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Admin access only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have permission to view this page. Contact the super admin
          to request access.
        </p>
        <Button asChild className="mt-6">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return <AdminDashboard isSuperAdmin={!!status.data?.isSuperAdmin} />;
}

function AdminDashboard({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const overviewFn = useServerFn(getAdminOverview);
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn(),
  });

  if (overview.isLoading || !overview.data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const d = overview.data;
  const activeSubs = d.subscriptions.filter((s) =>
    ["active", "trialing", "past_due"].includes(s.status)
  ).length;
  const newLeads = d.leads.filter((l) => l.stage === "new").length;
  const aiUsedThisMonth = (() => {
    const m = new Date().toISOString().slice(0, 7);
    return d.usage
      .filter((u) => u.period_month?.startsWith?.(m))
      .reduce((s, u) => s + (u.ai_credits_used ?? 0), 0);
  })();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin & CRM</h1>
          <p className="text-sm text-muted-foreground">
            Track every client, lead, subscription, and usage signal in one place.
          </p>
        </div>
        {isSuperAdmin && (
          <Badge className="bg-gradient-to-r from-fuchsia-500 to-amber-500 text-white">
            Super Admin
          </Badge>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Clients" value={d.clients.length} accent="indigo" />
        <StatCard icon={CreditCard} label="Active subscriptions" value={activeSubs} accent="emerald" />
        <StatCard icon={Inbox} label="New leads" value={newLeads} accent="pink" />
        <StatCard icon={Sparkles} label="AI credits (MTD)" value={aiUsedThisMonth} accent="amber" />
      </div>

      <Tabs defaultValue="leads" className="mt-8">
        <TabsList>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="schools">Schools</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="access">Admin access</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="partners">Partners</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="audit">Audit log</TabsTrigger>}
        </TabsList>

        <TabsContent value="leads"><LeadsTab /></TabsContent>
        <TabsContent value="clients"><ClientsTab clients={d.clients} /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTab subs={d.subscriptions} clients={d.clients} /></TabsContent>
        <TabsContent value="usage"><UsageTab usage={d.usage} clients={d.clients} /></TabsContent>
        <TabsContent value="schools"><SchoolsTab schools={d.schools} /></TabsContent>
        {isSuperAdmin && <TabsContent value="access"><AccessTab /></TabsContent>}
        {isSuperAdmin && <TabsContent value="partners"><EnforcementTab /></TabsContent>}
        {isSuperAdmin && <TabsContent value="audit"><AuditTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  const accents: Record<string, string> = {
    indigo: "from-indigo-500 to-violet-500",
    emerald: "from-emerald-500 to-teal-500",
    pink: "from-pink-500 to-rose-500",
    amber: "from-amber-500 to-orange-500",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
          </div>
          <div className={`rounded-xl bg-gradient-to-br ${accents[accent]} p-2.5 text-white shadow-md`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadsTab() {
  const fn = useServerFn(listLeadsFull);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-leads-full"], queryFn: () => fn() });
  const updateFn = useServerFn(updateLeadStage);
  const update = useMutation({
    mutationFn: (vars: { id: string; stage: any; notes?: string | null }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Lead updated");
      qc.invalidateQueries({ queryKey: ["admin-leads-full"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading leads…</div>;
  const leads = q.data ?? [];
  if (leads.length === 0) {
    return (
      <Card className="mt-4"><CardContent className="p-10 text-center text-muted-foreground">
        No leads yet. Share your site to start collecting inquiries.
      </CardContent></Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>All leads</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>School / Country</TableHead>
              <TableHead>Stage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(l.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-medium">
                  {l.name}
                  {l.phone && <div className="text-xs text-muted-foreground">{l.phone}</div>}
                </TableCell>
                <TableCell>
                  <a className="text-primary hover:underline" href={`mailto:${l.email}`}>{l.email}</a>
                  {l.message && <div className="text-xs text-muted-foreground line-clamp-2 max-w-xs">{l.message}</div>}
                </TableCell>
                <TableCell className="text-sm">
                  {l.school_name || "—"}
                  <div className="text-xs text-muted-foreground">{[l.country, l.board].filter(Boolean).join(" • ")}</div>
                </TableCell>
                <TableCell>
                  <Select
                    value={l.stage}
                    onValueChange={(v) => update.mutate({ id: l.id, stage: v })}
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["new","contacted","demo","won","lost"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ClientsTab({ clients }: { clients: any[] }) {
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Clients ({clients.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Joined</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.display_name || "—"}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SubscriptionsTab({ subs, clients }: { subs: any[]; clients: any[] }) {
  const emailFor = (id: string) => clients.find((c) => c.id === id)?.email ?? id.slice(0, 8);
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Subscriptions ({subs.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Client</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead>
            <TableHead>Renews</TableHead><TableHead>Env</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {subs.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{emailFor(s.user_id)}</TableCell>
                <TableCell className="text-xs">{s.product_id}<div className="text-muted-foreground">{s.price_id}</div></TableCell>
                <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-xs uppercase">{s.environment}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsageTab({ usage, clients }: { usage: any[]; clients: any[] }) {
  const emailFor = (id: string) => clients.find((c) => c.id === id)?.email ?? id.slice(0, 8);
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Plan usage</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Client</TableHead><TableHead>Month</TableHead>
            <TableHead>AI credits</TableHead><TableHead>Exports</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {usage.map((u, i) => (
              <TableRow key={i}>
                <TableCell>{emailFor(u.user_id)}</TableCell>
                <TableCell className="text-xs">{u.period_month}</TableCell>
                <TableCell>{u.ai_credits_used}</TableCell>
                <TableCell>{u.exports_used}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SchoolsTab({ schools }: { schools: any[] }) {
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Schools ({schools.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>School</TableHead><TableHead>Country</TableHead>
            <TableHead>Board</TableHead><TableHead>Fee tier</TableHead><TableHead>Added</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {schools.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium"><School className="inline h-3.5 w-3.5 mr-1.5 text-muted-foreground" />{s.name}</TableCell>
                <TableCell>{s.country || "—"}</TableCell>
                <TableCell>{s.board || "—"}</TableCell>
                <TableCell>{s.fee_tier || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AccessTab() {
  const listFn = useServerFn(listAdmins);
  const promoteFn = useServerFn(promoteToAdmin);
  const revokeFn = useServerFn(revokeAdmin);
  const qc = useQueryClient();
  const admins = useQuery({ queryKey: ["admins"], queryFn: () => listFn() });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const promote = useMutation({
    mutationFn: () => promoteFn({ data: { email, code, role: "admin" } }),
    onSuccess: () => {
      toast.success(`${email} is now an admin`);
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (user_id: string) => revokeFn({ data: { user_id, code } }),
    onSuccess: () => {
      toast.success("Admin access revoked");
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Grant admin access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter the email of an existing user and the special promotion code.
            Both are required — your login alone does not authorize promotion.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="email">User email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@school.edu" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">Promotion code</Label>
            <Input id="code" type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Special code" />
          </div>
          <Button onClick={() => promote.mutate()} disabled={!email || !code || promote.isPending} className="w-full">
            {promote.isPending ? "Granting…" : "Grant admin access"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current admins</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {(admins.data ?? []).map((a: any) => (
              <li key={`${a.user_id}-${a.role}`} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium">{a.email || a.user_id.slice(0, 8)}</div>
                  <Badge variant={a.role === "super_admin" ? "default" : "secondary"} className="mt-1 text-[10px]">{a.role}</Badge>
                </div>
                {a.role === "admin" && (
                  <Button size="sm" variant="ghost" onClick={() => revoke.mutate(a.user_id)} disabled={!code || revoke.isPending}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!code && <p className="mt-3 text-xs text-muted-foreground">Enter the promotion code to enable revoke.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditTab() {
  const fn = useServerFn(listAuditLog);
  const q = useQuery({ queryKey: ["admin-audit"], queryFn: () => fn() });
  if (q.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading audit log…</div>;
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <Card className="mt-4"><CardContent className="p-10 text-center text-muted-foreground">
        No admin actions logged yet.
      </CardContent></Card>
    );
  }
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Admin audit log ({rows.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>When</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Details</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-sm">{r.actor_email || r.actor_id?.slice(0, 8)}</TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px]">{r.action}</Badge></TableCell>
                <TableCell className="text-xs">
                  {r.target_type ? <span className="text-muted-foreground">{r.target_type}:</span> : null} {r.target_id?.slice(0, 8) || "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-md">
                  {r.details && Object.keys(r.details).length > 0
                    ? Object.entries(r.details).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join(" · ")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
