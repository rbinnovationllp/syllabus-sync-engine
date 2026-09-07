import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getCompanyCrmOperations, createCompanySupportTicket, updateCompanySupportTicketStatus } from "@/lib/company-crm.functions";
import {
  approveAskSynkaiKnowledgeSource,
  listAskSynkaiKnowledgeBase,
  refreshAskSynkaiKnowledgeBase,
} from "@/lib/ask-synkai-knowledge.functions";
import {
  createPilotProgram,
  listCompanyPilotWorkflows,
  reviewPilotBenefitRequest,
} from "@/lib/pilot-benefits.functions";
import { getVisitorConversionReport } from "@/lib/site-analytics.functions";
import { getAcquisitionReport } from "@/lib/acquisition.functions";
import { acquisitionSourceLabel } from "@/lib/acquisition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, Briefcase, Building2, CheckCircle2, Eye, Headphones, IndianRupee, Loader2, Plus, ReceiptIndianRupee, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
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
          <TabsList className="grid w-full max-w-7xl grid-cols-7">
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="pilot">Pilot Benefits</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="knowledge">Ask SynkAI</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="catalog">Plan catalog</TabsTrigger>
          </TabsList>
          <TabsContent value="subscriptions"><SubscriptionPanel data={d} /></TabsContent>
          <TabsContent value="storage"><StorageAutomationPanel data={d} /></TabsContent>
          <TabsContent value="pilot"><PilotBenefitsPanel /></TabsContent>
          <TabsContent value="support"><SupportPanel data={d} /></TabsContent>
          <TabsContent value="knowledge"><AskSynkaiKnowledgePanel /></TabsContent>
          <TabsContent value="accounts"><AccountsPanel accounts={d.accounts} /></TabsContent>
          <TabsContent value="catalog"><CatalogPanel rows={d.catalog} /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function AskSynkaiKnowledgePanel() {
  const listFn = useServerFn(listAskSynkaiKnowledgeBase);
  const refreshFn = useServerFn(refreshAskSynkaiKnowledgeBase);
  const approveFn = useServerFn(approveAskSynkaiKnowledgeSource);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["ask-synkai-knowledge"], queryFn: () => listFn(), retry: false });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ask-synkai-knowledge"] });
    qc.invalidateQueries({ queryKey: ["company-crm-ops"] });
  };
  const refreshKb = useMutation({
    mutationFn: () => refreshFn(),
    onSuccess: (run: any) => {
      toast.success(run?.pending_count ? "Knowledge refreshed; critical updates need approval" : "Ask SynkAI knowledge refreshed");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Knowledge source approved");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Ask SynkAI knowledge status...
        </CardContent>
      </Card>
    );
  }

  const data = q.data;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={Brain} label="Indexed sources" value={data?.summary.total ?? 0} />
        <Metric icon={CheckCircle2} label="Approved" value={data?.summary.approved ?? 0} />
        <Metric icon={RefreshCw} label="Pending" value={data?.summary.pending ?? 0} />
        <Metric icon={ShieldCheck} label="Critical pending" value={data?.summary.criticalPending ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Ask SynkAI Knowledge Synchronization</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Refresh indexed platform knowledge from approved project documentation, pricing, policies, and security framework. Critical changes remain pending until approved.
              </p>
            </div>
            <Button onClick={() => refreshKb.mutate()} disabled={refreshKb.isPending}>
              {refreshKb.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh knowledge
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Validation</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.sources ?? []).map((source: any) => (
                <TableRow key={source.id}>
                  <TableCell className="min-w-52">
                    <div className="font-medium">{source.title}</div>
                    <div className="text-xs text-muted-foreground">{source.source_key}</div>
                  </TableCell>
                  <TableCell>{source.category}</TableCell>
                  <TableCell>
                    <Badge variant={source.status === "approved" ? "default" : source.status === "pending" ? "secondary" : "destructive"}>
                      {source.status}{source.critical ? " · critical" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>{source.validation_status}</div>
                    {source.validation_notes ? <div className="text-xs text-muted-foreground">{source.validation_notes}</div> : null}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="max-h-20 overflow-hidden text-xs text-muted-foreground">{source.preview}</p>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={source.status === "approved" || approve.isPending}
                      onClick={() => approve.mutate(source.id)}
                    >
                      Approve
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent synchronization runs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(data?.runs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync runs yet. Click Refresh knowledge to create the first index.</p>
          ) : data.runs.map((run: any) => (
            <div key={run.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-medium">{new Date(run.created_at).toLocaleString()}</div>
                <Badge variant={run.status === "success" ? "default" : "secondary"}>{run.status}</Badge>
              </div>
              <div className="mt-1 text-muted-foreground">
                Indexed {run.sources_indexed}, approved {run.approved_count}, pending {run.pending_count}. {run.notes}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
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

function formatBytes(bytes: number) {
  if (!bytes) return "0 GB";
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
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

function StorageAutomationPanel({ data }: any) {
  const automation = data.storageAutomation ?? {};
  const recentEvents = automation.recentEvents ?? [];
  const consumption = automation.consumptionByOrg ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={Briefcase} label="Storage sold" value={`${data.metrics.storageSoldGb ?? 0} GB`} />
        <Metric icon={IndianRupee} label="Storage revenue" value={`Rs ${Math.round(data.metrics.storageRevenueInr ?? 0).toLocaleString()}`} />
        <Metric icon={Headphones} label="Pending / failed events" value={data.metrics.storagePendingOrFailed ?? 0} />
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Storage Upgrades</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentEvents.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">No storage automation events yet.</TableCell></TableRow>
              ) : recentEvents.map((event: any) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.organizations?.name || event.school_name || event.org_id || "-"}</TableCell>
                  <TableCell>{event.storage_purchased_gb} GB</TableCell>
                  <TableCell>
                    <div>{event.currency ? `${String(event.currency).toUpperCase()} ${Math.round(Number(event.transaction_amount_minor ?? 0) / 100).toLocaleString()}` : "-"}</div>
                    <div className="text-xs text-muted-foreground">{event.payment_status}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{event.payment_reference || event.provider_subscription_id || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={event.system_action_status === "allocated" ? "default" : event.system_action_status === "failed" ? "destructive" : "secondary"}>
                      {event.system_action_status}
                    </Badge>
                    {event.failure_reason ? <div className="mt-1 max-w-xs text-xs text-red-700">{event.failure_reason}</div> : null}
                  </TableCell>
                  <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>School-wise Storage Consumption</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>School</TableHead><TableHead>Used storage</TableHead><TableHead>Files</TableHead></TableRow></TableHeader>
            <TableBody>
              {consumption.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-muted-foreground">No school storage files recorded yet.</TableCell></TableRow>
              ) : consumption.map((row: any) => (
                <TableRow key={row.orgId}>
                  <TableCell className="font-medium">{row.schoolName}</TableCell>
                  <TableCell>{formatBytes(Number(row.usedBytes ?? 0))}</TableCell>
                  <TableCell>{row.fileCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PilotBenefitsPanel() {
  const listFn = useServerFn(listCompanyPilotWorkflows);
  const createFn = useServerFn(createPilotProgram);
  const reviewFn = useServerFn(reviewPilotBenefitRequest);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["company-pilot-benefits"], queryFn: () => listFn() });
  const [programForm, setProgramForm] = useState({
    school_id: "",
    school_name: "",
    pilot_start_date: "",
    pilot_end_date: "",
    approved_plan_id: "",
    monthly_base_amount: "",
    gst_amount: "",
    gateway_charges: "",
    bank_charges: "",
    other_deductions: "",
    total_paid: "",
    gst_treatment: "non_refundable",
    refund_credit_eligibility_status: "eligible",
    mou_reference: "",
    mou_document_url: "",
    internal_notes: "",
  });
  const [reviewForm, setReviewForm] = useState({
    request_id: "",
    admin_secret_code: "",
    company_adjusted_deductions: "0",
    company_adjustment_reason: "",
    rejection_reason: "",
    internal_notes: "",
  });
  const refresh = () => q.refetch();
  const create = useMutation({
    mutationFn: () => createFn({
      data: {
        ...programForm,
        monthly_base_amount: Number(programForm.monthly_base_amount || 0),
        gst_amount: Number(programForm.gst_amount || 0),
        gateway_charges: Number(programForm.gateway_charges || 0),
        bank_charges: Number(programForm.bank_charges || 0),
        other_deductions: Number(programForm.other_deductions || 0),
        total_paid: Number(programForm.total_paid || 0),
      } as any,
    }),
    onSuccess: () => {
      toast.success("Approved pilot school recorded");
      setProgramForm({
        school_id: "",
        school_name: "",
        pilot_start_date: "",
        pilot_end_date: "",
        approved_plan_id: "",
        monthly_base_amount: "",
        gst_amount: "",
        gateway_charges: "",
        bank_charges: "",
        other_deductions: "",
        total_paid: "",
        gst_treatment: "non_refundable",
        refund_credit_eligibility_status: "eligible",
        mou_reference: "",
        mou_document_url: "",
        internal_notes: "",
      });
      refresh();
      qc.invalidateQueries({ queryKey: ["company-crm-ops"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const review = useMutation({
    mutationFn: (action: "approve" | "reject" | "clarification_required" | "on_hold") => reviewFn({
      data: {
        ...reviewForm,
        action,
        company_adjusted_deductions: Number(reviewForm.company_adjusted_deductions || 0),
      } as any,
    }),
    onSuccess: (_row, action) => {
      toast.success(action === "approve" ? "Pilot benefit approved" : "Pilot benefit request updated");
      setReviewForm({ request_id: "", admin_secret_code: "", company_adjusted_deductions: "0", company_adjustment_reason: "", rejection_reason: "", internal_notes: "" });
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const data = q.data;
  const pending = (data?.requests ?? []).filter((row: any) => ["pending_company_approval", "on_hold", "clarification_required", "failed"].includes(row.status));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={Building2} label="Approved pilots" value={data?.metrics.approvedPilots ?? 0} />
        <Metric icon={Headphones} label="Requests needing review" value={data?.metrics.pendingRequests ?? 0} />
        <Metric icon={ReceiptIndianRupee} label="Active credit" value={`Rs ${Math.round(Number(data?.metrics.activeCreditsMinor ?? 0) / 100).toLocaleString("en-IN")}`} />
        <Metric icon={IndianRupee} label="Refunds initiated" value={`Rs ${Math.round(Number(data?.metrics.refundsInitiatedMinor ?? 0) / 100).toLocaleString("en-IN")}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Approve Paid Pilot School</CardTitle>
            <p className="text-sm text-muted-foreground">
              Record a paid two-month pilot with MOU reference, plan, payment amounts, and refund/credit eligibility.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5"><Label>School organization ID</Label><Input value={programForm.school_id} onChange={(e) => setProgramForm({ ...programForm, school_id: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>School name</Label><Input value={programForm.school_name} onChange={(e) => setProgramForm({ ...programForm, school_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Start date</Label><Input type="date" value={programForm.pilot_start_date} onChange={(e) => setProgramForm({ ...programForm, pilot_start_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>End date</Label><Input type="date" value={programForm.pilot_end_date} onChange={(e) => setProgramForm({ ...programForm, pilot_end_date: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Approved plan ID</Label><Input value={programForm.approved_plan_id} onChange={(e) => setProgramForm({ ...programForm, approved_plan_id: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Monthly base Rs</Label><Input type="number" value={programForm.monthly_base_amount} onChange={(e) => setProgramForm({ ...programForm, monthly_base_amount: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Total paid Rs</Label><Input type="number" value={programForm.total_paid} onChange={(e) => setProgramForm({ ...programForm, total_paid: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>GST Rs</Label><Input type="number" value={programForm.gst_amount} onChange={(e) => setProgramForm({ ...programForm, gst_amount: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Gateway charges Rs</Label><Input type="number" value={programForm.gateway_charges} onChange={(e) => setProgramForm({ ...programForm, gateway_charges: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Bank charges Rs</Label><Input type="number" value={programForm.bank_charges} onChange={(e) => setProgramForm({ ...programForm, bank_charges: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Other deductions Rs</Label><Input type="number" value={programForm.other_deductions} onChange={(e) => setProgramForm({ ...programForm, other_deductions: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={programForm.gst_treatment} onValueChange={(gst_treatment) => setProgramForm({ ...programForm, gst_treatment })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="non_refundable">GST non-refundable</SelectItem>
                  <SelectItem value="refundable">GST refundable</SelectItem>
                  <SelectItem value="manual_review">GST manual review</SelectItem>
                </SelectContent>
              </Select>
              <Select value={programForm.refund_credit_eligibility_status} onValueChange={(refund_credit_eligibility_status) => setProgramForm({ ...programForm, refund_credit_eligibility_status })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eligible">Eligible</SelectItem>
                  <SelectItem value="manual_review">Manual review</SelectItem>
                  <SelectItem value="not_eligible">Not eligible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="MOU reference" value={programForm.mou_reference} onChange={(e) => setProgramForm({ ...programForm, mou_reference: e.target.value })} />
            <Input placeholder="MOU document link" value={programForm.mou_document_url} onChange={(e) => setProgramForm({ ...programForm, mou_document_url: e.target.value })} />
            <Textarea placeholder="Internal notes" value={programForm.internal_notes} onChange={(e) => setProgramForm({ ...programForm, internal_notes: e.target.value })} />
            <Button className="w-full" disabled={create.isPending || !programForm.school_id || !programForm.pilot_start_date || !programForm.pilot_end_date} onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Mark as Approved Pilot School
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Pilot Refund and Credit Approvals</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <Input placeholder="Selected request ID" value={reviewForm.request_id} onChange={(e) => setReviewForm({ ...reviewForm, request_id: e.target.value })} />
                <Input placeholder="Company secret code" type="password" value={reviewForm.admin_secret_code} onChange={(e) => setReviewForm({ ...reviewForm, admin_secret_code: e.target.value })} />
                <Input placeholder="Extra deduction Rs" type="number" value={reviewForm.company_adjusted_deductions} onChange={(e) => setReviewForm({ ...reviewForm, company_adjusted_deductions: e.target.value })} />
                <Input placeholder="Mandatory adjustment reason" value={reviewForm.company_adjustment_reason} onChange={(e) => setReviewForm({ ...reviewForm, company_adjustment_reason: e.target.value })} />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Textarea placeholder="Reject / clarification reason" value={reviewForm.rejection_reason} onChange={(e) => setReviewForm({ ...reviewForm, rejection_reason: e.target.value })} />
                <Textarea placeholder="Internal approval notes" value={reviewForm.internal_notes} onChange={(e) => setReviewForm({ ...reviewForm, internal_notes: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button disabled={review.isPending || !reviewForm.request_id || !reviewForm.admin_secret_code} onClick={() => review.mutate("approve")}>Approve</Button>
                <Button variant="outline" disabled={review.isPending || !reviewForm.request_id || !reviewForm.admin_secret_code} onClick={() => review.mutate("clarification_required")}>Return for clarification</Button>
                <Button variant="outline" disabled={review.isPending || !reviewForm.request_id || !reviewForm.admin_secret_code} onClick={() => review.mutate("on_hold")}>Hold</Button>
                <Button variant="destructive" disabled={review.isPending || !reviewForm.request_id || !reviewForm.admin_secret_code} onClick={() => review.mutate("reject")}>Reject</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pending and Recent Requests</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>School</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Eligible</TableHead><TableHead>MOU</TableHead><TableHead>Request ID</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {q.isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-muted-foreground">Loading pilot requests...</TableCell></TableRow>
                  ) : pending.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-muted-foreground">No pilot benefit requests require review.</TableCell></TableRow>
                  ) : pending.map((row: any) => (
                    <TableRow key={row.id} className="cursor-pointer" onClick={() => setReviewForm({ ...reviewForm, request_id: row.id })}>
                      <TableCell className="font-medium">{row.organizations?.name || row.school_id}</TableCell>
                      <TableCell><Badge variant="outline">{row.request_type}</Badge></TableCell>
                      <TableCell><Badge variant={row.status === "failed" ? "destructive" : "secondary"}>{row.status}</Badge></TableCell>
                      <TableCell>Rs {Math.round(Number(row.eligible_amount_minor ?? 0) / 100).toLocaleString("en-IN")}</TableCell>
                      <TableCell>{row.pilot_programs?.mou_reference || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Credit Ledger and Refund Tracker</CardTitle></CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                {(data?.credits ?? []).slice(0, 8).map((credit: any) => (
                  <div key={credit.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{credit.organizations?.name || credit.school_id}</span>
                      <Badge>{credit.status}</Badge>
                    </div>
                    <p className="text-muted-foreground">Remaining Rs {Math.round(Number(credit.remaining_amount_minor ?? 0) / 100).toLocaleString("en-IN")} of Rs {Math.round(Number(credit.credit_amount_minor ?? 0) / 100).toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {(data?.refunds ?? []).slice(0, 8).map((refund: any) => (
                  <div key={refund.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{refund.organizations?.name || refund.school_id}</span>
                      <Badge variant={refund.refund_status === "failed" ? "destructive" : "secondary"}>{refund.refund_status}</Badge>
                    </div>
                    <p className="text-muted-foreground">Refund Rs {Math.round(Number(refund.approved_refund_amount_minor ?? 0) / 100).toLocaleString("en-IN")} · {refund.gateway_refund_id || refund.original_payment_id || "-"}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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
                <TableCell>Rs {p.monthly_inr} — Inclusive of GST</TableCell>
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
