import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CODE_RE = /^[A-Z0-9]{4,16}$/;

/**
 * Stamp the signed-in user's profile with the referring partner.
 * - Validates code shape
 * - Resolves the partner; refuses self-referral and inactive/terminated partners
 * - No-op if the user already has a referrer
 * Returns { claimed: boolean, partnerCode?: string, reason?: string }.
 */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    if (!input || typeof input.code !== "string") {
      throw new Error("code is required");
    }
    return { code: input.code.trim().toUpperCase() };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!CODE_RE.test(data.code)) {
      return { claimed: false, reason: "invalid_code" as const };
    }

    // Already attributed? Don't overwrite.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, referred_by_partner_id")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.referred_by_partner_id) {
      return { claimed: false, reason: "already_attributed" as const };
    }

    // Resolve partner. We only honour active/paused/under_review partners
    // for new attributions — suspended/terminated codes are silently dropped.
    const { data: partner } = await supabase
      .from("referral_partners")
      .select("id, user_id, status, code, is_house")
      .eq("code", data.code)
      .maybeSingle();

    if (!partner) {
      return { claimed: false, reason: "unknown_code" as const };
    }
    if (partner.user_id === userId) {
      return { claimed: false, reason: "self_referral" as const };
    }
    if (partner.status === "suspended" || partner.status === "terminated") {
      return { claimed: false, reason: "partner_inactive" as const };
    }

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ referred_by_partner_id: partner.id })
      .eq("id", userId);

    if (updErr) {
      return { claimed: false, reason: "update_failed" as const };
    }

    return { claimed: true, partnerCode: partner.code };
  });
