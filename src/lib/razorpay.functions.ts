import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, tierForPriceId } from "@/lib/plans";
import { createHmac, timingSafeEqual } from "node:crypto";

type RazorpaySubResult =
  | { ok: true; keyId: string; subscriptionId: string; planName: string; priceId: string }
  | { ok: false; error: string };

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function authHeader() {
  const token = Buffer.from(`${env("RAZORPAY_KEY_ID")}:${env("RAZORPAY_KEY_SECRET")}`).toString("base64");
  return `Basic ${token}`;
}

function planMap(): Record<string, string> {
  const raw = process.env.RAZORPAY_PLAN_MAP_JSON ?? "{}";
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("RAZORPAY_PLAN_MAP_JSON is not valid JSON");
  }
}

function findPrice(priceId: string) {
  for (const plan of PLANS) {
    const price = plan.prices.find((p) => p.priceId === priceId);
    if (price) return { plan, price };
  }
  return null;
}

async function razorpay(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ...(init.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error?.description ?? json?.error?.reason ?? `Razorpay request failed (${res.status})`;
    throw new Error(message);
  }
  return json;
}

function getSupabaseAdmin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export const createRazorpaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { priceId: string }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<RazorpaySubResult> => {
    try {
      const found = findPrice(data.priceId);
      if (!found) throw new Error("Plan price not found");
      if (found.price.currency !== "inr") throw new Error("Razorpay is enabled only for INR plans");

      const map = planMap();
      const razorpayPlanId = map[data.priceId];
      if (!razorpayPlanId) {
        throw new Error(`Razorpay plan id missing for ${data.priceId}. Add it to RAZORPAY_PLAN_MAP_JSON.`);
      }

      const userId = context.userId;
      const email = (context.claims as { email?: string } | undefined)?.email ?? "";
      const notes = {
        userId,
        priceId: data.priceId,
        tierId: tierForPriceId(data.priceId) ?? "",
        planName: found.plan.name,
      };

      const subscription = await razorpay("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          plan_id: razorpayPlanId,
          total_count: found.price.interval === "annual" ? 1 : 120,
          quantity: 1,
          customer_notify: 1,
          notes,
        }),
      });

      const supabase = getSupabaseAdmin() as any;
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          provider: "razorpay",
          razorpay_subscription_id: subscription.id,
          razorpay_plan_id: razorpayPlanId,
          razorpay_short_url: subscription.short_url ?? null,
          stripe_subscription_id: null,
          stripe_customer_id: null,
          product_id: razorpayPlanId,
          price_id: data.priceId,
          status: subscription.status ?? "created",
          current_period_start: subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : null,
          current_period_end: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null,
          cancel_at_period_end: false,
          environment: process.env.RAZORPAY_ENV ?? "live",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "razorpay_subscription_id" },
      );

      return {
        ok: true,
        keyId: env("RAZORPAY_KEY_ID"),
        subscriptionId: subscription.id,
        planName: found.plan.name,
        priceId: data.priceId,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Razorpay subscription failed" };
    }
  });

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
