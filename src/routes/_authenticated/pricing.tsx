import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Loader2, ExternalLink, X, Sparkles, Info, AlertTriangle, CalendarClock, BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import {
  PLANS,
  ADD_ONS,
  AI_ACTION_COSTS,
  PAID_SERVICES,
  annualRebateEligible,
  planDisplayRestrictions,
  type Currency,
  type BillingInterval,
  type Plan,
} from "@/lib/plans";
import { useSubscription } from "@/hooks/useSubscription";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { UpiPaymentPanel } from "@/components/UpiPaymentPanel";
import { RazorpaySubscriptionButton } from "@/components/RazorpaySubscriptionButton";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { UPI_CONFIG } from "@/lib/upi";

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

interface PendingCheckout {
  plan: Plan;
  priceId: string;
  priceDisplay: string;
  interval: BillingInterval;
  amount: number;
}

function PricingPage() {
  const [currency, setCurrency] = useState<Currency>("inr");
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [pending, setPending] = useState<PendingCheckout | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [upiPayment, setUpiPayment] = useState<PendingCheckout | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showAiFutureForce, setShowAiFutureForce] = useState(false);
  const { subscription, plan: currentPlan, isActive } = useSubscription();
  const portalFn = useServerFn(createPortalSession);
  const isRazorpaySubscription = subscription?.provider === "razorpay";

  const annualEligible = useMemo(() => annualRebateEligible(currency), [currency]);
  // If user toggled annual then switched to INR mid-May+, force back to monthly.
  const effectiveInterval: BillingInterval =
    interval === "annual" && !annualEligible ? "monthly" : interval;

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

  function startCheckout(plan: Plan) {
    const price = plan.prices.find(
      (p) => p.currency === currency && (p.interval ?? "monthly") === effectiveInterval,
    );
    if (!price) {
      toast.error("Price unavailable for this selection");
      return;
    }
    setAcknowledged(false);
    setPending({
      plan,
      priceId: price.priceId,
      priceDisplay: price.display,
      interval: effectiveInterval,
      amount: price.amount,
    });
  }

  function startUpiPayment() {
    if (!pending || !acknowledged) return;
    setUpiPayment(pending);
    setPending(null);
  }

  function confirmCheckout() {
    if (!pending || !acknowledged) return;
    setCheckoutPriceId(pending.priceId);
    setPending(null);
  }

  return (
    <AppShell title="Plans & billing">
      <PaymentTestModeBanner />
      <div className="max-w-6xl mx-auto py-8 space-y-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Tiered by grade band. India payments use Razorpay as the primary gateway; international checkout remains ready for Stripe when activated.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <div className="inline-flex rounded-md border p-1 bg-muted">
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

            <div className="inline-flex rounded-md border p-1 bg-muted">
              <button
                onClick={() => setInterval("monthly")}
                className={`px-4 py-1.5 text-sm rounded ${effectiveInterval === "monthly" ? "bg-background shadow" : "text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => annualEligible && setInterval("annual")}
                disabled={!annualEligible}
                className={`px-4 py-1.5 text-sm rounded flex items-center gap-1.5 ${
                  effectiveInterval === "annual" ? "bg-background shadow" : "text-muted-foreground"
                } ${!annualEligible ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Annual
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">2 mo free</Badge>
              </button>
            </div>
          </div>

          {currency === "inr" && !annualEligible && (
            <Alert className="mt-4 text-left max-w-2xl mx-auto">
              <CalendarClock className="h-4 w-4" />
              <AlertTitle>Annual rebate unavailable right now</AlertTitle>
              <AlertDescription>
                India's academic session runs <strong>April - March</strong>. The
                &ldquo;pay-for-10, get-12&rdquo; annual rebate is only offered to
                subscribers who join <strong>on or before April</strong>. You can
                subscribe monthly today and switch to the annual plan in April when
                the next session begins.
              </AlertDescription>
            </Alert>
          )}
          {effectiveInterval === "annual" && (
            <p className="text-xs text-muted-foreground mt-3">
              Annual plans are billed as <strong>10 x monthly price</strong> once a year - 2 months free.
            </p>
          )}
        </div>

        {isActive && currentPlan && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex items-center justify-between py-4">
              <div className="text-sm">
                <span className="font-medium">{currentPlan.name}</span>
                <span className="text-muted-foreground"> - {subscription?.status}</span>
                {subscription?.cancel_at_period_end && (
                  <Badge variant="secondary" className="ml-2">Cancels at period end</Badge>
                )}
              </div>
              {isRazorpaySubscription ? (
                <Button size="sm" variant="outline" asChild>
                  <a href="mailto:support@syllabus-synk.in">Manage via support</a>
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={openPortal} disabled={portalLoading}>
                  {portalLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-1" />}
                  Manage billing
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Plans grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {PLANS.map((p) => {
            const monthly = p.prices.find((x) => x.currency === currency && (x.interval ?? "monthly") === "monthly")!;
            const price =
              p.prices.find((x) => x.currency === currency && (x.interval ?? "monthly") === effectiveInterval) ?? monthly;
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
                  {effectiveInterval === "annual" && (
                    <p className="text-[11px] text-muted-foreground">
                      vs {monthly.display} x 12 - saves 2 months
                    </p>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <ul className="space-y-1.5 text-xs">
                    {planDisplayRestrictions(p, currency).map((r) => {
                      const negative = /^no\b/i.test(r);
                      return (
                        <li key={r} className="flex items-start gap-2">
                          {negative ? (
                            <X className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                          )}
                          {r.includes("AI Leadership Suite") ? (
                            <Link to="/ai-leadership-suite" className="font-semibold text-blue-700 underline underline-offset-4 hover:text-blue-900">
                              {r}
                            </Link>
                          ) : (
                            <span className={negative ? "text-muted-foreground" : ""}>{r}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-auto">
                    {isCurrent ? (
                      isRazorpaySubscription ? (
                        <Button className="w-full" variant="outline" asChild>
                          <a href="mailto:support@syllabus-synk.in">Manage via support</a>
                        </Button>
                      ) : (
                        <Button className="w-full" variant="outline" onClick={openPortal} disabled={portalLoading}>
                          Manage
                        </Button>
                      )
                    ) : isActive ? (
                      <Button
                        className="w-full"
                        variant={isUpgrade ? "default" : "outline"}
                        onClick={isRazorpaySubscription ? () => window.location.href = "mailto:support@syllabus-synk.in" : openPortal}
                        disabled={portalLoading}
                      >
                        {isRazorpaySubscription ? "Change via support" : `${isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Switch"} via portal`}
                      </Button>
                    ) : (
                      <Button className="w-full" onClick={() => startCheckout(p)}>
                        Review &amp; subscribe
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
            {ADD_ONS.filter((a) => !a.id.startsWith("ai_future_force")).map((a) => {
              const price = a.prices.find((x) => x.currency === currency);
              if (!price) return null;
              return (
                <Card key={a.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <CardDescription>{a.description}</CardDescription>
                    <div className="text-xl font-bold pt-2">{price.display}</div>
                  </CardHeader>
                  <CardContent>
                    {currency === "inr" ? (
                      <RazorpaySubscriptionButton priceId={price.priceId} label="Pay with Razorpay" />
                    ) : (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => setCheckoutPriceId(price.priceId)}
                      >
                        Buy
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">AI Future Force Course Module</h2>
              <p className="text-xs text-muted-foreground">
                Optional Plus-plan course activation for schools that want structured AI education from Classes 1-12. It is not auto-enabled with standard plans.
              </p>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <div className="text-sm font-semibold">Do you want to evaluate AI Future Force?</div>
              <p className="text-xs text-muted-foreground">
                Review curriculum preview, weekly class options, pricing, and benefits before activation.
              </p>
            </div>
            <Button variant={showAiFutureForce ? "default" : "outline"} onClick={() => setShowAiFutureForce((v) => !v)}>
              {showAiFutureForce ? "Hide AI add-on details" : "Show optional AI add-on"}
            </Button>
          </div>
          {showAiFutureForce && (
          <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Primary School", "Classes 1-5", "Rs. 1,000 + GST", "One-time course design and activation charge. Requires an active Plus subscription."],
              ["Middle School", "Classes 6-8", "Rs. 2,000 + GST", "One-time course design and activation charge. Requires an active Plus subscription."],
              ["Higher Secondary", "Classes 9-12", "Rs. 5,000 + GST", "One-time course design and activation charge. Requires an active Plus subscription."],
              ["Enterprise Schools", "Classes 1-12", "Rs. 10,000 / mo + GST", "Monthly enterprise AI education subscription with advanced reporting, administrative controls, and future AI education features."],
            ].map(([title, grades, price, description]) => (
              <Card key={title}>
                <CardHeader>
                  <CardTitle className="text-base">{title}</CardTitle>
                  <CardDescription>{grades}</CardDescription>
                  <div className="pt-2 text-xl font-bold">{price}</div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>{description}</p>
                  <Button asChild className="w-full" variant="outline">
                    <Link to="/ai-future-force">Open AI Future Force</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <Alert className="mt-4">
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Monthly AI curriculum updates</AlertTitle>
            <AlertDescription>
              AI changes rapidly worldwide. Syllabus Synk releases one month of AI Future Force
              content at a time, with the next month available 2 days before the current month ends.
              This keeps student projects, tools, case studies, and examples current. Schools with
              inactive subscriptions do not receive future monthly releases. If a school joins near
              the end of the academic session, it receives an AI Foundation Module first and the
              remaining grade-level curriculum carries forward into the next academic session.
            </AlertDescription>
          </Alert>
          </>
          )}
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
              <p className="text-muted-foreground">
                <strong>Annual rebate:</strong> Annual plans are billed at 10x the monthly price
                (2 months free). In India, the academic session runs April-March; the rebate is
                only available to subscribers who join on or before April. Subscribers starting
                May or later pay full annual or remain monthly.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Pre-checkout: limitations acknowledgement */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Before you subscribe - please review the limits
            </DialogTitle>
            <DialogDescription>
              {pending?.plan.name} - <strong>{pending?.priceDisplay}</strong>
              {pending?.interval === "annual" && " - billed yearly (2 months free)"}
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">What's included &amp; restricted</h4>
                <ul className="space-y-1.5 text-sm">
                  {planDisplayRestrictions(pending.plan, currency).map((r) => {
                    const negative = /^no\b/i.test(r);
                    return (
                      <li key={r} className="flex items-start gap-2">
                        {negative ? (
                          <X className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        ) : (
                          <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        )}
                        <span className={negative ? "text-muted-foreground" : ""}>{r}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5 text-muted-foreground">
                <p>
                  <strong className="text-foreground">AI credits</strong> are consumed by action
                  (e.g. annual calendar = 50, curriculum plan = 25, lesson plan = 5). Exceeding your
                  monthly quota requires a top-up add-on.
                </p>
                <p>
                  <strong className="text-foreground">Exports, seats, storage and campuses</strong>{" "}
                  are hard-capped - additional capacity requires upgrading or buying an add-on.
                </p>
                <p>
                  <strong className="text-foreground">Consulting, training, audits, custom
                  development and on-site visits</strong> are NOT included and billed separately.
                </p>
                {pending.interval === "annual" && (
                  <p>
                    <strong className="text-foreground">Annual billing</strong> is non-refundable
                    after the cooling-off period. You may cancel renewal anytime from the billing
                    portal; access continues until the period end.
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2 cursor-pointer select-none rounded-md border p-3 hover:bg-muted/40">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  I have read and understood the plan limits, the AI credit policy, and that
                  consulting / training / custom work are billed separately. I will not raise a
                  refund claim citing lack of disclosure of these limitations.
                </span>
              </label>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            {currency === "inr" && UPI_CONFIG.enabled && (
              <Button variant="secondary" onClick={startUpiPayment} disabled={!acknowledged}>
                Pay via UPI
              </Button>
            )}
            {currency === "inr" && pending ? (
              <RazorpaySubscriptionButton
                priceId={pending.priceId}
                label="Pay with Razorpay"
                disabled={!acknowledged}
                onStarted={() => setPending(null)}
              />
            ) : (
              <Button onClick={confirmCheckout} disabled={!acknowledged}>
                Pay with Stripe
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!upiPayment} onOpenChange={(o) => !o && setUpiPayment(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pay via UPI</DialogTitle>
            <DialogDescription>
              {upiPayment?.plan.name} - {upiPayment?.priceDisplay}
            </DialogDescription>
          </DialogHeader>
          {upiPayment && (
            <UpiPaymentPanel
              amountInCents={upiPayment.amount}
              currency="inr"
              planName={upiPayment.plan.name}
            />
          )}
        </DialogContent>
      </Dialog>

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






