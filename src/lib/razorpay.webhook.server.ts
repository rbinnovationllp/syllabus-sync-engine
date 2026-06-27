import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

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
      status: subscription.status ?? "created",
      current_period_start: subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : null,
      current_period_end: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null,
      cancel_at_period_end: ["cancelled", "completed"].includes(subscription.status),
      environment: process.env.RAZORPAY_ENV ?? "live",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "razorpay_subscription_id" },
  );
}
