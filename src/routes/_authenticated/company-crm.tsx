import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getCompanyCrmOperations, createCompanySupportTicket, updateCompanySupportTicketStatus } from "@/lib/company-crm.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, Building2, Headphones, IndianRupee, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/company-crm")({
  head: () => ({ meta: [{ title: "Company CRM - CurriculumOS" }] }),
  component: CompanyCrmPage,
});

function CompanyCrmPage() {
  const fn = useServerFn(getCompanyCrmOperations);
  const q = useQuery({ queryKey: ["company-crm-ops"], queryFn: () => fn() });

  if (q.isLoading) {
    return <AppShell title="Company CRM"><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div></AppShell>;
  }
  if (q.error) {
    return (
      <AppShell title="Company CRM">
        <Card className="mx-auto max-w-2xl">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-2xl font-semibold">Company CRM is super-admin only</h1>
            <p className="mt-2 text-sm text-muted-foreground">{(q.error as Error).message}</p>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const d = q.data!;
  return (
    <AppShell title="Company CRM">
      <div className="space-y-6">
        <div className="rounded-2xl border bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Company Operations CRM</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Sales pipeline, subscriptions, support work, onboarding visibility, and plan analysis for running Syllabus Sync as a company.
              </p>
            </div>
            <Badge className="bg-white text-slate-950 hover:bg-white">Private company workspace</Badge>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Building2} label="School accounts" value={d.metrics.schools} />
          <Metric icon={Briefcase} label="Active subscriptions" value={d.metrics.activeSubscriptions} />
          <Metric icon={Headphones} label="Open tickets" value={d.metrics.openTickets} />
          <Metric icon={IndianRupee} label="Open pipeline" value={`Rs ${Math.round(d.metrics.openPipelineInr).toLocaleString()}`} />
        </div>

        <Tabs defaultValue="subscriptions" className="space-y-4">
          <TabsList className="grid w-full max-w-4xl grid-cols-4">
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="catalog">Plan catalog</TabsTrigger>
          </TabsList>
          <TabsContent value="subscriptions"><SubscriptionPanel data={d} /></TabsContent>
          <TabsContent value="support"><SupportPanel data={d} /></TabsContent>
          <TabsContent value="accounts"><AccountsPanel accounts={d.accounts} /></TabsContent>
          <TabsContent value="catalog"><CatalogPanel rows={d.catalog} /></TabsContent>
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
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-700"><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}

function SubscriptionPanel({ data }: any) {
  const plans = Object.entries(data.byPlan ?? {});
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle>Plan mix</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {plans.length === 0 ? <p className="text-sm text-muted-foreground">No subscription rows yet.</p> : plans.map(([code, count]) => (
            <div key={code} className="flex items-center justify-between rounded-lg border p-3">
              <span className="font-medium">{code}</span>
              <Badge>{String(count)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent subscriptions</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Price ID</TableHead><TableHead>Environment</TableHead><TableHead>Period end</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data.subscriptions ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{s.price_id}</TableCell>
                  <TableCell>{s.environment}</TableCell>
                  <TableCell>{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SupportPanel({ data }: any) {
  const createFn = useServerFn(createCompanySupportTicket);
  const updateFn = useServerFn(updateCompanySupportTicketStatus);
  const qc = useQueryClient();
  const [form, setForm] = useState({ subject: "", priority: "normal", category: "support", notes: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["company-crm-ops"] });
  const create = useMutation({
    mutationFn: () => createFn({ data: form as any }),
    onSuccess: () => { toast.success("Ticket created"); setForm({ subject: "", priority: "normal", category: "support", notes: "" }); refresh(); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (v: any) => updateFn({ data: v }),
    onSuccess: refresh,
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle>Create support item</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["low","normal","high","urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button className="w-full" onClick={() => create.mutate()} disabled={!form.subject || create.isPending}><Plus className="mr-2 h-4 w-4" />Add ticket</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Support and onboarding tickets</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Client</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data.tickets ?? []).map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.subject}</TableCell>
                  <TableCell><Badge variant={t.priority === "urgent" ? "destructive" : "secondary"}>{t.priority}</Badge></TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell>{t.crm_accounts?.name || t.organizations?.name || "-"}</TableCell>
                  <TableCell>
                    <Select value={t.status} onValueChange={(status) => update.mutate({ id: t.id, status })}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>{["open","waiting","resolved","closed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountsPanel({ accounts }: any) {
  return (
    <Card>
      <CardHeader><CardTitle>School accounts</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>School</TableHead><TableHead>Board</TableHead><TableHead>Location</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
          <TableBody>
            {(accounts ?? []).map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>{a.board || "-"}</TableCell>
                <TableCell>{[a.city, a.country].filter(Boolean).join(", ") || "-"}</TableCell>
                <TableCell>{new Date(a.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CatalogPanel({ rows }: any) {
  return (
    <Card>
      <CardHeader><CardTitle>Plan catalog and analysis codes</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Variant</TableHead><TableHead>USD</TableHead><TableHead>INR</TableHead><TableHead>Credits</TableHead><TableHead>Storage</TableHead></TableRow></TableHeader>
          <TableBody>
            {(rows ?? []).map((p: any) => (
              <TableRow key={p.plan_code}>
                <TableCell className="font-mono font-semibold">{p.plan_code}</TableCell>
                <TableCell>{p.plan_name}</TableCell>
                <TableCell><Badge variant="secondary">{p.variant}</Badge></TableCell>
                <TableCell>${p.monthly_usd}</TableCell>
                <TableCell>Rs {p.monthly_inr}</TableCell>
                <TableCell>{p.monthly_credits?.toLocaleString?.() ?? p.monthly_credits}</TableCell>
                <TableCell>{p.storage_gb} GB</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
