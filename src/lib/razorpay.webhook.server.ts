import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { creditsForAddOnPrice, storageGbForAddOnPrice } from "@/lib/plans";
import { handleAutomaticStorageAllocation } from "@/lib/storage-allocation.server";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getSupabaseAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export function verifyRazorpaySignature(body: string, signature: string | null, secret = env("RAZORPAY_WEBHOOK_SECRET")) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function upsertRazorpaySubscriptionFromEvent(event: any) {
  const subscription = event?.payload?.subscription?.entity;
  if (!subscription?.id) return;
  const notes = subscription.notes ?? {};
  const userId = notes.userId;
  const priceId = notes.priceId;
  if (!userId || !priceId) return;

  const supabase = getSupabaseAdmin() as any;
  const status = subscription.status ?? "created";
  const storageGb = storageGbForAddOnPrice(priceId);
  if (storageGb) {
    await handleAutomaticStorageAllocation({
      provider: "razorpay",
      userId,
      priceId,
      storageGb,
      status: event?.event === "subscription.charged" ? "active" : status,
      paymentVerified: event?.event === "subscription.charged",
      providerSubscriptionId: subscription.id,
      paymentReference: subscription.id,
      transactionAmountMinor: null,
      currency: "inr",
      currentPeriodEnd: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null,
      metadata: { source: "razorpay_subscription_webhook", event: event?.event, planId: subscription.plan_id ?? null },
    });
    return;
  }
  const isPending = status === "pending";
  const isPaymentBlocked = ["halted", "cancelled"].includes(status);
  const graceUntil = isPending ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      provider: "razorpay",
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: subscription.plan_id ?? null,
      razorpay_customer_id: subscription.customer_id ?? null,
      razorpay_short_url: subscription.short_url ?? null,
      stripe_subscription_id: null,
      stripe_customer_id: null,
      product_id: subscription.plan_id ?? null,
      price_id: priceId,
      status,
      current_period_start: subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : null,
      current_period_end: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null,
      cancel_at_period_end: ["cancelled", "completed"].includes(status),
      grace_until: isPending ? graceUntil : null,
      last_payment_failed_at: isPaymentBlocked ? new Date().toISOString() : null,
      environment: process.env.RAZORPAY_ENV ?? "live",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "razorpay_subscription_id" },
  );
}

export async function updateRazorpayPaymentFromEvent(event: any) {
  const payment = event?.payload?.payment?.entity;
  if (!payment?.id) return;

  const subscriptionId = payment.subscription_id;

  const supabase = getSupabaseAdmin() as any;
  const status = event?.event === "payment.failed" ? "pending" : "active";
  const failure = payment.error_description ?? payment.error_reason ?? payment.error_code ?? null;
  if (!subscriptionId) {
    const priceId = payment.notes?.priceId ?? null;
    const userId = payment.notes?.userId ?? null;
    const credits = creditsForAddOnPrice(priceId);
    if (event?.event === "payment.captured" && userId && credits) {
      await supabase.from("ai_credit_grants").upsert(
        {
          user_id: userId,
          stripe_session_id: `razorpay:${payment.id}`,
          stripe_payment_intent_id: payment.id,
          credits_granted: credits,
          credits_remaining: credits,
          environment: process.env.RAZORPAY_ENV ?? "live",
        },
        { onConflict: "stripe_session_id" },
      );
    }
    return;
  }
  const { data: storageAddon } = await supabase
    .from("organization_storage_addons")
    .select("user_id, storage_gb, stripe_price_id")
    .eq("razorpay_subscription_id", subscriptionId)
    .maybeSingle();

  const fallbackPriceId = payment.notes?.priceId ?? null;
  const fallbackStorageGb = storageGbForAddOnPrice(fallbackPriceId);
  const fallbackUserId = payment.notes?.userId ?? null;

  if ((storageAddon?.user_id && storageAddon?.storage_gb) || (fallbackUserId && fallbackStorageGb)) {
    await handleAutomaticStorageAllocation({
      provider: "razorpay",
      userId: storageAddon?.user_id ?? fallbackUserId,
      priceId: storageAddon?.stripe_price_id ?? fallbackPriceId,
      storageGb: Number(storageAddon?.storage_gb ?? fallbackStorageGb),
      status,
      paymentVerified: event?.event !== "payment.failed",
      providerSubscriptionId: subscriptionId,
      providerPaymentId: payment.id,
      paymentReference: payment.id,
      transactionAmountMinor: Number(payment.amount ?? 0),
      currency: payment.currency ?? "inr",
      currentPeriodEnd: null,
      metadata: { source: "razorpay_payment_webhook", event: event?.event, failure },
    });
    return;
  }

  await supabase
    .from("subscriptions")
    .update({
      provider: "razorpay",
      razorpay_subscription_id: subscriptionId,
      razorpay_payment_id: payment.id,
      razorpay_customer_id: payment.customer_id ?? null,
      status,
      grace_until: event?.event === "payment.failed" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      last_payment_failed_at: event?.event === "payment.failed" ? new Date().toISOString() : null,
      last_payment_failure_reason: event?.event === "payment.failed" ? failure : null,
      environment: process.env.RAZORPAY_ENV ?? "live",
      updated_at: new Date().toISOString(),
    })
    .eq("razorpay_subscription_id", subscriptionId);
}

export async function updateRazorpayRefundFromEvent(event: any) {
  const refund = event?.payload?.refund?.entity;
  const payment = event?.payload?.payment?.entity;
  const paymentId = refund?.payment_id ?? payment?.id;
  if (!paymentId) return;

  const supabase = getSupabaseAdmin() as any;
  const now = new Date().toISOString();

  const { data: addon } = await supabase
    .from("organization_storage_addons")
    .select("org_id, user_id, storage_gb, payment_reference, razorpay_subscription_id")
    .eq("razorpay_payment_id", paymentId)
    .maybeSingle();

  if (addon?.org_id) {
    await supabase
      .from("organization_storage_addons")
      .update({
        status: "refunded",
        allocation_status: "cancelled",
        allocation_error: "Payment was refunded through Razorpay.",
        updated_at: now,
      })
      .eq("razorpay_payment_id", paymentId);

    await supabase.from("organization_storage_allocation_events").insert({
      org_id: addon.org_id,
      user_id: addon.user_id,
      provider: "razorpay",
      storage_provider: "aws_s3",
      storage_purchased_gb: Number(addon.storage_gb ?? 0),
      payment_status: "refunded",
      payment_reference: addon.payment_reference ?? paymentId,
      provider_subscription_id: addon.razorpay_subscription_id ?? null,
      provider_payment_id: paymentId,
      system_action_status: "cancelled",
      failure_reason: "Payment was refunded through Razorpay.",
      metadata: { source: "razorpay_refund_webhook", event: event?.event, refundId: refund?.id ?? null },
    });
  }

  await supabase
    .from("subscriptions")
    .update({
      status: "refunded",
      updated_at: now,
    })
    .eq("razorpay_payment_id", paymentId);
}
