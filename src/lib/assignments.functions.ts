import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function loadMyOrg(supabase: any, userId: string) {
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("You are not a member of any school.");
  return data as { org_id: string; role: string };
}

function requireAdmin(role: string) {
  if (role !== "admin") throw new Error("Only school admins can manage teacher assignments.");
}

export const listSchoolTeachers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ academic_year_id: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const me = await loadMyOrg(supabase, userId);

    const [members, assignmentsRes, yearRes] = await Promise.all([
      supabase
        .from("org_members")
        .select("user_id, role, created_at, profiles(email, display_name)")
        .eq("org_id", me.org_id),
      data.academic_year_id
        ? supabase
            .from("teacher_assignments")
            .select("*")
            .eq("academic_year_id", data.academic_year_id)
            .order("grade")
        : Promise.resolve({ data: [] as any[] }),
      data.academic_year_id
        ? supabase.from("academic_years").select("id, label, school_id").eq("id", data.academic_year_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      org_id: me.org_id,
      my_role: me.role,
      can_edit: me.role === "admin",
      year: yearRes.data,
      members: (members.data ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        email: m.profiles?.email ?? null,
        display_name: m.profiles?.display_name ?? null,
        created_at: m.created_at,
      })),
      assignments: assignmentsRes.data ?? [],
    };
  });

export const assignTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        academic_year_id: z.string().uuid(),
        teacher_user_id: z.string().uuid(),
        grade: z.string().trim().min(1).max(20),
        section: z.string().trim().max(20).optional().nullable(),
        subject: z.string().trim().min(1).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const me = await loadMyOrg(supabase, userId);
    requireAdmin(me.role);

    const { data: yr, error: yrErr } = await supabase
      .from("academic_years")
      .select("id, school_id, org_id")
      .eq("id", data.academic_year_id)
      .maybeSingle();
    if (yrErr || !yr) throw new Error("Academic year not found.");
    if (yr.org_id !== me.org_id) throw new Error("Cross-school assignment forbidden.");

    // Confirm target user is a member of this org
    const { data: targetMem } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", me.org_id)
      .eq("user_id", data.teacher_user_id)
      .maybeSingle();
    if (!targetMem) throw new Error("That user is not a member of your school. Invite them first.");

    const { data: row, error } = await supabase
      .from("teacher_assignments")
      .insert({
        org_id: me.org_id,
        school_id: yr.school_id,
        academic_year_id: yr.id,
        teacher_user_id: data.teacher_user_id,
        grade: data.grade,
        section: data.section || null,
        subject: data.subject,
        created_by: userId,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("That teacher is already assigned to this class/subject.");
      throw new Error(error.message);
    }
    return row;
  });

export const revokeAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const me = await loadMyOrg(supabase, userId);
    requireAdmin(me.role);
    const { error } = await supabase.from("teacher_assignments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
