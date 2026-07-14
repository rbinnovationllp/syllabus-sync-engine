import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SECURITY_ASSURANCE =
  "All school data stored within Syllabus Synk is protected using industry-standard security practices, access controls, encryption, monitoring, and backup systems. Each school's data remains isolated and confidential. The platform is designed to prevent unauthorized access, cross-school visibility, and accidental disclosure of information. School data remains the property of the respective institution.";

type KnowledgeSource = {
  source_key: string;
  title: string;
  category: string;
  content: string;
  critical: boolean;
  validation_status: "validated" | "needs_review" | "failed";
  validation_notes?: string | null;
};

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertCompanySuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((row: { role: string }) => row.role === "super_admin")) {
    throw new Error("Only Company Super Admin can manage Ask SynkAI knowledge.");
  }
}

async function hashContent(content: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(content).digest("hex");
}

function validateSource(source: KnowledgeSource): KnowledgeSource {
  const hasContent = source.content.trim().length >= 80;
  const mentionsSupport = source.content.includes("support@syllabus-synk.in") || source.category !== "support";
  return {
    ...source,
    validation_status: hasContent && mentionsSupport ? source.validation_status : "needs_review",
    validation_notes: hasContent
      ? source.validation_notes ?? null
      : "Content is too short for reliable indexing.",
  };
}

async function readOptionalFile(fileName: string) {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    return await readFile(join(process.cwd(), fileName), "utf8");
  } catch {
    return "";
  }
}

export async function buildAskSynkaiKnowledgeSources(): Promise<KnowledgeSource[]> {
  const [projectStatus, pricing, readiness] = await Promise.all([
    readOptionalFile("PROJECT_STATUS.md"),
    readOptionalFile("ONE_PAGE_PRICING.md"),
    readOptionalFile("PRODUCTION_READINESS_REVIEW.md"),
  ]);

  const privacyFramework = `
School Data Privacy, Security & Confidentiality Framework

School data ownership:
- All academic, administrative, student, teacher, examination, and operational data uploaded by a school remains the property of that school.
- Syllabus Synk acts only as a technology platform and custodian of the data.
- The company shall not sell, share, distribute, or use school data for commercial purposes without explicit authorization.

Data isolation:
- Each school's data must be logically separated from every other school's data.
- Users of one school must never be able to view, access, search, export, or retrieve another school's information.
- Tenant isolation must be enforced across platform modules.

Role-based access:
- Teachers should only see information relevant to assigned classes and subjects.
- Principals, Coordinators, and School Super Admins receive access according to administrative responsibilities.
- Company administrator access is limited to authorized support, troubleshooting, or maintenance and should be recorded in audit logs.

Security:
- Sensitive data should be encrypted in transit and at rest using industry-standard cloud, database, and storage practices.
- Critical actions including login attempts, data modifications, exports, permission changes, and administrative access should be logged.
- Regular backups and recovery procedures should reduce accidental-deletion, failure, and disaster risk.
- Exports should be permission-controlled, scoped, and audit-tracked.

School assurance statement:
"${SECURITY_ASSURANCE}"
`;

  const supportEscalation = `
Ask SynkAI support escalation policy:
- Ask SynkAI should answer from approved platform knowledge only.
- If a user asks something beyond the indexed knowledge base, Ask SynkAI should reply passively and honestly, then escalate the question to the Syllabus Synk support queue for review by the team at support@syllabus-synk.in.
- The answer should not invent unknown features, policies, prices, permissions, legal claims, or implementation promises.
- Escalated questions should become support tickets so the Company Super Admin team can review whether the knowledge base needs an update.
`;

  return [
    {
      source_key: "project-status",
      title: "Living Project Status",
      category: "platform",
      content: projectStatus || "PROJECT_STATUS.md was not available during indexing.",
      critical: false,
      validation_status: projectStatus ? "validated" : "needs_review",
    },
    {
      source_key: "one-page-pricing",
      title: "Subscription Pricing and Add-ons",
      category: "pricing",
      content: pricing || "ONE_PAGE_PRICING.md was not available during indexing.",
      critical: true,
      validation_status: pricing ? "validated" : "needs_review",
    },
    {
      source_key: "production-readiness-review",
      title: "Production Readiness Review",
      category: "release-readiness",
      content: readiness || "PRODUCTION_READINESS_REVIEW.md was not available during indexing.",
      critical: true,
      validation_status: readiness ? "validated" : "needs_review",
    },
    {
      source_key: "school-data-security-framework",
      title: "School Data Privacy, Security & Confidentiality Framework",
      category: "privacy-security",
      content: privacyFramework,
      critical: true,
      validation_status: "validated",
    },
    {
      source_key: "support-escalation-policy",
      title: "Ask SynkAI Unknown Question Escalation Policy",
      category: "support",
      content: supportEscalation,
      critical: false,
      validation_status: "validated",
    },
  ].map(validateSource);
}

export async function getApprovedAskSynkaiKnowledge() {
  const admin = await adminClient();
  const { data, error } = await admin
    .from("ask_synkai_knowledge_sources")
    .select("source_key, title, category, content, indexed_at, approved_at")
    .eq("status", "approved")
    .eq("validation_status", "validated")
    .order("category", { ascending: true })
    .order("title", { ascending: true });
  if (error) return "";
  return (data ?? [])
    .map((row: any) => `Knowledge source: ${row.title} (${row.category})\n${row.content}`)
    .join("\n\n---\n\n")
    .slice(0, 36000);
}

export async function escalateAskSynkaiUnknownQuestion(args: {
  question: string;
  page?: string | null;
  answer?: string | null;
}) {
  const admin = await adminClient();
  await admin.from("company_crm_support_tickets").insert({
    subject: `Ask SynkAI knowledge review: ${args.question.slice(0, 140)}`,
    priority: "normal",
    category: "ask_synkai_knowledge_review",
    notes: [
      `Question: ${args.question}`,
      args.page ? `Page: ${args.page}` : "",
      args.answer ? `Assistant response: ${args.answer}` : "",
      "Please review this matter for support@syllabus-synk.in and update/approve Ask SynkAI knowledge if required.",
    ].filter(Boolean).join("\n\n"),
  });
}

export const refreshAskSynkaiKnowledgeBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const authContext = context as any;
    await assertCompanySuperAdmin(authContext);
    const admin = await adminClient();
    const sources = await buildAskSynkaiKnowledgeSources();
    let approvedCount = 0;
    let pendingCount = 0;

    for (const source of sources) {
      const contentHash = await hashContent(source.content);
      const { data: existing } = await admin
        .from("ask_synkai_knowledge_sources")
        .select("id, content_hash, status")
        .eq("source_key", source.source_key)
        .maybeSingle();

      const unchangedApproved = existing?.content_hash === contentHash && existing?.status === "approved";
      const status = unchangedApproved || (!source.critical && source.validation_status === "validated")
        ? "approved"
        : "pending";
      if (status === "approved") approvedCount += 1;
      if (status === "pending") pendingCount += 1;

      const payload = {
        ...source,
        content_hash: contentHash,
        status,
        indexed_at: new Date().toISOString(),
        approved_at: status === "approved" ? new Date().toISOString() : null,
        approved_by: status === "approved" ? authContext.userId : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await admin
        .from("ask_synkai_knowledge_sources")
        .upsert(payload, { onConflict: "source_key" });
      if (error) throw new Error(error.message);
    }

    const { data: run, error } = await admin
      .from("ask_synkai_knowledge_sync_runs")
      .insert({
        triggered_by: authContext.userId,
        trigger_type: "manual",
        status: pendingCount ? "partial" : "success",
        sources_indexed: sources.length,
        approved_count: approvedCount,
        pending_count: pendingCount,
        rejected_count: 0,
        notes: pendingCount
          ? "Critical or changed knowledge sources are pending Company Super Admin approval."
          : "All indexed sources are approved and available to Ask SynkAI.",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return run;
  });

export const listAskSynkaiKnowledgeBase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const authContext = context as any;
    await assertCompanySuperAdmin(authContext);
    const admin = await adminClient();
    const [sources, runs] = await Promise.all([
      admin
        .from("ask_synkai_knowledge_sources")
        .select("id, source_key, title, category, status, critical, validation_status, validation_notes, indexed_at, approved_at, content")
        .order("indexed_at", { ascending: false }),
      admin
        .from("ask_synkai_knowledge_sync_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (sources.error) throw new Error(sources.error.message);
    if (runs.error) throw new Error(runs.error.message);
    const rows = sources.data ?? [];
    return {
      sources: rows.map((row: any) => ({
        ...row,
        preview: String(row.content ?? "").slice(0, 800),
      })),
      runs: runs.data ?? [],
      summary: {
        total: rows.length,
        approved: rows.filter((row: any) => row.status === "approved").length,
        pending: rows.filter((row: any) => row.status === "pending").length,
        criticalPending: rows.filter((row: any) => row.status === "pending" && row.critical).length,
      },
    };
  });

export const approveAskSynkaiKnowledgeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const authContext = context as any;
    await assertCompanySuperAdmin(authContext);
    const admin = await adminClient();
    const { error } = await admin
      .from("ask_synkai_knowledge_sources")
      .update({
        status: "approved",
        validation_status: "validated",
        approved_at: new Date().toISOString(),
        approved_by: authContext.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
