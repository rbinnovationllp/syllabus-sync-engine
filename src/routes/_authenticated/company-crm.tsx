import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getCompanyCrmOperations, createCompanySupportTicket, updateCompanySupportTicketStatus } from "@/lib/company-crm.functions";
import { getVisitorConversionReport } from "@/lib/site-analytics.functions";
import { getAcquisitionReport } from "@/lib/acquisition.functions";
import { acquisitionSourceLabel } from "@/lib/acquisition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, Building2, Eye, Headphones, IndianRupee, Loader2, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/company-crm")({
  head: () => ({ meta: [{ title: "Company CRM - CurriculumOS" }] }),
  component: CompanyCrmPage,
});

function CompanyCrmPage() {
  const fn = useServerFn(getCompanyCrmOperations);
  const conversionFn = useServerFn(getVisitorConversionReport);
  const acquisitionFn = useServerFn(getAcquisitionReport);
  const q = useQuery({ queryKey: ["company-crm-ops"], queryFn: () => fn() });
  const conversion = useQuery({ queryKey: ["visitor-conversion-report"], queryFn: () => conversionFn() });
  const acquisition = useQuery({ queryKey: ["acquisition-report"], queryFn: () => acquisitionFn() });

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

                <ConversionReportPanel report={conversion.data} isLoading={conversion.isLoading} />
        <AcquisitionReportPanel report={acquisition.data} isLoading={acquisition.isLoading} />

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


function ConversionReportPanel({ report, isLoading }: any) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading visitor conversion report...
        </CardContent>
      </Card>
    );
  }

  const all = report?.allTime ?? {};
  const week = report?.last7Days ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitor acceptance and conversion</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">All-time visitors</p>
          <p className="mt-1 text-2xl font-bold">{(all.visitors ?? 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{(all.visits ?? 0).toLocaleString()} total page visits</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Visitor to lead</p>
          <p className="mt-1 text-2xl font-bold">{all.visitorToLead ?? 0}%</p>
          <p className="text-xs text-muted-foreground">{(all.leads ?? 0).toLocaleString()} lead enquiries</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Visitor to client</p>
          <p className="mt-1 text-2xl font-bold">{all.visitorToSubscription ?? 0}%</p>
          <p className="text-xs text-muted-foreground">{(all.activeSubscriptions ?? 0).toLocaleString()} active subscriptions</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last 7 days</p>
          <p className="mt-1 text-2xl font-bold">{(week.visitors ?? 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{week.visitorToLead ?? 0}% lead rate, {week.visitorToSubscription ?? 0}% client rate</p>
        </div>
      </CardContent>
    </Card>
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

function SiteAnalyticsPanel({ data }: any) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Most viewed pages, last 7 days</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(data?.topPages ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No visits recorded yet. New visits will appear after the site is used.</p>
          ) : (
            data.topPages.map((p: any) => (
              <div key={p.path} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.path}</p>
                  <p className="text-xs text-muted-foreground">{p.visitors} unique visitors</p>
                </div>
                <Badge>{p.views} views</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent visits</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(data?.recent ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent visits yet.</p>
          ) : (
            data.recent.map((v: any) => (
              <div key={`${v.created_at}-${v.path}`} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium">{v.path}</p>
                  <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                {v.referrer && <p className="mt-1 truncate text-xs text-muted-foreground">From {v.referrer}</p>}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
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



function AcquisitionReportPanel({ report, isLoading }: { report: any; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Acquisition & referral attribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading acquisition report...</div>
        ) : !report ? (
          <div className="text-sm text-muted-foreground">No acquisition report available.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Source</TableHead><TableHead>Leads</TableHead><TableHead>Customers</TableHead><TableHead>Subscriptions</TableHead><TableHead>Conversion</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {report.bySource.map((row: any) => (
                    <TableRow key={row.source}>
                      <TableCell>{acquisitionSourceLabel(row.source)}</TableCell>
                      <TableCell>{row.leads}</TableCell>
                      <TableCell>{row.customers}</TableCell>
                      <TableCell>{row.subscriptions}</TableCell>
                      <TableCell>{row.leads ? `${Math.round((row.customers / row.leads) * 100)}%` : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Partner / code</TableHead><TableHead>Leads</TableHead><TableHead>Customers</TableHead><TableHead>Subscriptions</TableHead><TableHead>Commission</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {report.byPartner.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-muted-foreground">No partner-attributed revenue yet.</TableCell></TableRow>
                  ) : report.byPartner.map((row: any) => (
                    <TableRow key={row.partner}>
                      <TableCell>{row.partner}</TableCell>
                      <TableCell>{row.leads}</TableCell>
                      <TableCell>{row.customers}</TableCell>
                      <TableCell>{row.subscriptions}</TableCell>
                      <TableCell>{row.commission_status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">{report.directCompanyRevenueNote}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
