/**
 * Server-side subscription guard for AI generation and export endpoints.
 * Wrap any server function that costs AI credits or produces a downloadable
 * artifact so unpaid users can't extract value from the demo.
 *
 * Usage inside a createServerFn handler:
 *
 *   const gate = await requireActiveSubscription(context.supabase, context.userId);
 *   if (!gate.ok) return { error: "PAID_PLAN_REQUIRED" as const };
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionGate = { ok: true } | { ok: false; reason: "no_subscription" };

export async function requireActiveSubscription(
  supabase: SupabaseClient,
  userId: string,
  env: "sandbox" | "live" = "live",
): Promise<SubscriptionGate> {
  const { data, error } = await supabase.rpc("has_active_subscription", {
    user_uuid: userId,
    check_env: env,
  });
  if (error) return { ok: false, reason: "no_subscription" };
  return data === true ? { ok: true } : { ok: false, reason: "no_subscription" };
}

/** Use in pre-paid PDF/DOCX generation to stamp every page when caller is unpaid. */
export const DEMO_WATERMARK_TEXT = "DEMO — Not Licensed for Production Use";
