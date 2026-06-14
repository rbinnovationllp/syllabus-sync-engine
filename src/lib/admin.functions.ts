import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  school_name: z.string().trim().max(200).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  board: z.string().trim().max(80).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
});

// PUBLIC: capture website inquiry
export const createLead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => leadSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("leads").insert({
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      school_name: data.school_name ?? null,
      country: data.country ?? null,
      board: data.board ?? null,
      message: data.message ?? null,
      source: "website",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Helper — assert admin or super_admin
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  if (!isAdmin) throw new Error("Forbidden");
  return { roles, isSuperAdmin: roles.includes("super_admin") };
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isSuperAdmin } = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [leads, clients, subs, usage, schools] = await Promise.all([
      supabaseAdmin.from("leads").select("id, stage, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, email, display_name, created_at").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("subscriptions").select("id, user_id, status, product_id, price_id, current_period_end, environment, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("plan_usage").select("user_id, period_month, ai_credits_used, exports_used").order("period_month", { ascending: false }).limit(500),
      supabaseAdmin.from("schools").select("id, name, country, board, fee_tier, created_at").order("created_at", { ascending: false }).limit(500),
    ]);

    return {
      isSuperAdmin,
      leads: leads.data ?? [],
      clients: clients.data ?? [],
      subscriptions: subs.data ?? [],
      usage: usage.data ?? [],
      schools: schools.data ?? [],
    };
  });

export const listLeadsFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateLeadStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      stage: z.enum(["new", "contacted", "demo", "won", "lost"]),
      notes: z.string().max(2000).optional().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const update: { stage: string; notes?: string | null } = { stage: data.stage };
    if (data.notes !== undefined) update.notes = data.notes;
    const { error } = await supabaseAdmin.from("leads").update(update as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Super-admin only: promote a user by email to admin role, gated by ADMIN_PROMOTION_CODE
export const promoteToAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().email(),
      code: z.string().min(1),
      role: z.enum(["admin", "super_admin"]).default("admin"),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { isSuperAdmin } = await assertAdmin(context);
    if (!isSuperAdmin) throw new Error("Only the super admin can promote users.");

    const expected = process.env.ADMIN_PROMOTION_CODE;
    if (!expected) throw new Error("Promotion code is not configured.");
    if (data.code !== expected) throw new Error("Invalid promotion code.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Find user by email via admin API
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw new Error(listErr.message);
    const target = list.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!target) throw new Error("No user with that email has signed up yet.");

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: target.id, role: data.role })
      .select();
    if (insErr && !insErr.message.includes("duplicate")) throw new Error(insErr.message);

    return { ok: true, user_id: target.id };
  });

export const revokeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), code: z.string().min(1) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { isSuperAdmin } = await assertAdmin(context);
    if (!isSuperAdmin) throw new Error("Forbidden");
    const expected = process.env.ADMIN_PROMOTION_CODE;
    if (!expected || data.code !== expected) throw new Error("Invalid promotion code.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "super_admin"]);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name")
      .in("id", ids);
    return (roles ?? []).map((r) => ({
      user_id: r.user_id,
      role: r.role,
      email: profiles?.find((p) => p.id === r.user_id)?.email ?? null,
      display_name: profiles?.find((p) => p.id === r.user_id)?.display_name ?? null,
    }));
  });

export const getMyAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r: any) => r.role);
    return {
      isAdmin: roles.includes("admin") || roles.includes("super_admin"),
      isSuperAdmin: roles.includes("super_admin"),
    };
  });
