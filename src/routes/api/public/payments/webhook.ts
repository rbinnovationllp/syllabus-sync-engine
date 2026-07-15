import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook, createStripeClient } from "@/lib/stripe.server";
import { creditsForAddOnPrice, storageGbForAddOnPrice } from "@/lib/plans";
import {
  accrueCommission,
  ensureAttribution,
  reverseCommissionForCharge,
  reverseCommissionForInvoice,
} from "@/lib/referral-webhook.server";
import { handleAutomaticStorageAllocation } from "@/lib/storage-allocation.server";


let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase as any;
}

function resolvePriceId(item: any): string | undefined {
  return item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
}

async function resolveUserOrgId(userId: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}

async function upsertStorageAddonSubscription(args: {
  userId: string;
  subscriptionId: string;
  priceId: string;
  storageGb: number;
  status: string;
  currentPeriodEnd: number | null | undefined;
  paymentVerified?: boolean;
  paymentReference?: string | null;
  providerPaymentId?: string | null;
  transactionAmountMinor?: number | null;
  currency?: string | null;
}) {
  await handleAutomaticStorageAllocation({
    provider: "stripe",
    userId: args.userId,
    orgId: await resolveUserOrgId(args.userId),
    priceId: args.priceId,
    storageGb: args.storageGb,
    status: args.status,
    paymentVerified: Boolean(args.paymentVerified),
    providerSubscriptionId: args.subscriptionId,
    providerPaymentId: args.providerPaymentId,
    paymentReference: args.paymentReference ?? args.subscriptionId,
    transactionAmountMinor: args.transactionAmountMinor ?? null,
    currency: args.currency ?? null,
    currentPeriodEnd: args.currentPeriodEnd ? new Date(args.currentPeriodEnd * 1000).toISOString() : null,
    metadata: { source: "stripe_webhook", priceId: args.priceId },
  });
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) { console.error("No userId in subscription metadata"); return; }
  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const priceId = resolvePriceId(item);
  const storageGb = storageGbForAddOnPrice(priceId);
  if (priceId && storageGb) {
    await upsertStorageAddonSubscription({
      userId,
      subscriptionId: subscription.id,
      priceId,
      storageGb,
      status: "pending_payment",
      currentPeriodEnd: periodEnd,
      paymentVerified: false,
    });
    return;
  }

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: item?.price?.product,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  // Referral: lock attribution at subscription creation (house fallback if no referrer).
  await ensureAttribution({ userId });
}

async function handleInvoicePaymentSucceeded(invoice: any, env: StripeEnv) {
  // Resolve the userId from the subscription metadata first, then customer.
  let userId: string | undefined = invoice.subscription_details?.metadata?.userId;
  if (!userId && invoice.subscription) {
    try {
      const stripe = createStripeClient(env);
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      userId = sub.metadata?.userId;
    } catch (e) { console.error("[referral] subscription lookup failed", e); }
  }
  if (!userId && invoice.customer) {
    try {
      const stripe = createStripeClient(env);
      const cust = await stripe.customers.retrieve(invoice.customer as string);
      if (cust && !(cust as any).deleted) userId = (cust as any).metadata?.userId;
    } catch (e) { console.error("[referral] customer lookup failed", e); }
  }
  if (!userId) return; // not a user-linked invoice

  const amount = invoice.amount_paid ?? 0;
  const currency = invoice.currency ?? "usd";
  const charge = typeof invoice.charge === "string" ? invoice.charge : invoice.charge?.id ?? null;
  for (const line of invoice.lines?.data ?? []) {
    const priceId = resolvePriceId(line);
    const storageGb = storageGbForAddOnPrice(priceId);
    if (!priceId || !storageGb) continue;
    await upsertStorageAddonSubscription({
      userId,
      subscriptionId: String(line.subscription ?? invoice.subscription ?? invoice.id),
      priceId,
      storageGb: storageGb * Number(line.quantity ?? 1),
      status: "active",
      currentPeriodEnd: line.period?.end ?? null,
      paymentVerified: true,
      paymentReference: invoice.id,
      providerPaymentId: charge,
      transactionAmountMinor: Number(line.amount ?? amount ?? 0),
      currency,
    });
  }
  await accrueCommission({
    userId,
    invoiceId: invoice.id,
    chargeId: charge,
    grossAmountCents: amount,
    currency,
    env,
  });
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const priceId = resolvePriceId(item);
  const storageGb = storageGbForAddOnPrice(priceId);
  const userId = subscription.metadata?.userId;
  if (userId && priceId && storageGb) {
    await upsertStorageAddonSubscription({
      userId,
      subscriptionId: subscription.id,
      priceId,
      storageGb,
      status: subscription.status === "canceled" ? "canceled" : "pending_payment",
      currentPeriodEnd: periodEnd,
      paymentVerified: false,
    });
    return;
  }
  await getSupabase()
    .from("subscriptions")
    .update({
      status: subscription.status,
      product_id: item?.price?.product,
      price_id: priceId,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const { data: storageAddon } = await getSupabase()
    .from("organization_storage_addons")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (storageAddon?.id) {
    await getSupabase()
      .from("organization_storage_addons")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("id", storageAddon.id);
    return;
  }

  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  // One-time and recurring add-on purchases
  if (session.mode !== "payment") return;
  const userId = session.metadata?.userId;
  if (!userId) return;

  // Look up line items to find which credit pack was bought
  const stripe = createStripeClient(env);
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  for (const li of lineItems.data) {
    const priceId = (li.price as any)?.lookup_key
      || (li.price as any)?.metadata?.lovable_external_id
      || li.price?.id;
    const credits = creditsForAddOnPrice(priceId);
    const qty = li.quantity ?? 1;
    if (credits) {
      const total = credits * qty;
      await getSupabase().from("ai_credit_grants").upsert(
        {
          user_id: userId,
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent ?? null,
          credits_granted: total,
          credits_remaining: total,
          environment: env,
        },
        { onConflict: "stripe_session_id" },
      );
    }

    const storageGb = storageGbForAddOnPrice(priceId);
    if (storageGb) console.warn("Storage add-on checkout completed in payment mode; expected subscription mode.", { priceId, storageGb, qty });
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, env); break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env); break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env); break;
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env); break;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object, env); break;
    case "invoice.voided":
    case "invoice.marked_uncollectible":
      await reverseCommissionForInvoice((event.data.object as any).id); break;
    case "charge.refunded": {
      const obj = event.data.object as any;
      if (obj?.id) await reverseCommissionForCharge(obj.id);
      break;
    }
    default:
      console.log("Unhandled event:", event.type);
  }
}


export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
