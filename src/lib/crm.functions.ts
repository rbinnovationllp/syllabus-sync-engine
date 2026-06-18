import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STAGES = ["new", "contacted", "qualified", "demo", "proposal", "won", "lost"] as const;
const DEAL_STAGES = ["qualified", "demo", "proposal", "negotiation", "won", "lost"] as const;
const ACTIVITY_TYPES = ["call", "meeting", "email", "task", "note"] as const;

async function assertSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("super_admin")) throw new Error("Forbidden");
}

// ============ DASHBOARD ============
export const getCrmDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [accounts, leads, deals, activities] = await Promise.all([
      supabaseAdmin.from("crm_accounts").select("id").limit(1000),
      supabaseAdmin.from("crm_leads").select("id, stage, created_at").limit(2000),
      supabaseAdmin.from("crm_deals").select("id, amount_inr, probability, stage, status, expected_close_date").limit(2000),
      supabaseAdmin.from("crm_activities").select("id, type, subject, due_at, completed_at, account_id, lead_id, deal_id")
        .is("completed_at", null).order("due_at", { ascending: true }).limit(20),
    ]);

    const leadsByStage: Record<string, number> = {};
    for (const l of leads.data ?? []) leadsByStage[l.stage] = (leadsByStage[l.stage] ?? 0) + 1;

    const openDeals = (deals.data ?? []).filter((d: any) => d.status === "open");
    const wonThisMonth = (deals.data ?? []).filter((d: any) => {
      if (d.status !== "won") return false;
      return d.expected_close_date && d.expected_close_date.slice(0, 7) === new Date().toISOString().slice(0, 7);
    });
    const pipelineValue = openDeals.reduce((s: number, d: any) => s + (d.amount_inr ?? 0) * (d.probability ?? 0) / 100, 0);
    const wonValue = wonThisMonth.reduce((s: number, d: any) => s + (d.amount_inr ?? 0), 0);

    return {
      counts: {
        accounts: accounts.data?.length ?? 0,
        open_deals: openDeals.length,
        won_this_month: wonThisMonth.length,
        leads: leads.data?.length ?? 0,
      },
      pipelineValue,
      wonValue,
      leadsByStage,
      upcoming: activities.data ?? [],
    };
  });

// ============ LEADS ============
export const listCrmLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("crm_leads")
      .select("*, crm_accounts(name)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const leadInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  source: z.string().trim().max(80).optional().nullable(),
  stage: z.enum(STAGES).default("new"),
  score: z.number().int().min(0).max(100).default(0),
  account_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export const createCrmLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => leadInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("crm_leads").insert({
      ...data, owner_user_id: context.userId, last_touched_at: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCrmLeadStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    stage: z.enum(STAGES),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_leads")
      .update({ stage: data.stage, last_touched_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("crm_activities").insert({
      type: "note",
      subject: `Stage changed to ${data.stage}`,
      lead_id: data.id,
      completed_at: new Date().toISOString(),
      owner_user_id: context.userId,
    });
    return { ok: true };
  });

export const importLeadsFromWebsite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Pull website leads not yet in crm_leads
    const { data: existing } = await supabaseAdmin.from("crm_leads").select("external_lead_id").not("external_lead_id", "is", null);
    const existingIds = new Set((existing ?? []).map((r: any) => r.external_lead_id));
    const { data: src, error } = await supabaseAdmin.from("leads").select("*").limit(500);
    if (error) throw new Error(error.message);
    const toInsert = (src ?? []).filter((l: any) => !existingIds.has(l.id)).map((l: any) => ({
      external_lead_id: l.id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      source: l.source || "website",
      stage: "new",
      owner_user_id: context.userId,
      notes: [l.school_name, l.country, l.board, l.message].filter(Boolean).join(" • "),
      last_touched_at: l.created_at,
    }));
    if (toInsert.length === 0) return { inserted: 0 };
    const { error: insErr } = await supabaseAdmin.from("crm_leads").insert(toInsert);
    if (insErr) throw new Error(insErr.message);
    return { inserted: toInsert.length };
  });

// ============ ACCOUNTS ============
const accountSchema = z.object({
  name: z.string().trim().min(1).max(200),
  board: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  fee_tier: z.string().max(40).optional().nullable(),
  website: z.string().max(255).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export const listCrmAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("crm_accounts").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createCrmAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => accountSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("crm_accounts")
      .insert({ ...data, owner_user_id: context.userId }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getCrmAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [account, contacts, deals, activities, notes] = await Promise.all([
      supabaseAdmin.from("crm_accounts").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("crm_contacts").select("*").eq("account_id", data.id).order("created_at"),
      supabaseAdmin.from("crm_deals").select("*").eq("account_id", data.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("crm_activities").select("*").eq("account_id", data.id).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("crm_notes").select("*").eq("parent_type", "account").eq("parent_id", data.id).order("created_at", { ascending: false }),
    ]);
    if (account.error) throw new Error(account.error.message);
    if (!account.data) throw new Error("Account not found");
    return {
      account: account.data,
      contacts: contacts.data ?? [],
      deals: deals.data ?? [],
      activities: activities.data ?? [],
      notes: notes.data ?? [],
    };
  });

// ============ CONTACTS ============
const contactSchema = z.object({
  account_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(200),
  role: z.string().max(80).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(40).optional().nullable(),
  linkedin: z.string().max(255).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export const createCrmContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("crm_contacts")
      .insert({ ...data, email: data.email || null }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============ DEALS ============
const dealSchema = z.object({
  account_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  amount_inr: z.number().min(0).default(0),
  probability: z.number().int().min(0).max(100).default(50),
  expected_close_date: z.string().optional().nullable(),
  stage: z.enum(DEAL_STAGES).default("qualified"),
  notes: z.string().max(4000).optional().nullable(),
});
export const createCrmDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => dealSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("crm_deals")
      .insert({ ...data, owner_user_id: context.userId }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCrmDealStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    stage: z.enum(DEAL_STAGES),
    status: z.enum(["open", "won", "lost"]).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = data.status ?? (data.stage === "won" ? "won" : data.stage === "lost" ? "lost" : "open");
    const { error } = await supabaseAdmin.from("crm_deals").update({ stage: data.stage, status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ACTIVITIES ============
const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().trim().min(1).max(200),
  body: z.string().max(4000).optional().nullable(),
  due_at: z.string().optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
});
export const createCrmActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => activitySchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("crm_activities")
      .insert({ ...data, owner_user_id: context.userId }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const completeCrmActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_activities")
      .update({ completed_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ NOTES ============
export const addCrmNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    parent_type: z.enum(["account", "contact", "lead", "deal"]),
    parent_id: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("crm_notes")
      .insert({ ...data, created_by: context.userId }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============ CONVERT account → schools (provision) ============
export const provisionSchoolFromAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ account_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a, error: aErr } = await supabaseAdmin.from("crm_accounts").select("*").eq("id", data.account_id).maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!a) throw new Error("Account not found");
    const { data: row, error } = await supabaseAdmin.from("schools").insert({
      name: a.name, country: a.country, city: a.city, board: a.board, fee_tier: a.fee_tier,
    }).select().single();
    if (error) throw new Error(error.message);
    return { school_id: row.id };
  });

// ============ AI: draft follow-up email ============
export const draftFollowUpEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    lead_id: z.string().uuid(),
    tone: z.enum(["warm", "direct", "executive"]).default("warm"),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead } = await supabaseAdmin.from("crm_leads")
      .select("*, crm_accounts(name, board, city, country, fee_tier)").eq("id", data.lead_id).maybeSingle();
    if (!lead) throw new Error("Lead not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    const ctx = {
      name: lead.name, stage: lead.stage, notes: lead.notes,
      account: lead.crm_accounts,
    };
    const prompt = `Draft a ${data.tone} follow-up email from the founder of CurriculumOS (AI school curriculum planning platform) to this prospect. Keep under 140 words. Include: 1 specific value point, 1 next step. Plain text, no markdown.\n\nLead context: ${JSON.stringify(ctx)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
    const json: any = await res.json();
    const draft = json?.choices?.[0]?.message?.content ?? "";

    await supabaseAdmin.from("crm_activities").insert({
      type: "email", subject: `Draft follow-up (${data.tone})`, body: draft,
      lead_id: data.lead_id, owner_user_id: context.userId,
    });
    return { draft };
  });
