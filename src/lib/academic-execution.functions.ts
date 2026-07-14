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

function extractRemarkValue(remarks: string | null | undefined, label: string) {
  if (!remarks) return "";
  const line = remarks
    .split("\n")
    .find((entry) => entry.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line?.slice(label.length + 1).trim() ?? "";
}

function isIncompleteStatus(status: string) {
  return ["not_started", "in_progress", "partially_completed", "rescheduled", "not_covered"].includes(status);
}

function daysBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return 0;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000)));
}

function buildCorrectiveRecommendation(log: any, delayDays: number) {
  if (log.status === "rescheduled") {
    return "Reschedule this lesson in the next available period and keep it open until the planned portion is completed.";
  }
  if (log.status === "not_started" || log.status === "not_covered") {
    return "Assign a make-up class or protected recovery period, then require the teacher to submit a completion update.";
  }
  if (log.status === "partially_completed") {
    return "Carry the pending portion into the next lesson, reduce non-essential activity time, and verify closure in the next progress update.";
  }
  if (delayDays > 2) {
    return "Escalate to the academic coordinator and review whether the monthly syllabus target needs recalibration.";
  }
  return "Monitor the next update and close the pending portion before moving to the next chapter.";
}

function buildTeacherCreditRecommendations(assignments: any[], logs: any[]) {
  const teachers = new Map<string, any>();

  for (const assignment of assignments) {
    const teacherId = assignment.teacher_user_id;
    const row = teachers.get(teacherId) ?? {
      teacher_user_id: teacherId,
      teacher: assignment.profiles?.display_name || assignment.profiles?.email || "Teacher",
      classes: new Set<string>(),
      subjects: new Set<string>(),
      weeklyPeriods: 0,
      academicResponsibilities: 0,
      examinationDuties: 0,
      coCurricularResponsibilities: 0,
      specialProjects: 0,
      recentTeachingPeriods: 0,
    };
    row.classes.add(`${assignment.grade}-${assignment.section ?? ""}`);
    row.subjects.add(assignment.subject);
    row.weeklyPeriods += Number(assignment.periods_per_week ?? assignment.weekly_periods ?? 5);
    teachers.set(teacherId, row);
  }

  for (const log of logs) {
    const teacherId = log.teacher_user_id;
    const row = teachers.get(teacherId) ?? {
      teacher_user_id: teacherId,
      teacher: log.profiles?.display_name || log.profiles?.email || "Teacher",
      classes: new Set<string>(),
      subjects: new Set<string>(),
      weeklyPeriods: 0,
      academicResponsibilities: 0,
      examinationDuties: 0,
      coCurricularResponsibilities: 0,
      specialProjects: 0,
      recentTeachingPeriods: 0,
    };
    row.classes.add(`${log.grade}-${log.section ?? ""}`);
    row.subjects.add(log.subject);
    row.recentTeachingPeriods += Number(log.periods_taken ?? 1);
    teachers.set(teacherId, row);
  }

  const prepared = [...teachers.values()].map((teacher) => {
    const classCount = teacher.classes.size;
    const subjectCount = teacher.subjects.size;
    const weeklyPeriods = teacher.weeklyPeriods || Math.max(teacher.recentTeachingPeriods, classCount * 5);
    const creditScore = Math.round(
      classCount * 12 +
      subjectCount * 10 +
      weeklyPeriods * 2 +
      teacher.academicResponsibilities * 6 +
      teacher.examinationDuties * 5 +
      teacher.coCurricularResponsibilities * 4 +
      teacher.specialProjects * 5,
    );
    return {
      teacher_user_id: teacher.teacher_user_id,
      teacher: teacher.teacher,
      classCount,
      subjectCount,
      weeklyPeriods,
      academicResponsibilities: teacher.academicResponsibilities,
      examinationDuties: teacher.examinationDuties,
      coCurricularResponsibilities: teacher.coCurricularResponsibilities,
      specialProjects: teacher.specialProjects,
      creditScore,
    };
  });

  const averageScore = prepared.length
    ? Math.round(prepared.reduce((sum, teacher) => sum + teacher.creditScore, 0) / prepared.length)
    : 0;

  return prepared
    .map((teacher) => {
      const ratio = averageScore ? teacher.creditScore / averageScore : 1;
      const workloadStatus =
        ratio >= 1.25 ? "high_overload" :
          ratio >= 1.1 ? "moderate_overload" :
            ratio <= 0.75 ? "underutilized" :
              "balanced";
      const recommendation =
        workloadStatus === "high_overload"
          ? `${teacher.teacher} is handling significantly more workload than the teacher average. Consider redistributing one class, subject, exam duty, or project.`
          : workloadStatus === "moderate_overload"
            ? `${teacher.teacher} has a moderate workload pressure. Monitor weekly periods and avoid adding extra duties without adjustment.`
            : workloadStatus === "underutilized"
              ? `${teacher.teacher} may be available for additional academic support, substitution, remedial work, or shared responsibility.`
              : `Current allocation for ${teacher.teacher} is balanced and requires no immediate action.`;

      return {
        ...teacher,
        averageScore,
        workloadStatus,
        indicator: workloadStatus === "balanced" ? "green" : workloadStatus === "moderate_overload" ? "yellow" : "red",
        recommendation,
        advisoryNote: "Advisory recommendation only; final workload decisions remain with the School Super Admin and school management.",
      };
    })
    .sort((a, b) => b.creditScore - a.creditScore);
}

async function notifyExecutionException(args: {
  supabaseAdmin: any;
  orgId: string;
  schoolId: string | null;
  logId: string;
  teacherName: string;
  grade: string;
  section: string | null;
  subject: string;
  assignedWork: string;
  pendingPortion: string;
  status: string;
}) {
  const { data: recipients } = await args.supabaseAdmin
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", args.orgId)
    .in("role", ["admin", "super_admin", "coordinator", "owner"]);

  const severity = ["not_started", "not_covered", "rescheduled"].includes(args.status) ? "critical" : "warn";
  const title = "Daily syllabus exception requires review";
  const body = [
    `${args.teacherName} did not fully complete the planned work for Grade ${args.grade}${args.section ? `-${args.section}` : ""} ${args.subject}.`,
    `Assigned: ${args.assignedWork || "Not specified"}.`,
    `Pending: ${args.pendingPortion || "Pending portion requires confirmation"}.`,
  ].join(" ");

  const rows = (recipients ?? []).map((recipient: any) => ({
    user_id: recipient.user_id,
    school_id: args.schoolId,
    type: "daily_syllabus_exception",
    title,
    body,
    link: "/academic-execution",
    severity,
    dedupe_key: `daily-syllabus-exception:${args.logId}:${recipient.user_id}`,
  }));

  if (rows.length) {
    const { error } = await args.supabaseAdmin.from("notifications").insert(rows);
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      console.warn("Could not create syllabus exception notifications", error.message);
    }
  }
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
    if (isIncompleteStatus(data.status)) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, display_name")
        .eq("id", userId)
        .maybeSingle();
      await notifyExecutionException({
        supabaseAdmin,
        orgId: me.org_id,
        schoolId: year.school_id,
        logId: row.id,
        teacherName: profile?.display_name || profile?.email || "Teacher",
        grade: data.grade,
        section: data.section || null,
        subject: data.subject,
        assignedWork: data.planned_topic || data.actual_topics,
        pendingPortion: extractRemarkValue(data.remarks, "Next planned topic") || data.planned_topic || "Pending portion requires follow-up",
        status: data.status,
      });
    }

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
    const exceptionReports = logs
      .filter((log: any) => isIncompleteStatus(log.status))
      .map((log: any) => {
        const assignedWork = log.planned_topic || "Assigned work not specified";
        const completedWork = log.actual_topics || "No completed work recorded";
        const portionCompleted = extractRemarkValue(log.remarks, "Portion completed");
        const nextPlannedTopic = extractRemarkValue(log.remarks, "Next planned topic");
        const pendingPortion =
          log.status === "completed"
            ? ""
            : nextPlannedTopic || (portionCompleted ? `Remaining after ${portionCompleted}` : assignedWork);
        const delayDurationDays = daysBetween(log.planned_date, log.actual_date);
        return {
          id: log.id,
          teacher: log.profiles?.display_name || log.profiles?.email || "Teacher",
          grade: log.grade,
          section: log.section,
          subject: log.subject,
          planned_date: log.planned_date,
          actual_date: log.actual_date,
          status: log.status,
          assignedWork,
          completedWork,
          portionCompleted: portionCompleted || "Not fully completed",
          pendingPortion,
          delayDurationDays,
          impact: delayDurationDays > 0
            ? `${delayDurationDays} day delay may affect monthly syllabus completion target.`
            : "Same-day exception; monitor next class to protect syllabus target.",
          recommendation: buildCorrectiveRecommendation(log, delayDurationDays),
          trackUntilCompleted: true,
        };
      });
    const teacherCreditRecommendations = buildTeacherCreditRecommendations(assignments, logs);

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
        exceptionReports: exceptionReports.length,
        pendingPortions: exceptionReports.filter((report) => report.pendingPortion).length,
        overloadedTeachers: teacherCreditRecommendations.filter((row) =>
          ["moderate_overload", "high_overload"].includes(row.workloadStatus),
        ).length,
      },
      rows,
      logs: logs.slice(0, 30),
      exceptionReports,
      teacherCreditRecommendations,
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
