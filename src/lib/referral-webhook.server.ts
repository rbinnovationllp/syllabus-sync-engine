// Server-only helpers used by the Stripe webhook to attribute referrals
// and accrue / reverse partner commissions.
// MUST be imported only from server route handlers — never from client modules.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type StripeEnv } from "@/lib/stripe.server";

const HOUSE_PARTNER_CODE = "HOUSE";
const DEFAULT_COMMISSION_RATE = 0.10;

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _admin;
}

/** Resolve the org_id this user owns (organizations.owner_id = user_id). */
async function ownerOrgId(userId: string): Promise<string | null> {
  const { data } = await admin()
    .from("organizations")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Get partner status for accrual decisions. */
type PartnerLite = { id: string; status: string; is_house: boolean };
async function getPartner(partnerId: string): Promise<PartnerLite | null> {
  const { data } = await admin()
    .from("referral_partners")
    .select("id, status, is_house")
    .eq("id", partnerId)
    .maybeSingle();
  return (data as PartnerLite | null) ?? null;
}

async function getHousePartner(): Promise<PartnerLite | null> {
  const { data } = await admin()
    .from("referral_partners")
    .select("id, status, is_house")
    .eq("code", HOUSE_PARTNER_CODE)
    .maybeSingle();
  return (data as PartnerLite | null) ?? null;
}

/**
 * Ensure the org has a referral_attributions row. Returns the partner_id that
 * earns commission on this org's payments, or null if attribution failed.
 *
 * Order of precedence:
 *  1. Existing attribution row (sticky — never overwritten).
 *  2. Owner's profiles.referred_by_partner_id (if partner is not terminated).
 *  3. House partner "Sushma Khare" (is_house_fallback = true).
 */
export async function ensureAttribution(opts: {
  userId: string;
  sourceUrl?: string | null;
}): Promise<{ partnerId: string; isHouseFallback: boolean } | null> {
  const orgId = await ownerOrgId(opts.userId);
  if (!orgId) {
    console.warn("[referral] no org for user", opts.userId);
    return null;
  }

  // 1. Existing attribution wins.
  {
    const { data } = await admin()
      .from("referral_attributions")
      .select("partner_id, is_house_fallback")
      .eq("org_id", orgId)
      .maybeSingle();
    const row = data as { partner_id: string; is_house_fallback: boolean } | null;
    if (row) return { partnerId: row.partner_id, isHouseFallback: row.is_house_fallback };
  }

  // 2. Owner's referrer.
  let partner: PartnerLite | null = null;
  let code = HOUSE_PARTNER_CODE;
  let isHouseFallback = true;

  const { data: profile } = await admin()
    .from("profiles")
    .select("referred_by_partner_id")
    .eq("id", opts.userId)
    .maybeSingle();
  const referrerId = (profile as { referred_by_partner_id: string | null } | null)?.referred_by_partner_id ?? null;
  if (referrerId) {
    const p = await getPartner(referrerId);
    if (p && p.status !== "terminated") {
      partner = p;
      isHouseFallback = false;
      // Look up code for the attribution row
      const { data: pr } = await admin()
        .from("referral_partners").select("code").eq("id", p.id).maybeSingle();
      code = (pr as { code: string } | null)?.code ?? HOUSE_PARTNER_CODE;
    }
  }

  // 3. House fallback.
  if (!partner) {
    partner = await getHousePartner();
    if (!partner) {
      console.error("[referral] house partner missing — cannot attribute");
      return null;
    }
    code = HOUSE_PARTNER_CODE;
    isHouseFallback = true;
  }

  // Insert attribution (race-safe via UNIQUE on org_id).
  const { error: insErr } = await admin()
    .from("referral_attributions")
    .insert({
      org_id: orgId,
      partner_id: partner.id,
      code_used: code,
      source_url: opts.sourceUrl ?? null,
      is_house_fallback: isHouseFallback,
    });
  if (insErr && !insErr.message.toLowerCase().includes("duplicate")) {
    console.error("[referral] attribution insert failed", insErr);
  }

  return { partnerId: partner.id, isHouseFallback };
}

/**
 * Accrue a commission for one Stripe invoice. Idempotent via UNIQUE on
 * stripe_invoice_id. Status is derived from the partner's current status.
 */
export async function accrueCommission(opts: {
  userId: string;
  invoiceId: string;
  chargeId?: string | null;
  grossAmountCents: number;
  currency: string;
  env: StripeEnv;
}): Promise<void> {
  if (opts.grossAmountCents <= 0) return; // skip trial/$0 invoices

  const attr = await ensureAttribution({ userId: opts.userId });
  if (!attr) return;

  const partner = await getPartner(attr.partnerId);
  if (!partner) return;

  // Terminated → no commission row at all.
  if (partner.status === "terminated") return;

  const status =
    partner.status === "suspended" ? "forfeited" : "accrued";

  const taxableAmount = opts.currency.toLowerCase() === "inr" ? Math.round(opts.grossAmountCents / 1.18) : opts.grossAmountCents;
  const commissionCents = Math.round(taxableAmount * DEFAULT_COMMISSION_RATE);

  const orgId = await ownerOrgId(opts.userId);
  if (!orgId) return;

  const { error } = await admin()
    .from("referral_commissions")
    .insert({
      partner_id: partner.id,
      org_id: orgId,
      stripe_invoice_id: opts.invoiceId,
      stripe_charge_id: opts.chargeId ?? null,
      gross_amount_cents: opts.grossAmountCents,
      currency: opts.currency.toLowerCase(),
      commission_rate: DEFAULT_COMMISSION_RATE,
      commission_cents: commissionCents,
      status,
      notes: attr.isHouseFallback ? "house_fallback" : null,
    });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    console.error("[referral] commission insert failed", error);
  }
}

/** Reverse a commission for a refunded charge / voided invoice. */
export async function reverseCommissionForInvoice(invoiceId: string): Promise<void> {
  const { error } = await admin()
    .from("referral_commissions")
    .update({ status: "reversed" })
    .eq("stripe_invoice_id", invoiceId)
    .in("status", ["accrued", "approved"]);
  if (error) console.error("[referral] commission reverse failed", error);
}

export async function reverseCommissionForCharge(chargeId: string): Promise<void> {
  const { error } = await admin()
    .from("referral_commissions")
    .update({ status: "reversed" })
    .eq("stripe_charge_id", chargeId)
    .in("status", ["accrued", "approved"]);
  if (error) console.error("[referral] commission reverse-by-charge failed", error);
}
