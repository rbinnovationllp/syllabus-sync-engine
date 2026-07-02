import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TESTER_MODULES = [
  "full_platform",
  "annual_curriculum",
  "exports",
  "v2_ai",
  "assessment_ai",
  "school_crm",
  "parent_hub",
  "storage",
  "company_demo",
] as const;

const testerModuleSchema = z.enum(TESTER_MODULES);

const grantInput = z.object({
  email: z.string().trim().email().max(255),
  display_name: z.string().trim().max(160).optional().nullable(),
  access_scope: z.enum(["full_platform", "selected_modules"]).default("full_platform"),
  modules: z.array(testerModuleSchema).optional().default(["full_platform"]),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  invite_email: z.boolean().optional().default(false),
});

const updateInput = z.object({
  id: z.string().uuid(),
  access_scope: z.enum(["full_platform", "selected_modules"]).optional(),
  modules: z.array(testerModuleSchema).optional(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(["invited", "active", "revoked", "expired"]).optional(),
});

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r: any) => r.role === "super_admin")) {
    throw new Error("Only the company super admin can manage tester access.");
  }
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function moduleFlags(modules: readonly string[], accessScope: "full_platform" | "selected_modules") {
  if (accessScope === "full_platform") {
    return {
      full_platform: true,
      annual_curriculum: true,
      exports: true,
      v2_ai: true,
      assessment_ai: true,
      school_crm: true,
      parent_hub: true,
      storage: true,
      company_demo: true,
    };
  }

  return modules.reduce<Record<string, boolean>>((acc, module) => {
    if (module !== "full_platform") acc[module] = true;
    return acc;
  }, {});
}

async function findUserByEmail(email: string) {
  const admin = await adminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function logTesterAudit(context: any, action: string, targetId: string | null, details: Record<string, unknown>) {
  const admin = await adminClient();
  await admin.from("admin_audit_log").insert({
    actor_id: context.userId,
    actor_email: (context.claims as any)?.email ?? null,
    action,
    target_type: "tester_access",
    target_id: targetId,
    details,
  });

  await admin.from("platform_audit_logs").insert({
    user_id: context.userId,
    user_name: (context.claims as any)?.email ?? null,
    user_role: "super_admin",
    action,
    entity_type: "tester_access",
    entity_id: targetId,
    metadata: details,
  });
}

export const listTesterAccessGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const admin = await adminClient();
    const { data, error } = await admin
      .from("tester_access_grants")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const grantTesterAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => grantInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const admin = await adminClient();
    const user = await findUserByEmail(data.email);
    const flags = moduleFlags(data.modules, data.access_scope);

    const payload = {
      email: data.email.toLowerCase(),
      user_id: user?.id ?? null,
      display_name: data.display_name ?? user?.user_metadata?.full_name ?? null,
      access_scope: data.access_scope,
      module_flags: flags,
      status: user ? "active" : "invited",
      starts_at: data.starts_at ?? new Date().toISOString(),
      ends_at: data.ends_at ?? null,
      notes: data.notes ?? null,
      invited_by: context.userId,
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await admin
      .from("tester_access_grants")
      .upsert(payload, { onConflict: "email" })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (data.invite_email && !user) {
      const origin = process.env.APP_ORIGIN ?? process.env.VITE_APP_ORIGIN ?? "https://syllabus-synk.in";
      await admin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: `${origin}/auth`,
        data: { tester_access: true },
      });
    }

    await logTesterAudit(context, "tester_access.granted", row?.id ?? null, {
      email: data.email,
      access_scope: data.access_scope,
      modules: data.modules,
      ends_at: data.ends_at ?? null,
      invite_email: data.invite_email,
    });

    return row;
  });

export const updateTesterAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => updateInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const admin = await adminClient();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (data.access_scope) update.access_scope = data.access_scope;
    if (data.modules) update.module_flags = moduleFlags(data.modules, data.access_scope ?? "selected_modules");
    if (data.starts_at !== undefined) update.starts_at = data.starts_at;
    if (data.ends_at !== undefined) update.ends_at = data.ends_at;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.status) {
      update.status = data.status;
      if (data.status === "revoked") {
        update.revoked_at = new Date().toISOString();
        update.revoked_by = context.userId;
      }
    }

    const { data: row, error } = await admin
      .from("tester_access_grants")
      .update(update)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await logTesterAudit(context, "tester_access.updated", data.id, update);
    return row;
  });

export const revokeTesterAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const admin = await adminClient();
    const update = {
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const { data: row, error } = await admin
      .from("tester_access_grants")
      .update(update)
      .eq("id", data.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await logTesterAudit(context, "tester_access.revoked", data.id, {});
    return row;
  });
