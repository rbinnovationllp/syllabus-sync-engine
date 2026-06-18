import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getCrmDashboard, listCrmLeads, listCrmAccounts,
  createCrmLead, createCrmAccount, updateCrmLeadStage,
  importLeadsFromWebsite, draftFollowUpEmail,
} from "@/lib/crm.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Briefcase, Building2, Inbox, Sparkles, Loader2, ShieldCheck, ArrowRight,
  CalendarClock, IndianRupee, Plus, Download,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — CurriculumOS" }] }),
  component: CrmPage,
});

const STAGES = ["new", "contacted", "qualified", "demo", "proposal", "won", "lost"] as const;

function CrmPage() {
  const fn = useServerFn(getCrmDashboard);
  const q = useQuery({ queryKey: ["crm-dashboard"], queryFn: () => fn() });

  if (q.isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (q.error) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Super-admin only</h1>
        <Button asChild className="mt-6"><Link to="/dashboard">Back to dashboard</Link></Button>
      </div>
    );
  }
  const d = q.data!;
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Briefcase className="h-7 w-7 text-primary" /> Sales CRM
        </h1>
        <p className="text-sm text-muted-foreground">Private pipeline — visible only to super-admins.</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Building2} label="Accounts" value={d.counts.accounts} accent="indigo" />
        <Kpi icon={Briefcase} label="Open deals" value={d.counts.open_deals} accent="emerald"
          sub={`₹${Math.round(d.pipelineValue).toLocaleString()} weighted`} />
        <Kpi icon={IndianRupee} label="Won this month" value={d.counts.won_this_month} accent="amber"
          sub={`₹${Math.round(d.wonValue).toLocaleString()}`} />
        <Kpi icon={Inbox} label="Leads" value={d.counts.leads} accent="pink" />
      </div>

      <Tabs defaultValue="pipeline" className="mt-8">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline"><PipelineKanban /></TabsContent>
        <TabsContent value="leads"><LeadsTable /></TabsContent>
        <TabsContent value="accounts"><AccountsTable /></TabsContent>
        <TabsContent value="upcoming"><UpcomingList items={d.upcoming} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent, sub }: any) {
  const accents: Record<string, string> = {
    indigo: "from-indigo-500 to-violet-500",
    emerald: "from-emerald-500 to-teal-500",
    pink: "from-pink-500 to-rose-500",
    amber: "from-amber-500 to-orange-500",
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={`rounded-xl bg-gradient-to-br ${accents[accent]} p-2.5 text-white shadow-md`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Pipeline kanban =====
function PipelineKanban() {
  const listFn = useServerFn(listCrmLeads);
  const updFn = useServerFn(updateCrmLeadStage);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["crm-leads"], queryFn: () => listFn() });
  const mut = useMutation({
    mutationFn: (v: { id: string; stage: any }) => updFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="py-10 text-center text-muted-foreground">Loading…</div>;
  const leads = q.data ?? [];

  return (
    <div className="mt-4 grid grid-flow-col auto-cols-[minmax(220px,1fr)] gap-3 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const items = leads.filter((l: any) => l.stage === stage);
        return (
          <div key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/plain");
              if (id) mut.mutate({ id, stage });
            }}
            className="rounded-lg border bg-muted/30 p-3 min-h-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide">{stage}</span>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.map((l: any) => (
                <div key={l.id} draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                  className="rounded-md bg-background border p-2.5 shadow-sm cursor-grab hover:shadow-md">
                  <div className="text-sm font-medium line-clamp-1">{l.name}</div>
                  {l.crm_accounts?.name && (
                    <div className="text-[11px] text-muted-foreground line-clamp-1">{l.crm_accounts.name}</div>
                  )}
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{l.source ?? "—"}</span>
                    <DraftEmailButton leadId={l.id} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DraftEmailButton({ leadId }: { leadId: string }) {
  const fn = useServerFn(draftFollowUpEmail);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const mut = useMutation({
    mutationFn: () => fn({ data: { lead_id: leadId, tone: "warm" } }),
    onSuccess: (d: any) => { setDraft(d.draft); setOpen(true); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <button className="text-primary hover:underline inline-flex items-center gap-1" onClick={(e) => { e.stopPropagation(); mut.mutate(); }} disabled={mut.isPending}>
        <Sparkles className="h-3 w-3" /> {mut.isPending ? "…" : "Draft"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>AI follow-up draft</DialogTitle></DialogHeader>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={12} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(draft); toast.success("Copied"); }}>Copy</Button>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===== Leads table + create =====
function LeadsTable() {
  const listFn = useServerFn(listCrmLeads);
  const createFn = useServerFn(createCrmLead);
  const importFn = useServerFn(importLeadsFromWebsite);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["crm-leads"], queryFn: () => listFn() });
  const [form, setForm] = useState({ name: "", email: "", phone: "", source: "manual", notes: "" });

  const create = useMutation({
    mutationFn: () => createFn({ data: { ...form, stage: "new", score: 0 } as any }),
    onSuccess: () => {
      toast.success("Lead added");
      setForm({ name: "", email: "", phone: "", source: "manual", notes: "" });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const importMut = useMutation({
    mutationFn: () => importFn(),
    onSuccess: (d: any) => {
      toast.success(`Imported ${d.inserted} website leads`);
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const leads = q.data ?? [];
  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Add lead</CardTitle>
          <Button variant="outline" onClick={() => importMut.mutate()} disabled={importMut.isPending}>
            <Download className="h-4 w-4 mr-2" />
            {importMut.isPending ? "Importing…" : "Import website leads"}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          <Textarea className="sm:col-span-3" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
            <Plus className="h-4 w-4 mr-2" />Add lead
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All leads ({leads.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Contact</TableHead>
              <TableHead>Account</TableHead><TableHead>Source</TableHead><TableHead>Stage</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {leads.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.email}{l.phone && <div>{l.phone}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{l.crm_accounts?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{l.source ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{l.stage}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Accounts =====
function AccountsTable() {
  const listFn = useServerFn(listCrmAccounts);
  const createFn = useServerFn(createCrmAccount);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["crm-accounts"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", board: "", city: "", country: "", fee_tier: "", website: "" });

  const create = useMutation({
    mutationFn: () => createFn({ data: form as any }),
    onSuccess: () => {
      toast.success("Account added");
      setOpen(false);
      setForm({ name: "", board: "", city: "", country: "", fee_tier: "", website: "" });
      qc.invalidateQueries({ queryKey: ["crm-accounts"] });
      qc.invalidateQueries({ queryKey: ["crm-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const accounts = q.data ?? [];
  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New account</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Board</Label><Input value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} /></div>
                <div><Label>Fee tier</Label>
                  <Select value={form.fee_tier} onValueChange={(v) => setForm({ ...form, fee_tier: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {["budget","mid","premium"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              </div>
              <div><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
                {create.isPending ? "Saving…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Accounts ({accounts.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Board</TableHead>
              <TableHead>Location</TableHead><TableHead>Tier</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {accounts.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-xs">{a.board ?? "—"}</TableCell>
                  <TableCell className="text-xs">{[a.city, a.country].filter(Boolean).join(", ") || "—"}</TableCell>
                  <TableCell className="text-xs">{a.fee_tier ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/crm/accounts/$id" params={{ id: a.id }}>Open <ArrowRight className="h-3 w-3 ml-1" /></Link>
                    </Button>
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

function UpcomingList({ items }: { items: any[] }) {
  if (items.length === 0) {
    return <Card className="mt-4"><CardContent className="p-10 text-center text-muted-foreground">
      No upcoming activities.</CardContent></Card>;
  }
  return (
    <Card className="mt-4">
      <CardHeader><CardTitle>Upcoming activities</CardTitle></CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((a: any) => (
            <li key={a.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{a.subject ?? a.type}</p>
                <p className="text-xs text-muted-foreground capitalize">{a.type}</p>
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {a.due_at ? new Date(a.due_at).toLocaleString() : "no date"}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
