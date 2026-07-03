import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { attributionLabelForSource } from "@/lib/acquisition";

const acquisitionSchema = z.object({
  acquisition_source: z.string().min(1),
  acquisition_detail: z.string().optional().nullable(),
  partner_name: z.string().optional().nullable(),
  partner_referral_code: z.string().optional().nullable(),
  other_source: z.string().optional().nullable(),
});

async function assertSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("super_admin")) throw new Error("Forbidden");
}

export const saveMyAcquisitionSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => acquisitionSchema.parse(input))
  .handler(async ({ context, data }) => {
    const attribution_label = attributionLabelForSource(data.acquisition_source);
    const { error } = await context.supabase.from("profiles").update({
      ...data,
      attribution_label,
    }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAcquisitionReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [schools, subscriptions, leads] = await Promise.all([
      supabaseAdmin.from("schools").select("id, acquisition_source, acquisition_detail, partner_name, partner_referral_code, attribution_label").limit(5000),
      supabaseAdmin.from("subscriptions").select("id, status, product_id, price_id, acquisition_source, acquisition_detail, partner_name, partner_referral_code, attribution_label").limit(5000),
      supabaseAdmin.from("leads").select("id, stage, acquisition_source, acquisition_detail, partner_name, partner_referral_code, attribution_label").limit(5000),
    ]);

    const sourceRows = new Map<string, any>();
    for (const row of schools.data ?? []) {
      const key = row.acquisition_source || "not_captured";
      const entry = sourceRows.get(key) ?? { source: key, customers: 0, subscriptions: 0, leads: 0, won_leads: 0 };
      entry.customers += 1;
      sourceRows.set(key, entry);
    }
    for (const row of subscriptions.data ?? []) {
      const key = row.acquisition_source || "not_captured";
      const entry = sourceRows.get(key) ?? { source: key, customers: 0, subscriptions: 0, leads: 0, won_leads: 0 };
      entry.subscriptions += 1;
      sourceRows.set(key, entry);
    }
    for (const row of leads.data ?? []) {
      const key = row.acquisition_source || "not_captured";
      const entry = sourceRows.get(key) ?? { source: key, customers: 0, subscriptions: 0, leads: 0, won_leads: 0 };
      entry.leads += 1;
      if (row.stage === "won") entry.won_leads += 1;
      sourceRows.set(key, entry);
    }

    const partnerRows = new Map<string, any>();
    for (const row of [...(schools.data ?? []), ...(subscriptions.data ?? []), ...(leads.data ?? [])]) {
      if (row.acquisition_source !== "authorized_partner") continue;
      const key = row.partner_referral_code || row.partner_name || "partner_not_identified";
      const entry = partnerRows.get(key) ?? { partner: key, customers: 0, subscriptions: 0, leads: 0, commission_status: "policy_pending" };
      if ("stage" in row) entry.leads += 1;
      else if ("status" in row) entry.subscriptions += 1;
      else entry.customers += 1;
      partnerRows.set(key, entry);
    }

    return {
      bySource: Array.from(sourceRows.values()),
      byPartner: Array.from(partnerRows.values()),
      directCompanyRevenueNote: "Rows not attributed to authorized partners are treated as Direct Company Acquisition / Marketing-Welfare Account.",
    };
  });
