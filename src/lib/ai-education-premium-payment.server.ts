import { createHmac, timingSafeEqual } from "node:crypto";

export async function premiumRazorpay(path: string, body?: unknown) {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new Error("PREMIUM_PAYMENTS_UNAVAILABLE");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    console.error("[premium-payment]", {
      category: "provider_unavailable",
      status: response.status,
    });
    throw new Error("PREMIUM_PAYMENTS_UNAVAILABLE");
  }
  return response.json();
}

export function verifyPremiumCheckout(
  orderId: string,
  paymentId: string,
  signature: string,
  secret = process.env.RAZORPAY_KEY_SECRET,
) {
  if (!secret || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

/** Validated against our immutable quote AND the provider's order and captured payment. */
export function assertPremiumPayment(subscription: any, payment: any, order: any) {
  if (
    payment.status !== "captured" ||
    payment.captured !== true ||
    payment.amount_refunded > 0 ||
    payment.order_id !== subscription.provider_order_id ||
    order.id !== subscription.provider_order_id ||
    payment.amount !== subscription.final_amount_minor ||
    order.amount !== subscription.final_amount_minor ||
    String(payment.currency).toLowerCase() !== subscription.currency ||
    String(order.currency).toLowerCase() !== subscription.currency ||
    order.notes?.premiumSubscriptionId !== subscription.id ||
    order.notes?.product !== "ai_education_premium"
  ) {
    throw new Error("PREMIUM_PAYMENT_UNCONFIRMED");
  }
}

export async function settlePremiumPayment(
  admin: any,
  subscription: any,
  paymentId: string,
  gateway = premiumRazorpay,
) {
  const [payment, order] = await Promise.all([
    gateway(`/payments/${encodeURIComponent(paymentId)}`),
    gateway(`/orders/${encodeURIComponent(subscription.provider_order_id)}`),
  ]);
  assertPremiumPayment(subscription, payment, order);
  const { error } = await admin.rpc("premium_settle_payment", {
    p_order: order.id,
    p_payment: payment.id,
    p_amount: payment.amount,
    p_currency: payment.currency,
    p_invoice: payment.invoice_id ?? null,
  });
  if (error) throw new Error("PREMIUM_PAYMENT_SYNC_PENDING");
}

/** Called only after the shared route verifies the raw-body Razorpay signature. */
export async function handlePremiumPaymentEvent(
  event: any,
  admin: any,
  gateway = premiumRazorpay,
): Promise<boolean> {
  const entity = event?.payload?.payment?.entity;
  if (!entity?.order_id) return false;
  const { data: subscription, error } = await admin
    .from("ai_education_premium_subscriptions")
    .select("*")
    .eq("provider_order_id", entity.order_id)
    .maybeSingle();
  if (error) throw new Error("PREMIUM_PAYMENT_SYNC_PENDING");
  if (!subscription) return false;
  if (["payment.captured", "order.paid"].includes(event.event)) {
    await settlePremiumPayment(admin, subscription, entity.id, gateway);
  } else if (event.event === "payment.refunded") {
    // Full or partial refunds revoke this paid term; never touch other products or terms.
    const payment = await gateway(`/payments/${encodeURIComponent(entity.id)}`);
    if (payment.order_id !== subscription.provider_order_id || !(payment.amount_refunded > 0))
      throw new Error("PREMIUM_REFUND_UNCONFIRMED");
    const { error: refundError } = await admin.rpc("premium_revoke_refund", {
      p_subscription: subscription.id,
      p_payment: payment.id,
    });
    if (refundError) throw new Error("PREMIUM_PAYMENT_SYNC_PENDING");
  }
  // A failed attempt never activates, revokes existing paid coverage, or overwrites a captured receipt.
  return true;
}
