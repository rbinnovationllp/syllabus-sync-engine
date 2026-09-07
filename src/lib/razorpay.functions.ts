import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADD_ONS, PLANS, tierForPriceId } from "@/lib/plans";

type RazorpaySubResult =
  | { ok: true; keyId: string; mode: "subscription"; subscriptionId: string; planName: string; priceId: string }
  | { ok: true; keyId: string; mode: "order"; orderId: string; planName: string; priceId: string; amount: number; currency: string }
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
    if (price) return { item: plan, price, kind: "plan" as const, recurring: true };
  }
  for (const addOn of ADD_ONS) {
    const price = addOn.prices.find((p) => p.priceId === priceId);
    if (price) return { item: addOn, price, kind: "addon" as const, recurring: addOn.recurring };
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

      const userId = context?.userId;
      if (!userId) throw new Error("Authentication context is missing.");
      const notes = {
        userId,
        priceId: data.priceId,
        tierId: tierForPriceId(data.priceId) ?? "",
        pricingVersion:"2026-09-gst-inclusive",
        planName: found.item.name,
        itemKind: found.kind,
      };

      if (!found.recurring) {
        const order = await razorpay("/orders", {
          method: "POST",
          body: JSON.stringify({
            amount: found.price.amount,
            currency: found.price.currency.toUpperCase(),
            receipt: `${data.priceId}_${Date.now()}`.slice(0, 40),
            notes,
          }),
        });

        return {
          ok: true,
          keyId: env("RAZORPAY_KEY_ID"),
          mode: "order",
          orderId: order.id,
          planName: found.item.name,
          priceId: data.priceId,
          amount: found.price.amount,
          currency: found.price.currency,
        };
      }

      const map = planMap();
      const razorpayPlanId = map[data.priceId];
      if (!razorpayPlanId) {
        throw new Error(`Razorpay plan id missing for ${data.priceId}. Add it to RAZORPAY_PLAN_MAP_JSON.`);
      }

      const providerPlan=await razorpay('/plans/'+encodeURIComponent(razorpayPlanId));
      if(providerPlan.item?.amount!==found.price.amount || String(providerPlan.item?.currency).toLowerCase()!==found.price.currency
        || providerPlan.period!==(found.price.interval==='annual'?'yearly':'monthly') || providerPlan.interval!==1) throw new Error("Payment pricing is being updated. Please contact support.");
      const subscription = await razorpay("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          plan_id: razorpayPlanId,
          total_count: found.price.interval === "annual" ? 10 : 120,
          quantity: 1,
          customer_notify: 1,
          notes,
        }),
      });

      const supabase = getSupabaseAdmin() as any;
      if (found.kind === "plan") {
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
      }

      return {
        ok: true,
        keyId: env("RAZORPAY_KEY_ID"),
        mode: "subscription",
        subscriptionId: subscription.id,
        planName: found.item.name,
        priceId: data.priceId,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Razorpay subscription failed" };
    }
  });


