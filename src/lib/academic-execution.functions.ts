import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type OrgMembership = { org_id: string; role: string };

async function loadMyOrg(supabase: any, userId: string): Promise<OrgMembership> {
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("You are not a member of any school workspace.");
  return data;
}

function isSchoolAdmin(role: string) {
  return role === "admin" || role === "super_admin";
}

function statusWeight(status: string) {
  if (status === "completed") return 1;
  if (status === "partially_completed") return 0.5;
  if (status === "in_progress") return 0.25;
  return 0;
}

function riskFrom(completion: number) {
  if (completion >= 90) return "completed";
  if (completion >= 70) return "on_schedule";
  if (completion >= 45) return "behind_schedule";
  return "at_risk";
}

export const getTeacherExecutionWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const me = await loadMyOrg(supabase, userId);

    const { data: years } = await supabase
      .from("academic_years")
      .select("id, label, start_date, end_date, school_id")
      .eq("org_id", me.org_id)
      .order("created_at", { ascending: false });

    const yearId = years?.[0]?.id;

    const [assignmentsRes, logsRes] = await Promise.all([
      yearId
        ? supabase
            .from("teacher_assignments")
            .select("*")
            .eq("org_id", me.org_id)
            .eq("academic_year_id", yearId)
            .eq("teacher_user_id", userId)
            .order("grade")
        : Promise.resolve({ data: [] }),
      yearId
        ? supabase
            .from("teaching_progress_logs")
            .select("*")
            .eq("org_id", me.org_id)
            .eq("academic_year_id", yearId)
            .eq("teacher_user_id", userId)
            .is("deleted_at", null)
            .order("actual_date", { ascending: false })
            .limit(30)
        : Promise.resolve({ data: [] }),
    ]);

    return {
      org_id: me.org_id,
      my_role: me.role,
      year: years?.[0] ?? null,
      assignments: assignmentsRes.data ?? [],
      recent_logs: logsRes.data ?? [],
    };
  });

const progressSchema = z.object({
  academic_year_id: z.string().uuid(),
  teacher_assignment_id: z.string().uuid().optional().nullable(),
  grade: z.string().trim().min(1).max(20),
  section: z.string().trim().max(20).optional().nullable(),
  subject: z.string().trim().min(1).max(80),
  planned_date: z.string().optional().nullable(),
  actual_date: z.string().min(8),
  planned_topic: z.string().trim().max(1000).optional().nullable(),
  actual_chapter: z.string().trim().max(300).optional().nullable(),
  actual_topics: z.string().trim().min(2).max(4000),
  status: z.enum(["not_started", "in_progress", "completed", "partially_completed", "rescheduled", "not_covered"]),
  periods_taken: z.coerce.number().min(0).max(20).default(1),
  remarks: z.string().trim().max(2000).optional().nullable(),
});

export const recordTeachingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => progressSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const me = await loadMyOrg(supabase, userId);

    const { data: year } = await supabase
      .from("academic_years")
      .select("id, org_id, school_id")
      .eq("id", data.academic_year_id)
      .maybeSingle();
    if (!year || year.org_id !== me.org_id) throw new Error("Academic year not found for your school.");

    if (!isSchoolAdmin(me.role)) {
      const { data: assignment } = await supabase
        .from("teacher_assignments")
        .select("id")
        .eq("org_id", me.org_id)
        .eq("academic_year_id", data.academic_year_id)
        .eq("teacher_user_id", userId)
        .eq("grade", data.grade)
        .eq("subject", data.subject)
        .limit(1)
        .maybeSingle();
      if (!assignment) throw new Error("You can record progress only for your assigned classes and subjects.");
    }

    const { data: row, error } = await supabase
      .from("teaching_progress_logs")
      .insert({
        org_id: me.org_id,
        school_id: year.school_id,
        academic_year_id: data.academic_year_id,
        teacher_assignment_id: data.teacher_assignment_id || null,
        teacher_user_id: userId,
        grade: data.grade,
        section: data.section || null,
        subject: data.subject,
        planned_date: data.planned_date || null,
        actual_date: data.actual_date,
        planned_topic: data.planned_topic || null,
        actual_chapter: data.actual_chapter || null,
        actual_topics: data.actual_topics,
        status: data.status,
        periods_taken: data.periods_taken,
        remarks: data.remarks || null,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("platform_audit_logs").insert({
      org_id: me.org_id,
      user_id: userId,
      user_email: (claims?.email as string | undefined) ?? null,
      user_role: me.role,
      action: "teaching_progress_recorded",
      target_type: "teaching_progress_logs",
      target_id: row.id,
      details: {
        grade: data.grade,
        subject: data.subject,
        actual_date: data.actual_date,
        status: data.status,
      },
    });

    return row;
  });

export const getAcademicExecutionDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const me = await loadMyOrg(supabase, userId);
    if (!isSchoolAdmin(me.role) && me.role !== "coordinator") {
      throw new Error("Only principals, coordinators, and school admins can view academic monitoring.");
    }

    const { data: years } = await supabase
      .from("academic_years")
      .select("id, label, start_date, end_date, school_id")
      .eq("org_id", me.org_id)
      .order("created_at", { ascending: false });

    const year = years?.[0] ?? null;
    if (!year) {
      return { year: null, summary: { classesConducted: 0, averageCompletion: 0, atRisk: 0, behind: 0 }, rows: [], logs: [] };
    }

    const [assignmentsRes, logsRes] = await Promise.all([
      supabase
        .from("teacher_assignments")
        .select("*, profiles:teacher_user_id(email, display_name)")
        .eq("org_id", me.org_id)
        .eq("academic_year_id", year.id),
      supabase
        .from("teaching_progress_logs")
        .select("*, profiles:teacher_user_id(email, display_name)")
        .eq("org_id", me.org_id)
        .eq("academic_year_id", year.id)
        .is("deleted_at", null)
        .order("actual_date", { ascending: false })
        .limit(200),
    ]);

    const assignments = assignmentsRes.data ?? [];
    const logs = logsRes.data ?? [];
    const keyFor = (x: any) => `${x.teacher_user_id}|${x.grade}|${x.section ?? ""}|${x.subject}`;
    const grouped = new Map<string, any>();

    for (const a of assignments) {
      grouped.set(keyFor(a), {
        teacher_user_id: a.teacher_user_id,
        teacher: a.profiles?.display_name || a.profiles?.email || "Teacher",
        grade: a.grade,
        section: a.section,
        subject: a.subject,
        plannedUnits: 20,
        completedUnits: 0,
        classesConducted: 0,
        lastTaught: null,
        pendingChapters: "Awaiting progress records",
      });
    }

    for (const log of logs) {
      const key = keyFor(log);
      const row = grouped.get(key) ?? {
        teacher_user_id: log.teacher_user_id,
        teacher: log.profiles?.display_name || log.profiles?.email || "Teacher",
        grade: log.grade,
        section: log.section,
        subject: log.subject,
        plannedUnits: 20,
        completedUnits: 0,
        classesConducted: 0,
        lastTaught: null,
        pendingChapters: "Review required",
      };
      row.completedUnits += statusWeight(log.status);
      row.classesConducted += 1;
      row.lastTaught = row.lastTaught ?? log.actual_date;
      row.pendingChapters =
        log.status === "not_covered" || log.status === "not_started"
          ? "Topic not completed in latest class"
          : log.status === "rescheduled"
            ? "Lesson rescheduled; follow-up required"
            : "Track next planned topic";
      grouped.set(key, row);
    }

    const rows = [...grouped.values()].map((row) => {
      const completion = Math.min(100, Math.round((row.completedUnits / row.plannedUnits) * 100));
      return {
        ...row,
        completion,
        remainingUnits: Math.max(0, row.plannedUnits - row.completedUnits),
        expectedCompletionDate: completion >= 100 ? row.lastTaught : null,
        risk: riskFrom(completion),
      };
    });

    const averageCompletion = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + row.completion, 0) / rows.length)
      : 0;
    const delayedOrRescheduled = logs.filter((log: any) =>
      ["not_started", "rescheduled", "not_covered"].includes(log.status),
    ).length;
    const missedProgressUpdates = rows.filter((row) => row.classesConducted === 0).length;

    return {
      year,
      summary: {
        classesConducted: logs.length,
        averageCompletion,
        atRisk: rows.filter((r) => r.risk === "at_risk").length,
        behind: rows.filter((r) => r.risk === "behind_schedule").length,
        delayedOrRescheduled,
        missedProgressUpdates,
        monthlyCompletionStatus: averageCompletion,
      },
      rows,
      logs: logs.slice(0, 30),
    };
  });

const declarationSchema = z.object({
  super_admin_name: z.string().trim().min(2).max(200),
  designation: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(255),
  mobile: z.string().trim().max(40).optional().nullable(),
  authorization_notes: z.string().trim().max(2000).optional().nullable(),
});

export const getSchoolGovernance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const me = await loadMyOrg(supabase, userId);
    if (!isSchoolAdmin(me.role)) throw new Error("Only school admins can view governance controls.");

    const [decl, members, permissions, sessions, recycle] = await Promise.all([
      supabase
        .from("school_super_admin_declarations")
        .select("*")
        .eq("org_id", me.org_id)
        .eq("active", true)
        .maybeSingle(),
      supabase
        .from("org_members")
        .select("user_id, role, created_at, profiles(email, display_name)")
        .eq("org_id", me.org_id)
        .order("created_at"),
      supabase
        .from("school_module_permissions")
        .select("*")
        .eq("org_id", me.org_id)
        .order("module"),
      supabase
        .from("user_session_registry")
        .select("*")
        .eq("org_id", me.org_id)
        .is("revoked_at", null)
        .order("last_seen_at", { ascending: false })
        .limit(50),
      supabase
        .from("school_recycle_bin")
        .select("*")
        .eq("org_id", me.org_id)
        .is("restored_at", null)
        .is("purged_at", null)
        .order("deleted_at", { ascending: false })
        .limit(50),
    ]);

    return {
      org_id: me.org_id,
      my_role: me.role,
      declaration: decl.data,
      members: members.data ?? [],
      permissions: permissions.data ?? [],
      sessions: sessions.data ?? [],
      recycle_bin: recycle.data ?? [],
    };
  });

export const declareSchoolSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => declarationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const me = await loadMyOrg(supabase, userId);
    if (!isSchoolAdmin(me.role)) throw new Error("Only the current school admin can declare the school super admin.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("school_super_admin_declarations")
      .update({ active: false })
      .eq("org_id", me.org_id)
      .eq("active", true);

    const { data: row, error } = await supabaseAdmin
      .from("school_super_admin_declarations")
      .insert({
        org_id: me.org_id,
        user_id: userId,
        super_admin_name: data.super_admin_name,
        designation: data.designation,
        email: data.email.toLowerCase(),
        mobile: data.mobile || null,
        authorization_notes: data.authorization_notes || null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("platform_audit_logs").insert({
      org_id: me.org_id,
      user_id: userId,
      user_email: (claims?.email as string | undefined) ?? null,
      user_role: me.role,
      action: "school_super_admin_declared",
      target_type: "school_super_admin_declarations",
      target_id: row.id,
      details: { email: data.email, designation: data.designation },
    });

    return row;
  });
