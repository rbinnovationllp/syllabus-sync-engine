import { getMyBillingReceipts } from "@/lib/payments.functions";
import { formatMoney } from "@/lib/ai-education-premium";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { getMyUsage } from "@/lib/usage.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { planForTier, ALL_GRADES } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/account/usage")({
  component: UsagePage,
});

function UsagePage() {
  const receiptsFn=useServerFn(getMyBillingReceipts);
  const receipts=useQuery({queryKey:["billing-receipts"],queryFn:()=>receiptsFn()});
  const fetchUsage = useServerFn(getMyUsage);
  const navigate = useNavigate();
  const { tier, plan, isActive, isLoading: subLoading } = useSubscription();
  const usageQ = useQuery({ queryKey: ["usage"], queryFn: () => fetchUsage() });

  const limits = plan?.limits;
  const usage = usageQ.data;

  return (
    <AppShell title="Plan & usage">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plan & usage</h1>
          <p className="text-sm text-muted-foreground">
            Track your current subscription limits and what you've used this month.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate({ to: "/pricing" })}>
          {isActive ? "Change plan" : "Choose a plan"}
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan
            {subLoading ? null : (
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? plan?.name ?? "Active" : "No active plan"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>{plan?.tagline ?? "Subscribe to unlock teaching capacity, AI generation and exports."}</CardDescription>
        </CardHeader>
        <CardContent>
          {!plan ? (
            <Button onClick={() => navigate({ to: "/pricing" })}>See pricing</Button>
          ) : (
            <ul className="text-sm space-y-1 text-muted-foreground">
              {plan.features.map((f) => <li key={f}>• {f}</li>)}
            </ul>
          )}
        </CardContent>
      </Card>

      {limits && usage && (
        <div className="grid gap-4 sm:grid-cols-2">
          <UsageCard
            title="AI credits (this month)"
            used={usage.aiCreditsUsed}
            quota={limits.aiCreditsPerMonth}
            footer={usage.aiCreditsTopUpRemaining > 0
              ? `+ ${usage.aiCreditsTopUpRemaining.toLocaleString()} top-up credits available`
              : "Top-ups never expire — buy a pack from Pricing."}
          />
          <UsageCard
            title="Exports (this month)"
            used={usage.exportsUsed}
            quota={limits.exportsPerMonth}
          />
          <UsageCard
            title="Grades planned"
            used={usage.gradeCount}
            quota={limits.maxGrades}
            footer={planGradeNote(tier, plan)}
          />
          <UsageCard
            title="Academic years"
            used={usage.academicYearCount}
            quota={limits.maxAcademicYears}
          />
          <UsageCard
            title="Team seats"
            used={usage.seatCount}
            quota={limits.maxUsers}
            footer="Need more seats? Add Extra User from Pricing."
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Storage</CardTitle>
              <CardDescription>{limits.storageGb} GB included</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Usage tracking coming soon.
            </CardContent>
          </Card>
        </div>
      )}
      <Card className="mt-6"><CardHeader><CardTitle>Payment receipts</CardTitle><CardDescription>Indian totals are Inclusive of GST. Taxable value and GST are shown separately.</CardDescription></CardHeader><CardContent className="space-y-3">
        {receipts.isError?<p>Receipts are temporarily unavailable.</p>:!receipts.data?.length?<p>No receipts recorded under the updated pricing yet.</p>:receipts.data.map((r:any)=><div key={r.id} className="rounded border p-3 text-sm space-y-1"><p className="break-all font-medium">{r.provider} · {r.provider_payment_id}</p><p>{new Date(r.created_at).toLocaleDateString('en-IN')}</p><p>Taxable value: {formatMoney(r.taxable_amount_minor/100,r.currency)}</p><p>GST: {formatMoney(r.gst_amount_minor/100,r.currency)}</p><p className="font-semibold">Total paid: {formatMoney(r.total_amount_minor/100,r.currency)} {r.currency==='inr'?'— Inclusive of GST':''}</p></div>)}
        {!!receipts.data?.length&&<Button variant="outline" onClick={()=>window.print()}>Print receipts</Button>}
      </CardContent></Card>
    </AppShell>
  );
}

function UsageCard({
  title, used, quota, footer,
}: { title: string; used: number; quota: number; footer?: string }) {
  const unlimited = quota === -1;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(quota, 1)) * 100));
  const over = !unlimited && used > quota;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {used.toLocaleString()} {unlimited ? "used" : `of ${quota.toLocaleString()}`}
          {over && <span className="ml-2 text-destructive font-medium">over limit</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!unlimited && <Progress value={pct} className={over ? "[&>div]:bg-destructive" : ""} />}
        {footer && <p className="text-xs text-muted-foreground mt-2">{footer}</p>}
      </CardContent>
    </Card>
  );
}

function planGradeNote(tier: string | null, plan: any): string | undefined {
  if (!plan) return undefined;
  if (plan.grades === "all") return `All grades: ${ALL_GRADES.join(", ")}`;
  if (tier === "retail_single_access") return "1 class, 1 subject of your choice.";
  return `Grades included: ${plan.grades.join(", ")}`;
}
