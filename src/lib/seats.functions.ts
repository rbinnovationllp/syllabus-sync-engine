import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inviteSchema = z.object({
  org_id: z.string().uuid(),
  email: z.string().trim().email().max(255),
  role: z.enum(["admin", "coordinator", "teacher", "viewer"]),
});

const revokeSchema = z.object({ invitation_id: z.string().uuid() });
const removeMemberSchema = z.object({ org_id: z.string().uuid(), user_id: z.string().uuid() });

export const listMyOrg = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("org_members")
      .select("org_id, role, organizations(id, name, owner_id)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!mem) return null;
    const orgId = mem.org_id;
    const isAdmin = ["admin", "super_admin"].includes(mem.role as string);
    const [members, invites] = await Promise.all([
      supabase
        .from("org_members")
        .select("user_id, role, created_at, profiles(email, display_name)")
        .eq("org_id", orgId)
        .order("created_at"),
      isAdmin
        ? supabase
            .from("invitations")
            .select("id, email, role, status, expires_at, created_at, token")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);
    return {
      org: mem.organizations,
      myRole: mem.role,
      members: members.data ?? [],
      invitations: invites.data ?? [],
    };
  });

export const inviteSeatMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // verify caller is admin/owner of org
    const { data: mem } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", data.org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem || !["admin", "super_admin"].includes(mem.role as string)) {
      throw new Error("Only org admins can invite members");
    }
    const { data: invite, error } = await supabase
      .from("invitations")
      .insert({
        org_id: data.org_id,
        email: data.email.toLowerCase(),
        role: data.role,
        invited_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return invite;
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => revokeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv } = await supabase
      .from("invitations")
      .select("org_id")
      .eq("id", data.invitation_id)
      .maybeSingle();
    if (!inv) throw new Error("Invitation not found");
    const { data: caller } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", inv.org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!caller || !["admin", "super_admin"].includes(caller.role as string)) {
      throw new Error("Only org admins can revoke invitations");
    }
    const { error } = await context.supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", data.invitation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSeatMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => removeMemberSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("You cannot remove yourself");
    const { data: caller } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", data.org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!caller || !["admin", "super_admin"].includes(caller.role as string)) {
      throw new Error("Only org admins can remove members");
    }
    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("org_id", data.org_id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const acceptSchema = z.object({ token: z.string().min(8).max(128) });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => acceptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const email = (claims?.email as string | undefined)?.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (inviteErr) throw new Error(inviteErr.message);
    if (!invite) throw new Error("Invitation not found");
    if (invite.status !== "pending") throw new Error(`Invitation already ${invite.status}`);
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("invitations").update({ status: "expired" }).eq("id", invite.id);
      throw new Error("Invitation expired");
    }
    if (email && invite.email.toLowerCase() !== email) {
      throw new Error(`This invitation was sent to ${invite.email}. Sign in with that email.`);
    }

    // Add to org_members (idempotent on unique(org_id, user_id))
    const { error: memberErr } = await supabaseAdmin
      .from("org_members")
      .upsert(
        { org_id: invite.org_id, user_id: userId, role: invite.role },
        { onConflict: "org_id,user_id" },
      );
    if (memberErr) throw new Error(memberErr.message);

    // Mirror role into user_roles for global RBAC checks (admin/coordinator/etc)
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: invite.role })
      .select();

    await supabaseAdmin
      .from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return { ok: true, org_id: invite.org_id, role: invite.role };
  });

export const previewInvitation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => acceptSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("invitations")
      .select("email, role, status, expires_at, org_id, organizations(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) return null;
    return {
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expires_at: invite.expires_at,
      org_name: (invite as any).organizations?.name ?? null,
    };
  });
