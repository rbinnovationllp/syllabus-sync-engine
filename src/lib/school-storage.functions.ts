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

export const getSchoolStorageDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const org = await getCurrentOrg(context);
    const planCode = await getOrgPlanCode(org.org_id);
    const quotaGb = PLAN_STORAGE_GB[planCode] ?? 1;
    const quotaBytes = gbToBytes(quotaGb);

    const admin = await adminClient();
    const { data: files, error } = await admin
      .from("school_storage_objects")
      .select("id, file_name, content_type, size_bytes, category, status, created_at, completed_at")
      .eq("org_id", org.org_id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return {
      orgId: org.org_id,
      planCode,
      quotaGb,
      quotaBytes,
      usedBytes: await getStorageUsage(org.org_id),
      files: files ?? [],
    };
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
    const org = await getCurrentOrg(context);
    const planCode = await getOrgPlanCode(org.org_id);
    const quotaGb = PLAN_STORAGE_GB[planCode] ?? 1;
    const quotaBytes = gbToBytes(quotaGb);
    const usedBytes = await getStorageUsage(org.org_id);

    if (usedBytes + data.sizeBytes > quotaBytes) {
      throw new Error(`Storage quota exceeded. Your current plan allows ${quotaGb} GB.`);
    }

    const admin = await adminClient();
    const objectId = crypto.randomUUID();
    const objectKey = schoolStorageKey(org.org_id, objectId, data.fileName);

    const { error } = await admin.from("school_storage_objects").insert({
      id: objectId,
      org_id: org.org_id,
      uploaded_by: context.userId,
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
