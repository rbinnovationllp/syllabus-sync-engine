import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PLANS, type Currency } from "@/lib/plans";
import { useSubscription } from "@/hooks/useSubscription";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/_authenticated/pricing")({
  component: PricingPage,
});

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
      <div className="max-w-5xl mx-auto py-8">
        <div className="text-center mb-8">
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
          <Card className="mb-6 border-primary/40 bg-primary/5">
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((p) => {
            const price = p.prices.find((x) => x.currency === currency)!;
            const isCurrent = currentPlan?.id === p.id && isActive;
            const isUpgrade = currentPlan && currentPlan.rank < p.rank;
            const isDowngrade = currentPlan && currentPlan.rank > p.rank;
            return (
              <Card key={p.id} className={`relative ${isCurrent ? "border-primary shadow-md" : ""}`}>
                {isCurrent && <Badge className="absolute -top-2 right-4">Current</Badge>}
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                  <CardDescription>{p.tagline}</CardDescription>
                  <div className="text-3xl font-bold pt-2">{price.display}</div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
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
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-8">
          Enterprise Plus (5-year, ~$500/mo equivalent) bundles software + AI curriculum + teacher training + consulting + board compliance + dedicated support. Contact sales for custom terms.
        </p>
      </div>

      <Dialog open={!!checkoutPriceId} onOpenChange={(o) => !o && setCheckoutPriceId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Complete your subscription</DialogTitle>
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
