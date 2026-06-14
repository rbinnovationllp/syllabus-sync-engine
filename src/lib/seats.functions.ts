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
    const [members, invites] = await Promise.all([
      supabase
        .from("org_members")
        .select("user_id, role, created_at, profiles(email, display_name)")
        .eq("org_id", orgId)
        .order("created_at"),
      supabase
        .from("invitations")
        .select("id, email, role, status, expires_at, created_at, token")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false }),
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
