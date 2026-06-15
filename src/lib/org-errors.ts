// Shared helpers for org membership errors and audit logging.
// Kept framework-free so it is unit-testable with `bun test`.

export function friendlyOrgMemberError(rawMessage: string | null | undefined): string {
  const msg = (rawMessage ?? "").toLowerCase();
  if (
    msg.includes("row-level security") &&
    msg.includes("org_members")
  ) {
    return "We couldn't add you to your school workspace. This usually means your invitation has already been used, was sent to a different email, or your account isn't authorized. Please sign in with the invited email or contact support@syllabus-sync.in.";
  }
  if (msg.includes("duplicate key") && msg.includes("org_members")) {
    return "You're already a member of this workspace.";
  }
  if (msg.includes("violates row-level security")) {
    return "You don't have permission to perform this action on this workspace. Please contact your school admin or support@syllabus-sync.in.";
  }
  return rawMessage || "Unknown error joining workspace.";
}

export type AdminClientLike = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

export async function logOrgMemberBootstrap(
  supabaseAdmin: AdminClientLike,
  params: {
    actorId: string;
    actorEmail?: string | null;
    orgId: string;
    role: string;
    source: "onboarding" | "invitation_accept";
  },
): Promise<void> {
  try {
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_id: params.actorId,
      actor_email: params.actorEmail ?? null,
      action: "org_member_bootstrap",
      target_type: "organization",
      target_id: params.orgId,
      details: {
        role: params.role,
        source: params.source,
        bypassed_rls: true,
        at: new Date().toISOString(),
      },
    });
  } catch {
    // Audit logging must never break the user flow.
  }
}
