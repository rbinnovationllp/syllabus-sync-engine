import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const AI_CONTENT_DISCLAIMER =
  "AI-generated content is provided as an educational planning aid only. While every effort is made to improve accuracy, the platform cannot guarantee that all information is complete, error-free, or suitable for every educational environment. Users are responsible for reviewing, verifying, modifying, and approving all generated content before implementation.";

export const REVIEW_CONFIRMATION_TEXT =
  "I confirm that I have reviewed the AI-generated content and accept responsibility for validating its accuracy, suitability, and compliance with my institution's requirements before implementation.";

const activityInput = z.object({
  action: z.string().min(2).max(120),
  entity_type: z.string().max(80).optional().nullable(),
  entity_id: z.string().max(160).optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
  user_name: z.string().max(160).optional().nullable(),
  user_role: z.string().max(80).optional().nullable(),
  school_name: z.string().max(200).optional().nullable(),
  metadata: z.record(z.any()).optional().default({}),
});

const confirmationInput = z.object({
  output_type: z.string().min(2).max(100),
  output_id: z.string().max(160).optional().nullable(),
  title: z.string().max(220).optional().nullable(),
  action: z.string().max(80).optional().default("download"),
});

const listInput = z.object({
  limit: z.number().int().min(1).max(500).optional().default(100),
  action: z.string().max(120).optional().nullable(),
});

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getPrimaryOrg(supabase: any, userId: string) {
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return {
    orgId: data?.org_id ?? null,
    role: data?.role ?? null,
    schoolName: (data?.organizations as any)?.name ?? null,
  };
}

async function insertAudit(row: Record<string, any>) {
  const admin = await adminClient();
  const { error } = await admin.from("platform_audit_logs").insert(row);
  if (error) throw new Error(error.message);
}

export const recordPlatformActivity = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => activityInput.parse(i))
  .handler(async ({ data }) => {
    await insertAudit({
      user_id: data.user_id ?? null,
      user_name: data.user_name ?? null,
      user_role: data.user_role ?? null,
      school_name: data.school_name ?? null,
      action: data.action,
      entity_type: data.entity_type ?? null,
      entity_id: data.entity_id ?? null,
      metadata: data.metadata ?? {},
    });
    return { ok: true };
  });

export const recordAuthenticatedActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => activityInput.omit({ user_id: true }).parse(i))
  .handler(async ({ data, context }) => {
    const org = await getPrimaryOrg(context.supabase, context.userId);
    await insertAudit({
      org_id: org.orgId,
      user_id: context.userId,
      user_name: data.user_name ?? (context.claims as any)?.email ?? null,
      user_role: data.user_role ?? org.role,
      school_name: data.school_name ?? org.schoolName,
      action: data.action,
      entity_type: data.entity_type ?? null,
      entity_id: data.entity_id ?? null,
      metadata: data.metadata ?? {},
    });
    return { ok: true };
  });

export const recordReviewConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => confirmationInput.parse(i))
  .handler(async ({ data, context }) => {
    const org = await getPrimaryOrg(context.supabase, context.userId);
    const admin = await adminClient();

    const payload = {
      org_id: org.orgId,
      user_id: context.userId,
      output_type: data.output_type,
      output_id: data.output_id ?? null,
      title: data.title ?? null,
      statement: REVIEW_CONFIRMATION_TEXT,
      action: data.action,
    };

    const { error } = await admin.from("content_review_confirmations").insert(payload);
    if (error) throw new Error(error.message);

    await insertAudit({
      org_id: org.orgId,
      user_id: context.userId,
      user_name: (context.claims as any)?.email ?? null,
      user_role: org.role,
      school_name: org.schoolName,
      action: `content.${data.action}_after_review_confirmation`,
      entity_type: data.output_type,
      entity_id: data.output_id ?? null,
      metadata: { title: data.title ?? null },
    });

    return { ok: true };
  });

async function assertAuditViewer(context: { supabase: any; userId: string }) {
  const { data: roles, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roleNames = (roles ?? []).map((r: any) => r.role);
  if (roleNames.includes("admin") || roleNames.includes("super_admin")) return { scope: "company" as const };

  const { data: member } = await context.supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", context.userId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  if (member?.org_id) return { scope: "org" as const, orgId: member.org_id as string };
  throw new Error("Only authorized administrators can view audit logs.");
}

export const listPlatformAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => listInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const viewer = await assertAuditViewer(context);
    const admin = await adminClient();
    let query = admin
      .from("platform_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (viewer.scope === "org") query = query.eq("org_id", viewer.orgId);
    if (data.action) query = query.eq("action", data.action);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], scope: viewer.scope };
  });
