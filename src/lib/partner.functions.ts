import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function randomCode(): string {
  // 8-char A-Z0-9 (no 0/O/1/I confusables)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const getMyPartner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("referral_partners")
      .select("id, code, display_name, status, payout_email, payout_method, terms_accepted_at, nda_accepted_at, created_at, is_house")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const becomePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    displayName: string;
    payoutEmail?: string;
    acceptTerms: boolean;
    acceptNda: boolean;
  }) => {
    if (!data.acceptTerms || !data.acceptNda) {
      throw new Error("You must accept both the terms and the NDA to enrol.");
    }
    if (!data.displayName || data.displayName.trim().length < 2) {
      throw new Error("Display name is required.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("referral_partners")
      .select("id, code")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) return existing;

    // Generate a unique code (retry on collision).
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { data: row, error } = await supabaseAdmin
        .from("referral_partners")
        .insert({
          user_id: userId,
          code,
          display_name: data.displayName.trim(),
          payout_email: data.payoutEmail?.trim() || null,
          payout_method: "manual_bank_transfer",
          status: "active",
          is_house: false,
          terms_accepted_at: new Date().toISOString(),
          nda_accepted_at: new Date().toISOString(),
        })
        .select("id, code")
        .single();
      if (!error && row) return row;
      if (error?.code === "23505" && error.message.toLowerCase().includes("user_id")) {
        const { data: existingAfterRace } = await supabaseAdmin
          .from("referral_partners")
          .select("id, code")
          .eq("user_id", userId)
          .maybeSingle();
        if (existingAfterRace) return existingAfterRace;
      }
      if (error && error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("Could not generate a unique referral code. Please try again.");
  });

export const getMyPartnerStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from("referral_partners")
      .select("id, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (partnerError) throw new Error(partnerError.message);
    if (!partner) {
      return { hasPartner: false as const };
    }

    const { data: comms, error: commsError } = await supabaseAdmin
      .from("referral_commissions")
      .select("commission_cents, currency, status")
      .eq("partner_id", partner.id);
    if (commsError) throw new Error(commsError.message);

    const totals = {
      lifetimeAccruedCents: 0,
      lifetimePaidCents: 0,
      pendingPayoutCents: 0,
      forfeitedCents: 0,
      reversedCents: 0,
      currency: "usd",
    };
    for (const c of (comms ?? []) as Array<{ commission_cents: number; currency: string; status: string }>) {
      totals.currency = c.currency || totals.currency;
      if (c.status === "accrued" || c.status === "approved") {
        totals.lifetimeAccruedCents += c.commission_cents;
        totals.pendingPayoutCents += c.commission_cents;
      } else if (c.status === "paid") {
        totals.lifetimeAccruedCents += c.commission_cents;
        totals.lifetimePaidCents += c.commission_cents;
      } else if (c.status === "forfeited") {
        totals.forfeitedCents += c.commission_cents;
      } else if (c.status === "reversed") {
        totals.reversedCents += c.commission_cents;
      }
    }

    const { data: attributions, error: attributionsError } = await supabaseAdmin
      .from("referral_attributions")
      .select("org_id, attributed_at, is_house_fallback")
      .eq("partner_id", partner.id);
    if (attributionsError) throw new Error(attributionsError.message);

    return {
      hasPartner: true as const,
      partner: { status: partner.status },
      totals,
      payingOrgs: (attributions ?? []).length,
      attributions: attributions ?? [],
    };
  });

export const getMyCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: partner, error: partnerError } = await supabaseAdmin
      .from("referral_partners")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (partnerError) throw new Error(partnerError.message);
    if (!partner) return [];
    const { data, error } = await supabaseAdmin
      .from("referral_commissions")
      .select("id, org_id, commission_cents, currency, status, accrued_at, paid_at")
      .eq("partner_id", partner.id)
      .order("accrued_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
