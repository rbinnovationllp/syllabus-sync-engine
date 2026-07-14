import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createSchoolDownloadUrl,
  createSchoolUploadUrl,
  deleteSchoolStorageObject,
  schoolStorageBucket,
  schoolStorageKey,
} from "@/lib/aws-storage.server";

const PLAN_STORAGE_GB: Record<string, number> = {
  "RET-SINGLE": 1,
  "retail_single_access": 1,
  "PRI-BASE": 50,
  "bundle_primary_access": 50,
  "PRI-PLUS": 75,
  "bundle_primary_plus_access": 75,
  "MID-BASE": 100,
  "bundle_middle_access": 100,
  "MID-PLUS": 150,
  "bundle_middle_plus_access": 150,
  "HIGH-BASE": 200,
  "bundle_high_access": 200,
  "HIGH-PLUS": 300,
  "bundle_high_plus_access": 300,
  "ENT-BASE": 400,
  "enterprise_global_access": 400,
  "ENT-PLUS": 500,
  "enterprise_plus_access": 500,
};

const MAX_SINGLE_UPLOAD_BYTES = 1024 * 1024 * 1024;
const STORAGE_PACKS_GB = [25, 50, 100, 250, 500, 1024, 2048, 5120];
const FAIR_USAGE_POLICY =
  "Each subscription plan includes a defined storage allocation. Additional storage may be purchased separately. The company reserves the right to archive inactive academic records and enforce fair usage policies to maintain platform performance.";

function gbToBytes(gb: number) {
  return gb * 1024 * 1024 * 1024;
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getCurrentOrg(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", context.userId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.org_id) throw new Error("No school account was found for this user.");
  return data as { org_id: string; role?: string | null };
}

async function getOrgPlanCode(orgId: string) {
  const admin = await adminClient();

  const { data: profile } = await admin
    .from("organization_subscription_profiles")
    .select("plan_code")
    .eq("org_id", orgId)
    .maybeSingle();

  if (profile?.plan_code) return profile.plan_code as string;

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("price_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (subscription?.price_id as string | undefined) ?? "RET-SINGLE";
}

async function getOrgExtraStorageGb(orgId: string) {
  const admin = await adminClient();
  const [{ data: profile }, { data: activeAddons }] = await Promise.all([
    admin
    .from("organization_subscription_profiles")
    .select("extra_storage_gb")
    .eq("org_id", orgId)
      .maybeSingle(),
    admin
      .from("organization_storage_addons")
      .select("storage_gb")
      .eq("org_id", orgId)
      .in("status", ["active", "trialing"])
      .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`),
  ]);

  return Number(profile?.extra_storage_gb ?? 0) + (activeAddons ?? []).reduce(
    (sum: number, row: { storage_gb: number }) => sum + Number(row.storage_gb ?? 0),
    0,
  );
}

async function getStorageUsage(orgId: string) {
  const admin = await adminClient();

  const { data, error } = await admin
    .from("school_storage_objects")
    .select("size_bytes")
    .eq("org_id", orgId)
    .in("status", ["pending", "active"]);

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((total: number, row: { size_bytes: number }) => total + Number(row.size_bytes ?? 0), 0);
}

function categoryLabel(category: string | null | undefined) {
  const value = (category || "other").toLowerCase().replaceAll("_", " ");
  if (value.includes("question")) return "Question Papers";
  if (value.includes("report")) return "Reports";
  if (value.includes("image") || value.includes("photo")) return "Images";
  if (value.includes("student")) return "Student Documents";
  if (value.includes("curriculum")) return "Curriculum Files";
  if (value.includes("circular")) return "Circulars";
  if (value.includes("export")) return "Exports";
  if (value.includes("document")) return "Student Documents";
  return "Other Files";
}

function fileTypeLabel(file: { content_type?: string | null; file_name?: string | null }) {
  const type = (file.content_type || "").toLowerCase();
  const name = (file.file_name || "").toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/.test(name)) return "Images";
  if (type.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (type.includes("spreadsheet") || /\.(xls|xlsx|csv)$/.test(name)) return "Spreadsheets";
  if (type.includes("presentation") || /\.(ppt|pptx)$/.test(name)) return "Presentations";
  if (type.includes("word") || /\.(doc|docx)$/.test(name)) return "Documents";
  if (type.includes("zip") || /\.(zip|rar|7z)$/.test(name)) return "Archives";
  if (type.startsWith("video/")) return "Videos";
  return "Other";
}

function addBreakdownRow(map: Map<string, { label: string; bytes: number; count: number }>, label: string, bytes: number) {
  const row = map.get(label) ?? { label, bytes: 0, count: 0 };
  row.bytes += Number(bytes ?? 0);
  row.count += 1;
  map.set(label, row);
}

function usageAlertLevel(percentUsed: number) {
  if (percentUsed >= 100) return 100;
  if (percentUsed >= 90) return 90;
  if (percentUsed >= 80) return 80;
  return 0;
}

async function notifyStorageThreshold(args: {
  orgId: string;
  usedBytes: number;
  quotaBytes: number;
  percentUsed: number;
}) {
  const threshold = usageAlertLevel(args.percentUsed);
  if (!threshold) return;

  const admin = await adminClient();
  const { data: existing } = await admin
    .from("organization_storage_usage_alerts")
    .select("id")
    .eq("org_id", args.orgId)
    .eq("threshold", threshold)
    .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle();
  if (existing?.id) return;

  await admin.from("organization_storage_usage_alerts").insert({
    org_id: args.orgId,
    threshold,
    used_bytes: args.usedBytes,
    quota_bytes: args.quotaBytes,
  });

  const { data: admins } = await admin
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", args.orgId)
    .in("role", ["owner", "admin", "super_admin", "coordinator"]);

  const rows = (admins ?? []).map((member: any) => ({
    user_id: member.user_id,
    type: "storage_usage_alert",
    title: `Storage usage reached ${threshold}%`,
    body: threshold >= 100
      ? "Uploads are blocked until storage is freed, archived, or additional storage is purchased."
      : "Please review largest files, archive old academic sessions, or purchase additional storage before uploads are blocked.",
    link: "/school-storage",
    severity: threshold >= 100 ? "error" : threshold >= 90 ? "warning" : "info",
    dedupe_key: `storage:${args.orgId}:${threshold}:${new Date().toISOString().slice(0, 10)}`,
  }));

  if (rows.length) await admin.from("notifications").insert(rows);
}

async function isCompanySuperAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  return (data ?? []).some((row: { role: string }) => row.role === "super_admin");
}

export const getSchoolStorageDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const org = await getCurrentOrg(context);
    const planCode = await getOrgPlanCode(org.org_id);
    const extraStorageGb = await getOrgExtraStorageGb(org.org_id);
    const quotaGb = (PLAN_STORAGE_GB[planCode] ?? 1) + extraStorageGb;
    const quotaBytes = gbToBytes(quotaGb);

    const admin = await adminClient();
    const { data: files, error } = await admin
      .from("school_storage_objects")
      .select("id, file_name, content_type, size_bytes, category, status, created_at, completed_at, uploaded_by, archived_at, archive_storage_class, academic_year_id")
      .eq("org_id", org.org_id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);
    const fileRows = files ?? [];
    const usedBytes = await getStorageUsage(org.org_id);
    const availableBytes = Math.max(0, quotaBytes - usedBytes);
    const percentUsed = quotaBytes ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
    const alertLevel = usageAlertLevel(percentUsed);

    const categoryMap = new Map<string, { label: string; bytes: number; count: number }>();
    const typeMap = new Map<string, { label: string; bytes: number; count: number }>();
    const userMap = new Map<string, { userId: string; userName: string; bytes: number; count: number }>();

    for (const file of fileRows) {
      const bytes = Number(file.size_bytes ?? 0);
      addBreakdownRow(categoryMap, categoryLabel(file.category), bytes);
      addBreakdownRow(typeMap, fileTypeLabel(file), bytes);
      const userId = file.uploaded_by || "unknown";
      const row = userMap.get(userId) ?? { userId, userName: "Unknown user", bytes: 0, count: 0 };
      row.bytes += bytes;
      row.count += 1;
      userMap.set(userId, row);
    }

    const userIds = [...userMap.keys()].filter((id) => id !== "unknown");
    if (userIds.length) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);
      for (const profile of profiles ?? []) {
        const row = userMap.get(profile.id);
        if (row) row.userName = profile.display_name || profile.email || "User";
      }
    }

    const { data: years } = await admin
      .from("academic_years")
      .select("id, label, start_date, end_date, status")
      .eq("org_id", org.org_id)
      .order("start_date", { ascending: false });

    return {
      orgId: org.org_id,
      planCode,
      quotaGb,
      baseQuotaGb: PLAN_STORAGE_GB[planCode] ?? 1,
      extraStorageGb,
      quotaBytes,
      usedBytes,
      availableBytes,
      percentUsed,
      alertLevel,
      uploadBlocked: percentUsed >= 100,
      fairUsagePolicy: FAIR_USAGE_POLICY,
      enterpriseStoragePlans: ["1 TB", "2 TB", "5 TB", "Unlimited, subject to fair usage"],
      storagePacksGb: STORAGE_PACKS_GB,
      categoryBreakdown: [...categoryMap.values()].sort((a, b) => b.bytes - a.bytes),
      fileTypeBreakdown: [...typeMap.values()].sort((a, b) => b.bytes - a.bytes),
      userUsage: [...userMap.values()].sort((a, b) => b.bytes - a.bytes),
      largestFiles: [...fileRows].sort((a: any, b: any) => Number(b.size_bytes ?? 0) - Number(a.size_bytes ?? 0)).slice(0, 10),
      archivedBytes: fileRows
        .filter((file: any) => file.archived_at)
        .reduce((sum: number, file: any) => sum + Number(file.size_bytes ?? 0), 0),
      sessions: years ?? [],
      files: fileRows.slice(0, 100),
    };
  });

export const allocateAdditionalSchoolStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      orgId: z.string().uuid(),
      storageGb: z.number().int().positive().max(100000),
      notes: z.string().trim().max(1000).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const authContext = context as any;
    const userId = authContext?.userId;
    if (!userId) throw new Error("Authentication context is missing.");
    if (!await isCompanySuperAdmin(authContext)) {
      throw new Error("Only Company Super Admin can allocate additional storage packs.");
    }
    if (!STORAGE_PACKS_GB.includes(data.storageGb) && data.storageGb < 1024) {
      throw new Error("Select a standard storage pack or use an enterprise storage quantity.");
    }

    const admin = await adminClient();
    const { data: profile, error: profileError } = await admin
      .from("organization_subscription_profiles")
      .select("org_id, extra_storage_gb")
      .eq("org_id", data.orgId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Subscription profile was not found for this school.");

    const { error } = await admin
      .from("organization_subscription_profiles")
      .update({ extra_storage_gb: Number(profile.extra_storage_gb ?? 0) + data.storageGb })
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);

    await admin.from("organization_storage_addons").insert({
      org_id: data.orgId,
      user_id: userId,
      provider: "manual",
      storage_gb: data.storageGb,
      status: "recorded",
    });

    return { ok: true, storageGb: data.storageGb };
  });

export const archiveAcademicSessionStorage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      academicYearId: z.string().uuid(),
      storageClass: z.enum(["archive", "deep_archive"]).default("archive"),
      reason: z.string().trim().max(500).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const authContext = context as any;
    const userId = authContext?.userId;
    if (!userId) throw new Error("Authentication context is missing.");
    const org = await getCurrentOrg(authContext);
    if (!["admin", "owner", "super_admin"].includes(String(org.role ?? ""))) {
      throw new Error("Only School Super Admin or School Admin can archive academic sessions.");
    }

    const admin = await adminClient();
    const { data: year, error: yearError } = await admin
      .from("academic_years")
      .select("id, label, start_date, end_date")
      .eq("id", data.academicYearId)
      .eq("org_id", org.org_id)
      .maybeSingle();
    if (yearError) throw new Error(yearError.message);
    if (!year) throw new Error("Academic session was not found.");

    const archiveReason = data.reason || `Archived after session ${year.label} ended`;
    const { data: archived, error } = await admin
      .from("school_storage_objects")
      .update({
        archived_at: new Date().toISOString(),
        archived_by: userId,
        archive_reason: archiveReason,
        archive_storage_class: data.storageClass,
      })
      .eq("org_id", org.org_id)
      .neq("status", "deleted")
      .is("archived_at", null)
      .or(`academic_year_id.eq.${year.id},and(created_at.gte.${year.start_date},created_at.lte.${year.end_date})`)
      .select("id");
    if (error) throw new Error(error.message);

    await admin
      .from("academic_years")
      .update({ status: "archived" })
      .eq("id", year.id)
      .eq("org_id", org.org_id);

    return { ok: true, archivedFiles: archived?.length ?? 0 };
  });

export const createSchoolFileUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      fileName: z.string().min(1).max(180),
      contentType: z.string().min(1).max(160).default("application/octet-stream"),
      sizeBytes: z.number().int().positive().max(MAX_SINGLE_UPLOAD_BYTES),
      category: z.string().min(1).max(60).default("document"),
    }),
  )
  .handler(async ({ data, context }) => {
    const authContext = context as any;
    const userId = authContext?.userId;
    if (!userId) throw new Error("Authentication context is missing.");
    const org = await getCurrentOrg(authContext);
    const planCode = await getOrgPlanCode(org.org_id);
    const quotaGb = (PLAN_STORAGE_GB[planCode] ?? 1) + await getOrgExtraStorageGb(org.org_id);
    const quotaBytes = gbToBytes(quotaGb);
    const usedBytes = await getStorageUsage(org.org_id);

    if (usedBytes + data.sizeBytes > quotaBytes) {
      await notifyStorageThreshold({
        orgId: org.org_id,
        usedBytes,
        quotaBytes,
        percentUsed: 100,
      });
      throw new Error(`Storage quota exceeded. Your current plan allows ${quotaGb} GB. Purchase additional storage or archive inactive academic records before uploading more files.`);
    }

    const admin = await adminClient();
    const objectId = crypto.randomUUID();
    const objectKey = schoolStorageKey(org.org_id, objectId, data.fileName);

    const { error } = await admin.from("school_storage_objects").insert({
      id: objectId,
      org_id: org.org_id,
      uploaded_by: userId,
      bucket: schoolStorageBucket(),
      object_key: objectKey,
      file_name: data.fileName,
      content_type: data.contentType,
      size_bytes: data.sizeBytes,
      category: data.category,
      status: "pending",
    });

    if (error) throw new Error(error.message);

    return {
      id: objectId,
      key: objectKey,
      contentType: data.contentType,
      uploadUrl: await createSchoolUploadUrl({
        key: objectKey,
        contentType: data.contentType,
        sizeBytes: data.sizeBytes,
      }),
    };
  });

export const completeSchoolFileUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const org = await getCurrentOrg(context);
    const admin = await adminClient();

    const { error } = await admin
      .from("school_storage_objects")
      .update({ status: "active", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("org_id", org.org_id);

    if (error) throw new Error(error.message);
    const planCode = await getOrgPlanCode(org.org_id);
    const quotaGb = (PLAN_STORAGE_GB[planCode] ?? 1) + await getOrgExtraStorageGb(org.org_id);
    const quotaBytes = gbToBytes(quotaGb);
    const usedBytes = await getStorageUsage(org.org_id);
    await notifyStorageThreshold({
      orgId: org.org_id,
      usedBytes,
      quotaBytes,
      percentUsed: quotaBytes ? Math.round((usedBytes / quotaBytes) * 100) : 0,
    });
    return { ok: true };
  });

export const createSchoolFileDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const org = await getCurrentOrg(context);
    const admin = await adminClient();

    const { data: file, error } = await admin
      .from("school_storage_objects")
      .select("object_key, file_name")
      .eq("id", data.id)
      .eq("org_id", org.org_id)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!file) throw new Error("File was not found.");

    return {
      url: await createSchoolDownloadUrl(file.object_key, file.file_name),
    };
  });

export const deleteSchoolFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const org = await getCurrentOrg(context);
    const admin = await adminClient();

    const { data: file, error: findError } = await admin
      .from("school_storage_objects")
      .select("object_key")
      .eq("id", data.id)
      .eq("org_id", org.org_id)
      .neq("status", "deleted")
      .maybeSingle();

    if (findError) throw new Error(findError.message);
    if (!file) throw new Error("File was not found.");

    await deleteSchoolStorageObject(file.object_key);

    const { error } = await admin
      .from("school_storage_objects")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("org_id", org.org_id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
