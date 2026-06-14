import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Loader2, ExternalLink, X, Sparkles, Info } from "lucide-react";
import { toast } from "sonner";
import {
  PLANS,
  ADD_ONS,
  AI_ACTION_COSTS,
  PAID_SERVICES,
  type Currency,
} from "@/lib/plans";
import { useSubscription } from "@/hooks/useSubscription";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/pricing")({
  component: PricingPage,
});

const ACTION_LABELS: Record<keyof typeof AI_ACTION_COSTS, string> = {
  generate_annual_calendar: "Annual academic calendar",
  generate_subject_curriculum: "Subject curriculum plan",
  recalculate_schedule: "Recalculate schedule",
  generate_lesson_plan: "Lesson plan",
  generate_teacher_training: "Teacher training roadmap",
};

function PricingPage() {
  const [currency, setCurrency] = useState<Currency>("usd");
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const { subscription, plan: currentPlan, isActive } = useSubscription();
  const portalFn = useServerFn(createPortalSession);

  const returnUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/pricing?checkout=success`),
    [],
  );

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await portalFn({ data: { environment: getStripeEnvironment(), returnUrl } });
      if ("error" in res) throw new Error(res.error);
      window.open(res.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <AppShell title="Plans & billing">
      <PaymentTestModeBanner />
      <div className="max-w-6xl mx-auto py-8 space-y-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Tiered by grade band. Upgrade, downgrade, or cancel anytime from the billing portal.
          </p>
          <div className="inline-flex mt-6 rounded-md border p-1 bg-muted">
            <button
              onClick={() => setCurrency("usd")}
              className={`px-4 py-1.5 text-sm rounded ${currency === "usd" ? "bg-background shadow" : "text-muted-foreground"}`}
            >
              Global (USD)
            </button>
            <button
              onClick={() => setCurrency("inr")}
              className={`px-4 py-1.5 text-sm rounded ${currency === "inr" ? "bg-background shadow" : "text-muted-foreground"}`}
            >
              India (INR)
            </button>
          </div>
        </div>

        {isActive && currentPlan && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex items-center justify-between py-4">
              <div className="text-sm">
                <span className="font-medium">{currentPlan.name}</span>
                <span className="text-muted-foreground"> · {subscription?.status}</span>
                {subscription?.cancel_at_period_end && (
                  <Badge variant="secondary" className="ml-2">Cancels at period end</Badge>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={openPortal} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-1" />}
                Manage billing
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Plans grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLANS.map((p) => {
            const price = p.prices.find((x) => x.currency === currency)!;
            const isCurrent = currentPlan?.id === p.id && isActive;
            const isUpgrade = currentPlan && currentPlan.rank < p.rank;
            const isDowngrade = currentPlan && currentPlan.rank > p.rank;
            return (
              <Card key={p.id} className={`relative flex flex-col ${isCurrent ? "border-primary shadow-md" : ""}`}>
                {isCurrent && <Badge className="absolute -top-2 right-4">Current</Badge>}
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription className="text-xs">{p.tagline}</CardDescription>
                  <div className="text-2xl font-bold pt-2">{price.display}</div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <ul className="space-y-1.5 text-xs">
                    {p.restrictions.map((r) => {
                      const negative = /^no\b/i.test(r);
                      return (
                        <li key={r} className="flex items-start gap-2">
                          {negative ? (
                            <X className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                          )}
                          <span className={negative ? "text-muted-foreground" : ""}>{r}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-auto">
                    {isCurrent ? (
                      <Button className="w-full" variant="outline" onClick={openPortal} disabled={portalLoading}>
                        Manage
                      </Button>
                    ) : isActive ? (
                      <Button
                        className="w-full"
                        variant={isUpgrade ? "default" : "outline"}
                        onClick={openPortal}
                        disabled={portalLoading}
                      >
                        {isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Switch"} via portal
                      </Button>
                    ) : (
                      <Button className="w-full" onClick={() => setCheckoutPriceId(price.priceId)}>
                        Subscribe
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* AI credit cost table */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">How AI credits are spent</h2>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Action</th>
                    <th className="text-right px-4 py-2 font-medium">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(ACTION_LABELS) as (keyof typeof ACTION_LABELS)[]).map((a) => (
                    <tr key={a} className="border-t">
                      <td className="px-4 py-2">{ACTION_LABELS[a]}</td>
                      <td className="px-4 py-2 text-right font-mono">{AI_ACTION_COSTS[a]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        {/* Add-ons */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Add-ons</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {ADD_ONS.map((a) => {
              const price = a.prices.find((x) => x.currency === currency)!;
              return (
                <Card key={a.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <CardDescription>{a.description}</CardDescription>
                    <div className="text-xl font-bold pt-2">{price.display}</div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setCheckoutPriceId(price.priceId)}
                    >
                      Buy
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Paid services */}
        <section>
          <h2 className="text-lg font-semibold mb-1">Paid services (separate quotation)</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Not included in any plan. Billed per engagement.
          </p>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {PAID_SERVICES.map((s) => (
                    <tr key={s.name} className="border-t first:border-t-0">
                      <td className="px-4 py-2">{s.name}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{s.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        {/* Fair Usage Policy */}
        <section className="rounded-lg border bg-muted/30 p-5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">Fair Usage Policy</h3>
              <p className="text-muted-foreground">
                AI-generated curriculum planning, chapter analysis, lesson plans, and recalibration
                requests are subject to monthly usage limits. Additional AI credits may be purchased
                separately and never expire. Quotas reset at the start of each billing cycle.
                Consulting, teacher training, board audits, custom reports, and on-site visits are
                billed separately from any subscription.
              </p>
            </div>
          </div>
        </section>
      </div>

      <Dialog open={!!checkoutPriceId} onOpenChange={(o) => !o && setCheckoutPriceId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Complete your purchase</DialogTitle>
          </DialogHeader>
          {checkoutPriceId && (
            <div className="px-6 pb-6">
              <StripeEmbeddedCheckout priceId={checkoutPriceId} returnUrl={returnUrl} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
