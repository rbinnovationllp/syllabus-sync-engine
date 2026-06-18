import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getCrmAccount, createCrmContact, createCrmDeal, updateCrmDealStage,
  createCrmActivity, completeCrmActivity, addCrmNote, provisionSchoolFromAccount,
} from "@/lib/crm.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Building2, Check, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm/accounts/$id")({
  head: () => ({ meta: [{ title: "Account — CRM" }] }),
  component: AccountDetail,
});

const DEAL_STAGES = ["qualified", "demo", "proposal", "negotiation", "won", "lost"] as const;

function AccountDetail() {
  const { id } = Route.useParams();
  const fn = useServerFn(getCrmAccount);
  const provFn = useServerFn(provisionSchoolFromAccount);
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["crm-account", id], queryFn: () => fn({ data: { id } }) });

  const provision = useMutation({
    mutationFn: () => provFn({ data: { account_id: id } }),
    onSuccess: () => toast.success("School provisioned"),
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="flex min-h-[60vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (q.error) {
    return <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
      <p>{(q.error as any).message}</p>
      <Button asChild className="mt-4"><Link to="/crm">Back to CRM</Link></Button>
    </div>;
  }
  const d = q.data!;
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-account", id] });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/crm"><ArrowLeft className="h-4 w-4 mr-1" /> CRM</Link>
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> {d.account.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[d.account.board, d.account.city, d.account.country, d.account.fee_tier].filter(Boolean).join(" • ")}
          </p>
          {d.account.website && (
            <a href={d.account.website} target="_blank" rel="noopener noreferrer"
               className="text-sm text-primary hover:underline">{d.account.website}</a>
          )}
        </div>
        <Button onClick={() => provision.mutate()} disabled={provision.isPending}>
          <Sparkles className="h-4 w-4 mr-2" />
          {provision.isPending ? "Provisioning…" : "Provision school tenant"}
        </Button>
      </div>

      <Tabs defaultValue="contacts" className="mt-6">
        <TabsList>
          <TabsTrigger value="contacts">Contacts ({d.contacts.length})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({d.deals.length})</TabsTrigger>
          <TabsTrigger value="activities">Activities ({d.activities.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({d.notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts">
          <ContactsPanel accountId={id} contacts={d.contacts} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="deals">
          <DealsPanel accountId={id} deals={d.deals} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="activities">
          <ActivitiesPanel accountId={id} activities={d.activities} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesPanel accountId={id} notes={d.notes} onChanged={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContactsPanel({ accountId, contacts, onChanged }: any) {
  const fn = useServerFn(createCrmContact);
  const [form, setForm] = useState({ full_name: "", role: "", email: "", phone: "", linkedin: "" });
  const mut = useMutation({
    mutationFn: () => fn({ data: { account_id: accountId, ...form } as any }),
    onSuccess: () => {
      toast.success("Contact added");
      setForm({ full_name: "", role: "", email: "", phone: "", linkedin: "" });
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>People</CardTitle></CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          ) : (
            <ul className="divide-y">
              {contacts.map((c: any) => (
                <li key={c.id} className="py-3">
                  <div className="font-medium text-sm">{c.full_name}{c.role && <span className="text-muted-foreground"> — {c.role}</span>}</div>
                  <div className="text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" • ")}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Add contact</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input placeholder="Role (e.g. Principal)" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="LinkedIn URL" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
          <Button className="w-full" onClick={() => mut.mutate()} disabled={!form.full_name || mut.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Add
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DealsPanel({ accountId, deals, onChanged }: any) {
  const createFn = useServerFn(createCrmDeal);
  const updFn = useServerFn(updateCrmDealStage);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", amount_inr: 0, probability: 50, expected_close_date: "", stage: "qualified" as const });
  const create = useMutation({
    mutationFn: () => createFn({ data: { account_id: accountId, ...form } as any }),
    onSuccess: () => { toast.success("Deal added"); setOpen(false); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });
  const upd = useMutation({
    mutationFn: (v: { id: string; stage: any }) => updFn({ data: v }),
    onSuccess: onChanged,
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New deal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New deal</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount (INR)</Label><Input type="number" value={form.amount_inr} onChange={(e) => setForm({ ...form, amount_inr: Number(e.target.value) })} /></div>
                <div><Label>Probability %</Label><Input type="number" value={form.probability} onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })} /></div>
                <div><Label>Expected close</Label><Input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} /></div>
                <div><Label>Stage</Label>
                  <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DEAL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
              {create.isPending ? "Saving…" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {deals.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No deals yet.</CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <ul className="divide-y">
            {deals.map((d: any) => (
              <li key={d.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">
                    ₹{Number(d.amount_inr ?? 0).toLocaleString()} • {d.probability}% • {d.expected_close_date ?? "no date"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={d.status === "won" ? "default" : d.status === "lost" ? "destructive" : "secondary"}>{d.status}</Badge>
                  <Select value={d.stage} onValueChange={(v) => upd.mutate({ id: d.id, stage: v })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{DEAL_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        </CardContent></Card>
      )}
    </div>
  );
}

function ActivitiesPanel({ accountId, activities, onChanged }: any) {
  const createFn = useServerFn(createCrmActivity);
  const completeFn = useServerFn(completeCrmActivity);
  const [form, setForm] = useState({ type: "task" as const, subject: "", body: "", due_at: "" });
  const create = useMutation({
    mutationFn: () => createFn({ data: { account_id: accountId, ...form } as any }),
    onSuccess: () => {
      toast.success("Activity added"); setForm({ type: "task", subject: "", body: "", due_at: "" }); onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const complete = useMutation({
    mutationFn: (id: string) => completeFn({ data: { id } }),
    onSuccess: onChanged,
  });
  return (
    <div className="mt-4 grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities.</p>
          ) : (
            <ul className="divide-y">
              {activities.map((a: any) => (
                <li key={a.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      <Badge variant="outline" className="mr-2 capitalize">{a.type}</Badge>
                      {a.subject}
                    </div>
                    {a.body && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(a.created_at).toLocaleString()}{a.due_at && ` • due ${new Date(a.due_at).toLocaleString()}`}
                    </div>
                  </div>
                  {!a.completed_at && (
                    <Button size="sm" variant="ghost" onClick={() => complete.mutate(a.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Log activity</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["call","meeting","email","task","note"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Textarea placeholder="Notes" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
          <Button className="w-full" onClick={() => create.mutate()} disabled={!form.subject || create.isPending}>
            <Plus className="h-4 w-4 mr-2" /> Log
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NotesPanel({ accountId, notes, onChanged }: any) {
  const fn = useServerFn(addCrmNote);
  const [body, setBody] = useState("");
  const mut = useMutation({
    mutationFn: () => fn({ data: { parent_type: "account", parent_id: accountId, body } }),
    onSuccess: () => { toast.success("Note added"); setBody(""); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-4">
      <Card><CardContent className="p-4 space-y-2">
        <Textarea placeholder="Quick note…" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        <Button onClick={() => mut.mutate()} disabled={!body || mut.isPending}>Add note</Button>
      </CardContent></Card>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n: any) => (
            <li key={n.id} className="rounded-md border p-3 bg-muted/30">
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
