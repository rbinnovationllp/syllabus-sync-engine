import { purchasablePrice } from "@/lib/plans";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string; returnUrl: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    if (!["sandbox", "live"].includes(data.environment))
      throw new Error("Invalid payment environment");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const configured = purchasablePrice(data.priceId);
      if (!configured) throw new Error("This plan is unavailable for new purchases or renewals.");
      const stripe = createStripeClient(data.environment);
      const userId = context.userId;
      const email = (context.claims as { email?: string } | undefined)?.email;

      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const expectedInterval = configured.price.interval === "annual" ? "year" : "month";
      if (
        !stripePrice.active ||
        stripePrice.unit_amount !== configured.price.amount ||
        stripePrice.currency !== configured.price.currency ||
        (configured.recurring
          ? stripePrice.recurring?.interval !== expectedInterval ||
            stripePrice.recurring?.interval_count !== 1
          : !!stripePrice.recurring)
      )
        throw new Error("Payment pricing is being updated. Please contact support.");
      let gstRate: string | undefined;
      if (configured.price.currency === "inr") {
        gstRate = process.env.STRIPE_INR_GST_TAX_RATE_ID;
        if (!gstRate)
          throw new Error(
            "Indian tax invoicing is being configured. Please use Razorpay or contact support.",
          );
        const tax = await stripe.taxRates.retrieve(gstRate);
        if (!tax.active || !tax.inclusive || tax.percentage !== 18)
          throw new Error("Indian tax invoicing configuration is invalid.");
      }

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price: stripePrice.id,
            quantity: 1,
            ...(!configured.recurring && gstRate ? { tax_rates: [gstRate] } : {}),
          },
        ],
        mode: configured.recurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { userId, priceId: data.priceId, pricingVersion: "2026-09-gst-inclusive" },
        ...(configured.recurring
          ? {
              subscription_data: {
                metadata: {
                  userId,
                  priceId: data.priceId,
                  pricingVersion: "2026-09-gst-inclusive",
                },
                ...(gstRate ? { default_tax_rates: [gstRate] } : {}),
              },
            }
          : {}),
        ...(configured.price.currency === "inr"
          ? { automatic_tax: { enabled: false } }
          : { managed_payments: { enabled: true } }),
      } as unknown as Parameters<typeof stripe.checkout.sessions.create>[0]);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { supabase, userId } = context;
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id,price_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError || !sub?.stripe_customer_id) throw new Error("No subscription found");
    if (!purchasablePrice(sub.price_id ?? ""))
      throw new Error(
        "This legacy plan requires an assisted transition. Contact support; current paid access is preserved.",
      );

    // Validate returnUrl against same-origin allowlist to prevent open redirect
    let safeReturnUrl: string | undefined;
    if (data.returnUrl) {
      try {
        const parsed = new URL(data.returnUrl);
        const allowed = new Set<string>([
          ...(process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : []),
        ]);
        const host = parsed.hostname;
        if (
          allowed.has(parsed.origin) ||
          host === "syllabus-synk.in" ||
          host.endsWith(".syllabus-synk.in") ||
          host.endsWith(".lovable.app") ||
          host.endsWith(".lovableproject.com") ||
          host === "localhost"
        ) {
          safeReturnUrl = parsed.toString();
        }
      } catch {
        // ignore invalid URL
      }
    }

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(safeReturnUrl && { return_url: safeReturnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const getMyBillingReceipts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await (context.supabase as any)
      .from("billing_receipts")
      .select(
        "id,provider,provider_payment_id,price_id,currency,taxable_amount_minor,gst_amount_minor,total_amount_minor,created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (result.error) throw new Error("Payment receipts are temporarily unavailable.");
    return result.data;
  });
