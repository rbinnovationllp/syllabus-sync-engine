import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  formatMoney,
  priceBreakdown,
  type AiEducationPremiumPackage,
} from "@/lib/ai-education-premium";

export function PremiumPricing({
  packages,
  canManage,
  onCheckout,
  busy = false,
}: {
  packages: AiEducationPremiumPackage[];
  canManage: boolean;
  onCheckout: (code: string, interval: "monthly" | "annual") => void;
  busy?: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [interval, setInterval] = useState<"monthly" | "annual">("annual");
  const item = packages.find((p) => p.code === selected);
  const amount = item ? priceBreakdown(item, interval) : null;
  return (
    <section className="space-y-6" aria-label="AI Education Premium pricing">
      <div className="max-w-3xl space-y-3">
        <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
          Independent school subscription
        </span>
        <h1 className="text-3xl font-bold sm:text-4xl">AI Education Premium</h1>
        <p className="text-xl">AI Curriculum + Teacher Guidance · Pre-K/K1 through Grade 12</p>
        <p className="text-muted-foreground">
          Give your teachers a structured AI teaching roadmap — class by class, lesson by lesson,
          with guidance on what to teach, when to teach and how to teach.
        </p>
        <p>
          Classes 1–12 have approved group plans below. Pre-K/K1 programme scope and pricing:
          Contact Us. Choose the classes your school wants to cover. You can buy AI Education
          Premium on its own or alongside Syllabus Planning.
        </p>
      </div>
      <a
        className="inline-block text-primary underline"
        href="mailto:support@syllabus-synk.in?subject=Pre-K%20AI%20Education%20Premium"
      >
        Contact Us about Pre-K/K1 coverage
      </a>
      <p className="rounded-lg border bg-muted/30 p-3 text-sm font-medium">
        Price shown is for the complete group of classes covered.
      </p>
      {(
        [
          ["group", "Group plans"],
          ["school", "Larger school coverage"],
        ] as const
      ).map(([kind, title]) => (
        <div key={kind} className="space-y-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packages
              .filter((p) => p.groupKind === kind)
              .map((p) => (
                <button
                  type="button"
                  key={p.code}
                  aria-pressed={selected === p.code}
                  onClick={() => setSelected(p.code)}
                  className={`min-w-0 rounded-xl border p-5 text-left transition-colors ${selected === p.code ? "border-primary ring-2 ring-primary" : "hover:border-primary/50"} ${p.featured ? "bg-primary/5" : ""}`}
                >
                  {p.featured && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      Complete School AI Education
                    </p>
                  )}
                  <h3 className="font-semibold">
                    {p.label.replace("Complete School AI Education · ", "")}
                  </h3>
                  <p className="mt-3 text-lg font-bold">
                    {formatMoney(p.monthlyInr, p.currency)}
                    <span className="text-sm font-normal">/month</span>
                  </p>
                  <p className="mt-1 text-lg font-bold">
                    {formatMoney(p.annualInr, p.currency)}
                    <span className="text-sm font-normal">/year</span>
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {p.gstInclusive ? `Inclusive of GST (${p.gstRate}%)` : `Plus ${p.gstRate}% GST`}
                  </p>
                </button>
              ))}
          </div>
        </div>
      ))}
      {!packages.length && (
        <p role="status">No packages are currently available. Please contact support.</p>
      )}
      <div className="rounded-xl border p-5 space-y-4">
        <h2 className="text-xl font-semibold">Your subscription</h2>
        <p>
          {item
            ? `${item.label} · Classes ${item.grades.join(", ")}`
            : "Select a group above to see your total."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={interval === "monthly" ? "default" : "outline"}
            aria-pressed={interval === "monthly"}
            onClick={() => setInterval("monthly")}
          >
            Monthly
          </Button>
          <Button
            variant={interval === "annual" ? "default" : "outline"}
            aria-pressed={interval === "annual"}
            onClick={() => setInterval("annual")}
          >
            Annual
          </Button>
        </div>
        {item && amount && (
          <dl className="max-w-md space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Subscription before GST</dt>
              <dd>{formatMoney(amount.base / 100, item.currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>GST ({item.gstRate}%)</dt>
              <dd>{formatMoney(amount.tax / 100, item.currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t pt-2 text-lg font-bold">
              <dt>
                Inclusive of GST — total for {interval === "annual" ? "one year" : "one month"}
              </dt>
              <dd>{formatMoney(amount.total / 100, item.currency)}</dd>
            </div>
          </dl>
        )}
        <p className="text-sm text-muted-foreground">
          Pay for one term at a time. No automatic renewal or automatic debit. Renewals and changes
          from monthly to annual coverage start after your existing paid term ends. Cancellation
          leaves access available until the paid term ends.
        </p>
        {!canManage && <p className="text-sm">Your School Admin can purchase or renew coverage.</p>}
        <Button
          className="w-full sm:w-auto"
          disabled={!item || !canManage || busy || item.currency !== "inr"}
          onClick={() => item && onCheckout(item.code, interval)}
        >
          {busy ? "Opening secure checkout…" : "Continue to secure payment"}
        </Button>
        {item && item.currency !== "inr" && (
          <p className="text-sm">
            Online checkout currently supports INR. Please contact support for this currency.
          </p>
        )}
      </div>
    </section>
  );
}
