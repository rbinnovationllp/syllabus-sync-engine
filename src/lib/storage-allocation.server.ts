import { createClient } from "@supabase/supabase-js";

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

type StorageAllocationInput = {
  provider: "stripe" | "razorpay" | "manual" | string;
  userId: string;
  orgId?: string | null;
  priceId?: string | null;
  storageGb: number;
  quantity?: number | null;
  status?: string | null;
  paymentVerified: boolean;
  providerSubscriptionId?: string | null;
  providerPaymentId?: string | null;
  paymentReference?: string | null;
  transactionAmountMinor?: number | null;
  currency?: string | null;
  currentPeriodEnd?: string | null;
  metadata?: Record<string, unknown>;
};

let _supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabaseAdmin as any;
}

async function resolveOrgId(admin: any, userId: string, explicitOrgId?: string | null) {
  if (explicitOrgId) return explicitOrgId;
  const { data } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.org_id ?? null;
}

async function getStorageContext(admin: any, orgId: string, currentAddonId?: string | null) {
  const { data: profile } = await admin
    .from("organization_subscription_profiles")
    .select("plan_code, extra_storage_gb, organizations(name)")
    .eq("org_id", orgId)
    .maybeSingle();

  const planCode = profile?.plan_code ?? "RET-SINGLE";
  let baseStorageGb = PLAN_STORAGE_GB[planCode] ?? 1;
  const { data: catalog } = await admin
    .from("subscription_plan_catalog")
    .select("storage_gb")
    .eq("plan_code", planCode)
    .maybeSingle();
  if (catalog?.storage_gb) baseStorageGb = Number(catalog.storage_gb);

  let query = admin
    .from("organization_storage_addons")
    .select("id, storage_gb")
    .eq("org_id", orgId)
    .in("status", ["active", "trialing"])
    .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`);
  if (currentAddonId) query = query.neq("id", currentAddonId);
  const { data: activeAddons } = await query;

  const activeAddonGb = (activeAddons ?? []).reduce((sum: number, row: any) => sum + Number(row.storage_gb ?? 0), 0);
  const manualExtraGb = Number(profile?.extra_storage_gb ?? 0);
  return {
    planCode,
    schoolName: profile?.organizations?.name ?? "School",
    baseStorageGb,
    existingStorageGb: baseStorageGb + manualExtraGb + activeAddonGb,
  };
}

async function notifySchoolAdmins(admin: any, args: {
  orgId: string;
  storageGb: number;
  previousStorageGb: number;
  newStorageGb: number;
  effectiveAt: string;
}) {
  const { data: admins } = await admin
    .from("org_members")
    .select("user_id, role")
    .eq("org_id", args.orgId)
    .in("role", ["owner", "admin", "super_admin"]);

  const rows = (admins ?? []).map((member: any) => ({
    user_id: member.user_id,
    type: "storage_addon_allocated",
    title: "Additional storage activated",
    body: `${args.storageGb} GB additional storage has been added. Previous limit: ${args.previousStorageGb} GB. New limit: ${args.newStorageGb} GB. Effective: ${new Date(args.effectiveAt).toLocaleString("en-IN")}.`,
    link: "/school-storage",
    severity: "success",
    dedupe_key: `storage-addon:${args.orgId}:${args.storageGb}:${args.effectiveAt.slice(0, 10)}`,
  }));
  if (rows.length) await admin.from("notifications").insert(rows);
}

async function notifyCompanySuperAdmins(admin: any, args: {
  subject: string;
  body: string;
  dedupeKey: string;
}) {
  const { data: superAdmins } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  const rows = (superAdmins ?? []).map((row: any) => ({
    user_id: row.user_id,
    type: "storage_allocation_exception",
    title: args.subject,
    body: args.body,
    link: "/company-crm",
    severity: "error",
    dedupe_key: `${args.dedupeKey}:${row.user_id}`,
  }));
  if (rows.length) await admin.from("notifications").insert(rows);
}

async function createFailureTicket(admin: any, args: {
  orgId: string | null;
  subject: string;
  notes: string;
}) {
  await admin.from("company_crm_support_tickets").insert({
    org_id: args.orgId,
    subject: args.subject,
    priority: "urgent",
    category: "storage_allocation",
    notes: args.notes,
  });
}

async function auditStorageAllocation(admin: any, args: {
  orgId: string | null;
  userId: string | null;
  action: string;
  metadata: Record<string, unknown>;
}) {
  await admin.from("platform_audit_logs").insert({
    org_id: args.orgId,
    user_id: args.userId,
    action: args.action,
    entity_type: "organization_storage_addon",
    entity_id: null,
    metadata: args.metadata,
  });
}

async function recordAllocationEvent(admin: any, args: {
  orgId: string | null;
  userId: string | null;
  schoolName?: string | null;
  provider: string;
  planCode?: string | null;
  existingStorageGb?: number | null;
  storagePurchasedGb: number;
  newStorageGb?: number | null;
  transactionAmountMinor?: number | null;
  currency?: string | null;
  paymentStatus: string;
  paymentReference?: string | null;
  providerSubscriptionId?: string | null;
  providerPaymentId?: string | null;
  systemActionStatus: "pending" | "allocated" | "failed" | "cancelled";
  failureReason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await admin.from("organization_storage_allocation_events").insert({
    org_id: args.orgId,
    user_id: args.userId,
    school_name: args.schoolName,
    provider: args.provider,
    storage_provider: "aws_s3",
    plan_code: args.planCode,
    existing_storage_gb: args.existingStorageGb,
    storage_purchased_gb: args.storagePurchasedGb,
    new_storage_gb: args.newStorageGb,
    transaction_amount_minor: args.transactionAmountMinor ?? null,
    currency: args.currency ?? null,
    payment_status: args.paymentStatus,
    payment_reference: args.paymentReference ?? null,
    provider_subscription_id: args.providerSubscriptionId ?? null,
    provider_payment_id: args.providerPaymentId ?? null,
    system_action_status: args.systemActionStatus,
    failure_reason: args.failureReason ?? null,
    metadata: args.metadata ?? {},
  });
}

export async function handleAutomaticStorageAllocation(input: StorageAllocationInput) {
  const admin = getSupabaseAdmin();
  const totalStorageGb = Number(input.storageGb) * Number(input.quantity ?? 1);
  const now = new Date().toISOString();
  const orgId = await resolveOrgId(admin, input.userId, input.orgId);
  if (!orgId) {
    await recordAllocationEvent(admin, {
      orgId: null,
      userId: input.userId,
      provider: input.provider,
      storagePurchasedGb: totalStorageGb,
      transactionAmountMinor: input.transactionAmountMinor ?? null,
      currency: input.currency ?? null,
      paymentStatus: input.paymentVerified ? "paid" : input.status ?? "pending",
      paymentReference: input.paymentReference,
      providerSubscriptionId: input.providerSubscriptionId,
      providerPaymentId: input.providerPaymentId,
      systemActionStatus: "failed",
      failureReason: "No school organization was found for this storage purchase user.",
      metadata: input.metadata,
    });
    await createFailureTicket(admin, {
      orgId: null,
      subject: "Automatic storage allocation failed",
      notes: `No school organization was found for user ${input.userId}. Payment reference: ${input.paymentReference ?? input.providerSubscriptionId ?? "unknown"}.`,
    });
    await notifyCompanySuperAdmins(admin, {
      subject: "Storage allocation failed",
      body: `No school organization was found for a ${totalStorageGb} GB storage purchase.`,
      dedupeKey: `storage-allocation-failed:no-org:${input.paymentReference ?? input.providerSubscriptionId ?? now}`,
    });
    return { ok: false, error: "No school organization was found." };
  }

  try {
    const lookupColumn = input.provider === "razorpay" ? "razorpay_subscription_id" : "stripe_subscription_id";
    let existing: any = null;
    if (input.providerSubscriptionId) {
      const { data } = await admin
        .from("organization_storage_addons")
        .select("id, status, allocated_at, storage_gb")
        .eq(lookupColumn, input.providerSubscriptionId)
        .maybeSingle();
      existing = data ?? null;
    }

    const context = await getStorageContext(admin, orgId, existing?.id ?? null);
    const previousStorageGb = context.existingStorageGb;
    const newStorageGb = previousStorageGb + totalStorageGb;
    const rawStatus = input.status ?? "pending_payment";
    const status = input.paymentVerified ? "active" : rawStatus;
    const allocationStatus = input.paymentVerified
      ? "allocated"
      : ["canceled", "cancelled", "refunded", "halted"].includes(String(rawStatus).toLowerCase())
        ? "cancelled"
        : "pending";

    const payload: Record<string, any> = {
      org_id: orgId,
      user_id: input.userId,
      provider: input.provider,
      storage_gb: totalStorageGb,
      status,
      current_period_end: input.currentPeriodEnd ?? null,
      payment_reference: input.paymentReference ?? null,
      transaction_amount_minor: input.transactionAmountMinor ?? null,
      currency: input.currency ?? null,
      allocation_status: allocationStatus,
      previous_storage_gb: input.paymentVerified ? previousStorageGb : null,
      new_storage_gb: input.paymentVerified ? newStorageGb : null,
      allocation_error: null,
      updated_at: now,
    };
    if (input.provider === "razorpay") {
      payload.razorpay_subscription_id = input.providerSubscriptionId ?? null;
      payload.razorpay_payment_id = input.providerPaymentId ?? null;
    } else {
      payload.stripe_subscription_id = input.providerSubscriptionId ?? null;
      payload.stripe_price_id = input.priceId ?? null;
    }
    if (input.paymentVerified && !existing?.allocated_at) payload.allocated_at = now;

    if (existing?.id) {
      await admin.from("organization_storage_addons").update(payload).eq("id", existing.id);
    } else {
      await admin.from("organization_storage_addons").insert(payload);
    }

    await recordAllocationEvent(admin, {
      orgId,
      userId: input.userId,
      schoolName: context.schoolName,
      provider: input.provider,
      planCode: context.planCode,
      existingStorageGb: input.paymentVerified ? previousStorageGb : null,
      storagePurchasedGb: totalStorageGb,
      newStorageGb: input.paymentVerified ? newStorageGb : null,
      transactionAmountMinor: input.transactionAmountMinor ?? null,
      currency: input.currency ?? null,
      paymentStatus: input.paymentVerified ? "paid" : status,
      paymentReference: input.paymentReference,
      providerSubscriptionId: input.providerSubscriptionId,
      providerPaymentId: input.providerPaymentId,
      systemActionStatus: allocationStatus,
      metadata: input.metadata,
    });

    if (input.paymentVerified && !existing?.allocated_at) {
      await notifySchoolAdmins(admin, { orgId, storageGb: totalStorageGb, previousStorageGb, newStorageGb, effectiveAt: now });
      await auditStorageAllocation(admin, {
        orgId,
        userId: input.userId,
        action: "storage.addon.allocated",
        metadata: {
          provider: input.provider,
          storageGb: totalStorageGb,
          previousStorageGb,
          newStorageGb,
          paymentReference: input.paymentReference,
          transactionAmountMinor: input.transactionAmountMinor,
          currency: input.currency,
        },
      });
    }

    return { ok: true, orgId, storageGb: totalStorageGb, previousStorageGb, newStorageGb };
  } catch (error: any) {
    const message = error?.message ?? "Unknown storage allocation failure";
    await recordAllocationEvent(admin, {
      orgId,
      userId: input.userId,
      provider: input.provider,
      storagePurchasedGb: totalStorageGb,
      transactionAmountMinor: input.transactionAmountMinor ?? null,
      currency: input.currency ?? null,
      paymentStatus: input.paymentVerified ? "paid" : input.status ?? "pending",
      paymentReference: input.paymentReference,
      providerSubscriptionId: input.providerSubscriptionId,
      providerPaymentId: input.providerPaymentId,
      systemActionStatus: "failed",
      failureReason: message,
      metadata: input.metadata,
    });
    await createFailureTicket(admin, {
      orgId,
      subject: "Automatic storage allocation failed",
      notes: `Storage purchase could not be allocated automatically. School ID: ${orgId}. Storage: ${totalStorageGb} GB. Payment reference: ${input.paymentReference ?? input.providerSubscriptionId ?? "unknown"}. Error: ${message}`,
    });
    await notifyCompanySuperAdmins(admin, {
      subject: "Storage allocation failed",
      body: `${totalStorageGb} GB storage purchase could not be allocated automatically. Please review Company CRM.`,
      dedupeKey: `storage-allocation-failed:${orgId}:${input.paymentReference ?? input.providerSubscriptionId ?? now}`,
    });
    await auditStorageAllocation(admin, {
      orgId,
      userId: input.userId,
      action: "storage.addon.failed",
      metadata: { provider: input.provider, storageGb: totalStorageGb, error: message, paymentReference: input.paymentReference },
    });
    return { ok: false, orgId, error: message };
  }
}
