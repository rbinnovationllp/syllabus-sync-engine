import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const listInput = z.object({
  year_id: z.string().uuid(),
  entity_type: z.enum(["annual_calendar", "subject_curriculum"]),
  grade: z.string().max(20).optional().nullable(),
  subject: z.string().max(120).optional().nullable(),
});

export const listCurriculumVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => listInput.parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("curriculum_versions")
      .select("id, version_no, diff_summary, source, created_by, created_at, meta")
      .eq("year_id", data.year_id)
      .eq("entity_type", data.entity_type)
      .order("version_no", { ascending: false })
      .limit(100);
    if (data.entity_type === "subject_curriculum") {
      if (data.grade) q = q.eq("grade", data.grade);
      if (data.subject) q = q.eq("subject", data.subject);
    } else {
      q = q.is("grade", null).is("subject", null);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCurriculumVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("curriculum_versions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Version not found");
    return row;
  });

export const restoreCurriculumVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    // verify caller is org admin
    const { data: ver } = await supabase
      .from("curriculum_versions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!ver) throw new Error("Version not found");
    const { data: mem } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", (ver as any).org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (mem?.role !== "admin") throw new Error("Only school admins can restore a version.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const v = ver as any;

    if (v.entity_type === "annual_calendar") {
      await supabaseAdmin.from("annual_calendars").upsert(
        {
          year_id: v.year_id,
          user_id: userId,
          plan: v.payload,
          meta: { ...(v.meta ?? {}), restored_from_version: v.version_no, restored_at: new Date().toISOString() },
        },
        { onConflict: "year_id" },
      );
    } else {
      await supabaseAdmin.from("subject_curricula").upsert(
        {
          year_id: v.year_id,
          user_id: userId,
          grade: v.grade,
          subject: v.subject,
          chapters: (v.payload as any)?.chapters ?? [],
          meta: { ...(v.meta ?? {}), summary: (v.payload as any)?.summary, restored_from_version: v.version_no, restored_at: new Date().toISOString() },
          deleted_at: null,
        },
        { onConflict: "year_id,grade,subject" },
      );
    }

    await supabaseAdmin.rpc("append_curriculum_version", {
      _year_id: v.year_id,
      _entity_type: v.entity_type,
      _grade: v.grade,
      _subject: v.subject,
      _payload: v.payload,
      _meta: { ...(v.meta ?? {}), restored_from_version: v.version_no },
      _diff_summary: `Restored from v${v.version_no}`,
      _source: "restore",
      _created_by: userId,
    });
    return { ok: true };
  });

export const softDeleteSubjectCurriculum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // admin-only via org_members
    const { data: sc } = await supabase
      .from("subject_curricula")
      .select("id, year_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!sc) throw new Error("Not found");
    const { data: yr } = await supabase
      .from("academic_years")
      .select("org_id")
      .eq("id", (sc as any).year_id)
      .maybeSingle();
    const { data: mem } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", (yr as any).org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (mem?.role !== "admin") throw new Error("Admin only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subject_curricula")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRecycleBin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ year_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("subject_curricula")
      .select("id, grade, subject, deleted_at, updated_at")
      .eq("year_id", data.year_id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(error.message);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return (rows ?? []).map((r: any) => ({
      ...r,
      expires_at: new Date(new Date(r.deleted_at).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      purges_soon: new Date(r.deleted_at).getTime() < cutoff,
    }));
  });

export const restoreSubjectCurriculum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sc } = await supabase
      .from("subject_curricula")
      .select("id, year_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!sc) throw new Error("Not found");
    const { data: yr } = await supabase
      .from("academic_years")
      .select("org_id")
      .eq("id", (sc as any).year_id)
      .maybeSingle();
    const { data: mem } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", (yr as any).org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (mem?.role !== "admin") throw new Error("Admin only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subject_curricula")
      .update({ deleted_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
