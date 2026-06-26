import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { requireOrgFeature } from "@/lib/plan-entitlements";

async function getCurrentOrg(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("org_members")
    .select("org_id, role, organizations(id, name)")
    .eq("user_id", context.userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.org_id) throw new Error("Create or join a school profile before using School CRM.");
  return { orgId: data.org_id as string, role: data.role as string, orgName: (data.organizations as any)?.name ?? "Your school" };
}

const contactSchema = z.object({
  contact_type: z.enum(["parent", "admission", "vendor", "alumni", "other"]).default("parent"),
  full_name: z.string().trim().min(1).max(160),
  relationship: z.string().trim().max(80).optional().nullable(),
  student_name: z.string().trim().max(160).optional().nullable(),
  grade: z.string().trim().max(40).optional().nullable(),
  section: z.string().trim().max(40).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  notes: z.string().trim().max(2500).optional().nullable(),
});

const enquirySchema = z.object({
  guardian_name: z.string().trim().min(1).max(160),
  student_name: z.string().trim().max(160).optional().nullable(),
  grade_interest: z.string().trim().max(60).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  source: z.string().trim().max(80).optional().nullable(),
  status: z.enum(["new","contacted","visit_scheduled","application","admitted","lost"]).default("new"),
  next_follow_up_at: z.string().optional().nullable(),
  notes: z.string().trim().max(2500).optional().nullable(),
});

const interactionSchema = z.object({
  target_type: z.enum(["contact", "enquiry"]),
  target_id: z.string().uuid(),
  interaction_type: z.enum(["call","whatsapp","email","meeting","ptm","task","note"]).default("note"),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().max(3000).optional().nullable(),
  due_at: z.string().optional().nullable(),
});

export const getSchoolCrmDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOrgFeature(context.supabase, context.userId, "school_crm");
    const org = await getCurrentOrg(context);
    const [contacts, enquiries, followups] = await Promise.all([
      context.supabase.from("school_crm_contacts").select("id, contact_type, created_at").eq("org_id", org.orgId).limit(1000),
      context.supabase.from("school_crm_enquiries").select("id, status, created_at").eq("org_id", org.orgId).limit(1000),
      context.supabase.from("school_crm_interactions").select("*").eq("org_id", org.orgId).is("completed_at", null).order("due_at", { ascending: true }).limit(10),
    ]);
    if (contacts.error) throw new Error(contacts.error.message);
    if (enquiries.error) throw new Error(enquiries.error.message);
    if (followups.error) throw new Error(followups.error.message);
    return {
      orgName: org.orgName,
      counts: {
        contacts: contacts.data?.length ?? 0,
        enquiries: enquiries.data?.length ?? 0,
        admitted: (enquiries.data ?? []).filter((e: any) => e.status === "admitted").length,
        openFollowups: followups.data?.length ?? 0,
      },
      followups: followups.data ?? [],
    };
  });

export const listSchoolCrmContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOrgFeature(context.supabase, context.userId, "school_crm");
    const org = await getCurrentOrg(context);
    const { data, error } = await context.supabase
      .from("school_crm_contacts")
      .select("*")
      .eq("org_id", org.orgId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSchoolCrmContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => contactSchema.parse(d))
  .handler(async ({ context, data }) => {
    await requireOrgFeature(context.supabase, context.userId, "school_crm");
    const org = await getCurrentOrg(context);
    const { data: row, error } = await context.supabase
      .from("school_crm_contacts")
      .insert({ ...data, org_id: org.orgId, email: data.email || null, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listSchoolCrmEnquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOrgFeature(context.supabase, context.userId, "school_crm");
    const org = await getCurrentOrg(context);
    const { data, error } = await context.supabase
      .from("school_crm_enquiries")
      .select("*")
      .eq("org_id", org.orgId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSchoolCrmEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => enquirySchema.parse(d))
  .handler(async ({ context, data }) => {
    await requireOrgFeature(context.supabase, context.userId, "school_crm");
    const org = await getCurrentOrg(context);
    const { data: row, error } = await context.supabase
      .from("school_crm_enquiries")
      .insert({ ...data, org_id: org.orgId, email: data.email || null, created_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateSchoolCrmEnquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["new","contacted","visit_scheduled","application","admitted","lost"]),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await requireOrgFeature(context.supabase, context.userId, "school_crm");
    const org = await getCurrentOrg(context);
    const { error } = await context.supabase
      .from("school_crm_enquiries")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("org_id", org.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createSchoolCrmInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => interactionSchema.parse(d))
  .handler(async ({ context, data }) => {
    await requireOrgFeature(context.supabase, context.userId, "school_crm");
    const org = await getCurrentOrg(context);
    const payload: Record<string, any> = {
      org_id: org.orgId,
      interaction_type: data.interaction_type,
      subject: data.subject,
      body: data.body ?? null,
      due_at: data.due_at ?? null,
      created_by: context.userId,
    };
    payload[data.target_type === "contact" ? "contact_id" : "enquiry_id"] = data.target_id;
    const { data: row, error } = await context.supabase
      .from("school_crm_interactions")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const completeSchoolCrmInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireOrgFeature(context.supabase, context.userId, "school_crm");
    const org = await getCurrentOrg(context);
    const { error } = await context.supabase
      .from("school_crm_interactions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("org_id", org.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

