import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgFeature } from "@/lib/plan-entitlements";

const REQUEST_COSTS: Record<string, number> = {
  simple_activity: 1,
  detailed_activity_plan: 2,
  complete_teaching_toolkit: 5,
  project_based_learning_plan: 5,
  multi_day_activity_module: 10,
  explain_full_topic: 2,
  explain_selected_portion: 2,
  activity_support: 2,
  real_life_examples: 1,
  teacher_notes: 2,
  student_question_help: 2,
  beyond_textbook_explanation: 3,
  revision_summary: 1,
};

const REQUEST_LABELS: Record<string, string> = {
  simple_activity: "Simple Activity Suggestion",
  detailed_activity_plan: "Detailed Activity Plan",
  complete_teaching_toolkit: "Complete Teaching Toolkit",
  project_based_learning_plan: "Project-Based Learning Plan",
  multi_day_activity_module: "Multi-Day Activity Module",
  explain_full_topic: "Explain Full Topic",
  explain_selected_portion: "Explain Selected Portion",
  activity_support: "Activity-Based Teaching Support",
  real_life_examples: "Real-Life Example Mode",
  teacher_notes: "Generate Teacher Notes",
  student_question_help: "Student Question Help",
  beyond_textbook_explanation: "Beyond Textbook Explanation",
  revision_summary: "Revision Summary",
};

type Membership = { org_id: string; role: string };

function monthStart(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), 1).toISOString().slice(0, 10);
}

function isAdminRole(role: string) {
  return ["owner", "admin", "super_admin"].includes(role);
}

async function loadMembership(supabase: any, userId: string): Promise<Membership> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No school workspace membership found.");
  return data;
}

async function assertOrgMember(supabase: any, userId: string, orgId: string) {
  const { data, error } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("The selected user is not a member of this school workspace.");
  return data.role as string;
}

async function currentAllocation(admin: any, orgId: string, teacherUserId: string, periodMonth: string) {
  const { data, error } = await admin
    .from("ai_teaching_credit_allocations")
    .select("*")
    .eq("org_id", orgId)
    .eq("teacher_user_id", teacherUserId)
    .eq("period_month", periodMonth)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function ensureCreditPool(admin: any, orgId: string, periodMonth: string, userId?: string | null) {
  const { data: existing, error: loadError } = await admin
    .from("ai_teaching_credit_pools")
    .select("*")
    .eq("org_id", orgId)
    .eq("period_month", periodMonth)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (existing) return existing;
  const { data, error } = await admin
    .from("ai_teaching_credit_pools")
    .insert({
      org_id: orgId,
      period_month: periodMonth,
      monthly_base_credits: 100,
      purchased_credits: 0,
      allocated_credits: 0,
      used_credits: 0,
      updated_by: userId ?? null,
      notes: "Default monthly AI Teaching Credit pool created automatically.",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function refreshPoolUsage(admin: any, orgId: string, periodMonth: string, userId?: string | null) {
  const { data: allocations, error } = await admin
    .from("ai_teaching_credit_allocations")
    .select("allocated_credits, used_credits")
    .eq("org_id", orgId)
    .eq("period_month", periodMonth);
  if (error) throw new Error(error.message);
  const allocated = (allocations ?? []).reduce((sum: number, row: any) => sum + Number(row.allocated_credits ?? 0), 0);
  const used = (allocations ?? []).reduce((sum: number, row: any) => sum + Number(row.used_credits ?? 0), 0);
  const { data, error: updateError } = await admin
    .from("ai_teaching_credit_pools")
    .update({ allocated_credits: allocated, used_credits: used, updated_by: userId ?? null })
    .eq("org_id", orgId)
    .eq("period_month", periodMonth)
    .select()
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  return data;
}

async function recordTransaction(admin: any, args: {
  orgId: string;
  teacherUserId: string;
  allocationId?: string | null;
  generationId?: string | null;
  transactionType: "allocation" | "increase" | "decrease" | "consume" | "refund" | "reuse";
  credits: number;
  balanceAfter?: number | null;
  notes?: string | null;
  createdBy?: string | null;
}) {
  await admin.from("ai_teaching_credit_transactions").insert({
    org_id: args.orgId,
    teacher_user_id: args.teacherUserId,
    allocation_id: args.allocationId ?? null,
    generation_id: args.generationId ?? null,
    transaction_type: args.transactionType,
    credits: args.credits,
    balance_after: args.balanceAfter ?? null,
    notes: args.notes ?? null,
    created_by: args.createdBy ?? null,
  });
}

function buildOfflineTeachingPlan(input: z.infer<typeof generateTeachingSuggestionSchema>) {
  const label = REQUEST_LABELS[input.request_type];
  const grade = input.grade || "the selected class";
  const subject = input.subject;
  const topic = input.topic;
  const localContext = input.local_context || "the school campus and local community";
  const objective = input.learning_objective || `students understand ${topic} through practical, age-appropriate learning`;

  const sections = [
    `${label}: ${topic}`,
    `Class/Subject: ${grade} ${subject}`,
    `Learning objective: ${objective}`,
    "",
    "Concept explanation beyond the textbook:",
    `Start with one familiar situation from ${localContext}. Ask students what they already notice, then connect their answers to the textbook concept in simple language.`,
    "",
    "Activity-based methods:",
    `1. Observation activity: Students identify examples of ${topic} around the classroom, campus, home, or neighbourhood.`,
    `2. Think-pair-share: Students explain the idea to a partner using their own words, then share one practical example.`,
    `3. Quick challenge: Give a small problem or scenario where students must apply ${topic} instead of repeating the definition.`,
    "",
    "Classroom demonstration:",
    `Use low-cost materials available in school to demonstrate ${topic}. Keep the demonstration short, then ask students to predict, observe, and explain what happened.`,
    "",
    "Story-based explanation:",
    `Create a short story in which a student faces a real-life situation connected to ${topic}. Pause the story twice and ask the class what the character should do next.`,
    "",
    "Role-play or group activity:",
    `Divide students into small groups. Each group represents one part, stakeholder, step, or viewpoint connected to ${topic}. Ask them to act, arrange, compare, or defend their role.`,
    "",
    "Real-world application:",
    `Discuss how ${topic} appears in daily life, future careers, local issues, technology, environment, business, or public services depending on the subject.`,
    "",
    "Visual learning idea:",
    "Use a mind map, labelled diagram, timeline, flow chart, classroom board sketch, object sorting chart, or before/after comparison.",
    "",
    "Interactive exercise:",
    "End with an exit ticket: one thing learned, one example, and one question still unclear.",
  ];

  if (input.request_type === "complete_teaching_toolkit") {
    sections.push(
      "",
      "Complete toolkit additions:",
      "- 5-minute warm-up question",
      "- 15-minute guided explanation",
      "- 20-minute activity or demonstration",
      "- 10-minute worksheet/checkpoint",
      "- 5-minute exit ticket",
      "- Homework: one observation, one application question, and one reflection.",
    );
  }
  if (input.request_type === "project_based_learning_plan") {
    sections.push(
      "",
      "Project-based learning plan:",
      `Students create a mini-project showing how ${topic} works in a real place, problem, product, map, survey, model, story, experiment, or presentation.`,
      "Assessment: clarity of concept, evidence collected, teamwork, creativity, and practical connection.",
    );
  }
  if (input.request_type === "multi_day_activity_module") {
    sections.push(
      "",
      "Multi-day module:",
      "Day 1: concept introduction and prior-knowledge check.",
      "Day 2: demonstration and guided practice.",
      "Day 3: group activity or field/campus observation.",
      "Day 4: project/presentation preparation.",
      "Day 5: presentation, reflection, short assessment, and remediation.",
    );
  }

  return sections.join("\n");
}

function buildSyllabusAwarePlan(input: z.infer<typeof syllabusAwareHelpSchema>) {
  const label = REQUEST_LABELS[input.request_type];
  const topic = input.selected_portion || input.topic;
  const grade = input.grade || "the selected class";
  const objectives = (input.learning_objectives ?? []).length
    ? input.learning_objectives.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : `Students should understand ${topic} clearly and apply it in age-appropriate situations.`;
  const header = [
    `${label}: ${topic}`,
    `Class/Subject: ${grade} ${input.subject}`,
    `Board: ${input.board || "school curriculum"}`,
    `Book: ${input.book || "prescribed book"}`,
    `Chapter: ${input.chapter || "planned chapter"}`,
    `Scheduled date: ${input.planned_date || "today"}`,
  ].join("\n");

  if (input.request_type === "explain_selected_portion") {
    return [
      header,
      "",
      "Focused explanation:",
      `Explain only this selected portion: ${input.selected_portion || input.topic}.`,
      "1. Start with the exact meaning in simple student-friendly language.",
      "2. Break the idea into small steps or parts.",
      "3. Add one diagram, formula, definition, paragraph, or heading explanation where relevant.",
      "4. Give one quick check question to confirm understanding.",
    ].join("\n");
  }
  if (input.request_type === "student_question_help") {
    return [
      header,
      "",
      "Student question:",
      input.student_question || "A student asked a question related to this topic beyond the prescribed book.",
      "",
      "Curriculum-aligned answer:",
      "Answer the question in simple language, connect it back to the planned chapter, and avoid going beyond the maturity level of the class.",
      `Suggested response: This question is connected to ${input.topic}. Let us understand the basic idea first, then see how it appears in real life.`,
      "",
      "Teacher caution:",
      "If the answer requires advanced details, give a short age-appropriate explanation and tell students they will study the deeper version in higher classes.",
    ].join("\n");
  }
  if (input.request_type === "real_life_examples") {
    return [
      header,
      "",
      "Real-life examples:",
      `1. Home example connected to ${topic}.`,
      `2. School campus example connected to ${topic}.`,
      `3. Local community example connected to ${topic}.`,
      `4. Future career or technology example connected to ${topic}.`,
      "",
      "Classroom prompt:",
      "Ask students to share one example they have personally seen.",
    ].join("\n");
  }
  if (input.request_type === "revision_summary") {
    return [
      header,
      "",
      "Revision summary:",
      `- Main idea: ${topic}`,
      "- Key terms: identify 3-5 important words from the lesson.",
      "- Remember: connect the definition with one example.",
      "- Quick oral questions: What is it? Why does it matter? Where do we see it?",
      "- Exit ticket: write one point learned and one doubt.",
    ].join("\n");
  }
  if (input.request_type === "teacher_notes") {
    return [
      header,
      "",
      "Teacher notes:",
      objectives,
      "",
      "Opening question:",
      `What do students already know about ${topic}?`,
      "",
      "Discussion points:",
      `- Why ${topic} matters.`,
      "- Common misconception to watch for.",
      "- One local example.",
      "- One short assessment question.",
      "",
      "Board work:",
      "Write key terms, one diagram/flow, and one example.",
    ].join("\n");
  }
  if (input.request_type === "beyond_textbook_explanation") {
    return [
      header,
      "",
      "Additional explanation beyond the prescribed book:",
      `Give a broader conceptual understanding of ${topic} while staying aligned with the planned syllabus and class level.`,
      "Supplementary learning ideas:",
      "- Use an analogy from daily life.",
      "- Compare the concept with a related idea already learned.",
      "- Add a mini observation task.",
      "- Ask one higher-order question without making the lesson too advanced.",
    ].join("\n");
  }

  return buildOfflineTeachingPlan({
    academic_year_id: input.academic_year_id,
    grade: input.grade,
    subject: input.subject,
    chapter: input.chapter,
    topic,
    sub_topic: input.selected_portion,
    learning_objective: (input.learning_objectives ?? []).join("; "),
    local_context: input.local_context || input.board || input.book || null,
    teacher_note: input.student_question || null,
    request_type: input.request_type === "activity_support" ? "detailed_activity_plan" : "detailed_activity_plan",
  });
}

async function aiTeachingPlan(input: z.infer<typeof generateTeachingSuggestionSchema>) {
  const apiKey = process.env.OPENAI_API_KEY;
  const modelId = process.env.OPENAI_MODEL;
  if (!apiKey || !modelId) return null;
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const { generateText } = await import("ai");
  const provider = createOpenAICompatible({
    name: "teaching-assistant",
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKey,
  });
  const system = [
    "You are Ask SynkAI Teaching Assistant for K-12 schools.",
    "Generate age-appropriate, curriculum-aligned, activity-based teaching ideas that go beyond textbook repetition.",
    "Include practical examples, classroom demonstrations, stories, role-play, group work, projects, local examples, real-world applications, visual ideas, and interactive checks.",
    "Keep safety, feasibility, low-cost materials, and teacher review in mind.",
    "Return plain text with clear headings. Do not include unsafe experiments or unverified external links.",
  ].join(" ");
  const prompt = [
    `Request type: ${REQUEST_LABELS[input.request_type]}`,
    `Class/Grade: ${input.grade || "not specified"}`,
    `Subject: ${input.subject}`,
    `Chapter: ${input.chapter || "not specified"}`,
    `Topic: ${input.topic}`,
    `Sub-topic: ${input.sub_topic || "not specified"}`,
    `Learning objective: ${input.learning_objective || "not specified"}`,
    `Local context: ${input.local_context || "school/local environment"}`,
    `Teacher note: ${input.teacher_note || "none"}`,
  ].join("\n");
  const result = await generateText({ model: provider.chatModel(modelId), system, prompt });
  return result.text;
}

async function aiSyllabusAwarePlan(input: z.infer<typeof syllabusAwareHelpSchema>) {
  const apiKey = process.env.OPENAI_API_KEY;
  const modelId = process.env.OPENAI_MODEL;
  if (!apiKey || !modelId) return null;
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const { generateText } = await import("ai");
  const provider = createOpenAICompatible({
    name: "syllabus-aware-teaching-assistant",
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKey,
  });
  const system = [
    "You are Ask SynkAI Teaching Assistant integrated with Syllabus Synk daily lesson plans.",
    "Use the provided class, subject, board, book, chapter, topic, learning objectives, and academic calendar context automatically.",
    "Do not ask the teacher to re-enter chapter details already provided.",
    "Stay aligned with the curriculum and student grade level while helping the teacher go beyond textbook repetition.",
    "Return plain text with clear headings, teacher-ready notes, and classroom-safe suggestions.",
  ].join(" ");
  const prompt = [
    `Mode: ${REQUEST_LABELS[input.request_type]}`,
    `Scheduled date: ${input.planned_date || "today"}`,
    `Class: ${input.grade || "-"}${input.section ? `-${input.section}` : ""}`,
    `Subject: ${input.subject}`,
    `Board: ${input.board || "-"}`,
    `Book: ${input.book || "-"}`,
    `Chapter: ${input.chapter || "-"}`,
    `Topic: ${input.topic}`,
    `Learning objectives: ${(input.learning_objectives ?? []).join("; ") || "-"}`,
    `Selected portion: ${input.selected_portion || "-"}`,
    `Student question: ${input.student_question || "-"}`,
    `Local context: ${input.local_context || "-"}`,
  ].join("\n");
  const result = await generateText({ model: provider.chatModel(modelId), system, prompt });
  return result.text;
}

const allocateSchema = z.object({
  teacher_user_id: z.string().uuid(),
  allocated_credits: z.coerce.number().int().min(0).max(100000),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const generateTeachingSuggestionSchema = z.object({
  academic_year_id: z.string().uuid().optional().nullable(),
  grade: z.string().trim().max(40).optional().nullable(),
  subject: z.string().trim().min(1).max(120),
  chapter: z.string().trim().max(200).optional().nullable(),
  topic: z.string().trim().min(1).max(200),
  sub_topic: z.string().trim().max(200).optional().nullable(),
  learning_objective: z.string().trim().max(1000).optional().nullable(),
  local_context: z.string().trim().max(1000).optional().nullable(),
  teacher_note: z.string().trim().max(1600).optional().nullable(),
  request_type: z.enum([
    "simple_activity",
    "detailed_activity_plan",
    "complete_teaching_toolkit",
    "project_based_learning_plan",
    "multi_day_activity_module",
  ]),
});

const syllabusAwareHelpSchema = z.object({
  academic_year_id: z.string().uuid().optional().nullable(),
  teacher_assignment_id: z.string().uuid().optional().nullable(),
  planned_date: z.string().optional().nullable(),
  grade: z.string().trim().max(40).optional().nullable(),
  section: z.string().trim().max(40).optional().nullable(),
  subject: z.string().trim().min(1).max(120),
  board: z.string().trim().max(120).optional().nullable(),
  book: z.string().trim().max(300).optional().nullable(),
  chapter: z.string().trim().max(220).optional().nullable(),
  topic: z.string().trim().min(1).max(220),
  learning_objectives: z.array(z.string().trim().max(500)).max(10).optional().default([]),
  selected_portion: z.string().trim().max(1600).optional().nullable(),
  student_question: z.string().trim().max(1600).optional().nullable(),
  local_context: z.string().trim().max(1000).optional().nullable(),
  request_type: z.enum([
    "explain_full_topic",
    "explain_selected_portion",
    "activity_support",
    "real_life_examples",
    "teacher_notes",
    "student_question_help",
    "beyond_textbook_explanation",
    "revision_summary",
  ]),
});

const bookmarkSchema = z.object({
  generation_id: z.string().uuid(),
  title: z.string().trim().min(2).max(220).optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(12).optional().default([]),
});

const reuseSchema = z.object({
  library_item_id: z.string().uuid(),
});

export const getTeachingAssistantWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const me = await loadMembership(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const periodMonth = monthStart();
    const pool = await ensureCreditPool(supabaseAdmin, me.org_id, periodMonth, context.userId);
    const [allocation, transactions, generations, library, members, years] = await Promise.all([
      currentAllocation(supabaseAdmin, me.org_id, context.userId, periodMonth),
      supabaseAdmin
        .from("ai_teaching_credit_transactions")
        .select("*")
        .eq("org_id", me.org_id)
        .eq("teacher_user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("ai_teaching_generations")
        .select("*")
        .eq("org_id", me.org_id)
        .eq("teacher_user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin
        .from("ai_teaching_library_items")
        .select("*")
        .eq("org_id", me.org_id)
        .order("updated_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("org_members")
        .select("user_id, role, profiles(email, display_name)")
        .eq("org_id", me.org_id)
        .order("role"),
      supabaseAdmin
        .from("academic_years")
        .select("id, name, start_date, end_date")
        .eq("org_id", me.org_id)
        .order("start_date", { ascending: false })
        .limit(10),
    ]);
    const admin = isAdminRole(me.role);
    let allAllocations: any[] = [];
    let orgTransactions: any[] = [];
    if (admin) {
      const [allocRes, txRes] = await Promise.all([
        supabaseAdmin
          .from("ai_teaching_credit_allocations")
          .select("*")
          .eq("org_id", me.org_id)
          .eq("period_month", periodMonth)
          .order("updated_at", { ascending: false }),
        supabaseAdmin
          .from("ai_teaching_credit_transactions")
          .select("*")
          .eq("org_id", me.org_id)
          .order("created_at", { ascending: false })
          .limit(80),
      ]);
      allAllocations = allocRes.data ?? [];
      orgTransactions = txRes.data ?? [];
    }
    const allocated = Number(allocation?.allocated_credits ?? 0);
    const used = Number(allocation?.used_credits ?? 0);
    return {
      org_id: me.org_id,
      role: me.role,
      isAdmin: admin,
      periodMonth,
      pool,
      costs: REQUEST_COSTS,
      costLabels: REQUEST_LABELS,
      balance: {
        allocated,
        used,
        available: Math.max(0, allocated - used),
      },
      allocation,
      transactions: transactions.data ?? [],
      generations: generations.data ?? [],
      library: library.data ?? [],
      years: years.data ?? [],
      members: (members.data ?? []).filter((m: any) => ["teacher", "admin", "super_admin", "owner", "coordinator"].includes(String(m.role))),
      adminAllocations: allAllocations,
      adminTransactions: orgTransactions,
    };
  });

export const allocateTeachingCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => allocateSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const me = await loadMembership(context.supabase, context.userId);
    if (!isAdminRole(me.role)) throw new Error("Only School Super Admin or school admin can allocate AI Teaching Credits.");
    await assertOrgMember(context.supabase, data.teacher_user_id, me.org_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const periodMonth = monthStart();
    await ensureCreditPool(supabaseAdmin, me.org_id, periodMonth, context.userId);
    const existing = await currentAllocation(supabaseAdmin, me.org_id, data.teacher_user_id, periodMonth);
    const previousAllocated = Number(existing?.allocated_credits ?? 0);
    if (Number(existing?.used_credits ?? 0) > data.allocated_credits) {
      throw new Error("Allocated credits cannot be lower than credits already used this month.");
    }
    const { data: existingAllocations, error: allocationLoadError } = await supabaseAdmin
      .from("ai_teaching_credit_allocations")
      .select("teacher_user_id, allocated_credits")
      .eq("org_id", me.org_id)
      .eq("period_month", periodMonth);
    if (allocationLoadError) throw new Error(allocationLoadError.message);
    const otherAllocated = (existingAllocations ?? [])
      .filter((row: any) => row.teacher_user_id !== data.teacher_user_id)
      .reduce((sum: number, row: any) => sum + Number(row.allocated_credits ?? 0), 0);
    const pool = await ensureCreditPool(supabaseAdmin, me.org_id, periodMonth, context.userId);
    const poolTotal = Number(pool.monthly_base_credits ?? 0) + Number(pool.purchased_credits ?? 0);
    if (otherAllocated + data.allocated_credits > poolTotal) {
      throw new Error(`This allocation exceeds the school AI Teaching Credit pool. Available pool credits: ${poolTotal - otherAllocated}.`);
    }
    const payload = {
      org_id: me.org_id,
      teacher_user_id: data.teacher_user_id,
      period_month: periodMonth,
      allocated_credits: data.allocated_credits,
      used_credits: Number(existing?.used_credits ?? 0),
      active: true,
      allocated_by: context.userId,
      notes: data.notes || null,
    };
    const { data: row, error } = await supabaseAdmin
      .from("ai_teaching_credit_allocations")
      .upsert(payload, { onConflict: "org_id,teacher_user_id,period_month" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const delta = data.allocated_credits - previousAllocated;
    await recordTransaction(supabaseAdmin, {
      orgId: me.org_id,
      teacherUserId: data.teacher_user_id,
      allocationId: row.id,
      transactionType: previousAllocated === 0 ? "allocation" : delta >= 0 ? "increase" : "decrease",
      credits: delta,
      balanceAfter: data.allocated_credits - Number(row.used_credits ?? 0),
      notes: data.notes || "School admin updated monthly AI Teaching Credit allocation.",
      createdBy: context.userId,
    });
    await refreshPoolUsage(supabaseAdmin, me.org_id, periodMonth, context.userId);
    return row;
  });

export const generateTeachingSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateTeachingSuggestionSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const me = await loadMembership(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const periodMonth = monthStart();
    await ensureCreditPool(supabaseAdmin, me.org_id, periodMonth, context.userId);
    const cost = REQUEST_COSTS[data.request_type] ?? 1;
    const allocation = await currentAllocation(supabaseAdmin, me.org_id, context.userId, periodMonth);
    const available = Number(allocation?.allocated_credits ?? 0) - Number(allocation?.used_credits ?? 0);
    if (!allocation || available < cost) {
      throw new Error(`Not enough AI Teaching Credits. This request needs ${cost} credit${cost === 1 ? "" : "s"}.`);
    }

    let response = buildOfflineTeachingPlan(data);
    let provider = "offline_template";
    try {
      const ai = await aiTeachingPlan(data);
      if (ai) {
        response = ai;
        provider = "openai_compatible";
      }
    } catch (e: any) {
      response += `\n\nProvider note: AI provider was unavailable (${e?.message ?? "unknown error"}), so this editable activity plan used the local teaching template.`;
    }

    const newUsed = Number(allocation.used_credits ?? 0) + cost;
    const { error: allocationError } = await supabaseAdmin
      .from("ai_teaching_credit_allocations")
      .update({ used_credits: newUsed })
      .eq("id", allocation.id);
    if (allocationError) throw new Error(allocationError.message);

    const prompt = [
      `How can I teach this topic effectively?`,
      `Grade: ${data.grade || "-"}`,
      `Subject: ${data.subject}`,
      `Chapter: ${data.chapter || "-"}`,
      `Topic: ${data.topic}`,
      `Sub-topic: ${data.sub_topic || "-"}`,
      `Learning objective: ${data.learning_objective || "-"}`,
      `Local context: ${data.local_context || "-"}`,
      `Teacher note: ${data.teacher_note || "-"}`,
    ].join("\n");
    const { data: generation, error } = await supabaseAdmin
      .from("ai_teaching_generations")
      .insert({
        org_id: me.org_id,
        teacher_user_id: context.userId,
        academic_year_id: data.academic_year_id || null,
        grade: data.grade || null,
        subject: data.subject,
        chapter: data.chapter || null,
        topic: data.topic,
        sub_topic: data.sub_topic || null,
        learning_objective: data.learning_objective || null,
        request_type: data.request_type,
        credits_spent: cost,
        prompt,
        response,
        provider,
        metadata: { local_context: data.local_context, teacher_note: data.teacher_note },
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await recordTransaction(supabaseAdmin, {
      orgId: me.org_id,
      teacherUserId: context.userId,
      allocationId: allocation.id,
      generationId: generation.id,
      transactionType: "consume",
      credits: -cost,
      balanceAfter: Number(allocation.allocated_credits ?? 0) - newUsed,
      notes: `${REQUEST_LABELS[data.request_type]} generated for ${data.subject}: ${data.topic}.`,
      createdBy: context.userId,
    });
    await refreshPoolUsage(supabaseAdmin, me.org_id, periodMonth, context.userId);
    return {
      ...generation,
      availableCredits: Number(allocation.allocated_credits ?? 0) - newUsed,
      cost,
    };
  });

export const bookmarkTeachingSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bookmarkSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const me = await loadMembership(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: generation, error } = await supabaseAdmin
      .from("ai_teaching_generations")
      .select("*")
      .eq("id", data.generation_id)
      .eq("org_id", me.org_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!generation) throw new Error("Teaching suggestion was not found.");
    const title = data.title || `${generation.subject}: ${generation.topic}`;
    const { data: item, error: insertError } = await supabaseAdmin
      .from("ai_teaching_library_items")
      .insert({
        org_id: me.org_id,
        generation_id: generation.id,
        created_by: context.userId,
        title,
        grade: generation.grade,
        subject: generation.subject,
        topic: generation.topic,
        request_type: generation.request_type,
        content: generation.response,
        tags: data.tags,
        visibility: "school",
      })
      .select()
      .single();
    if (insertError) throw new Error(insertError.message);
    await supabaseAdmin
      .from("ai_teaching_generations")
      .update({ bookmarked: true, status: "bookmarked" })
      .eq("id", generation.id);
    return item;
  });

export const reuseTeachingLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reuseSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const me = await loadMembership(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error } = await supabaseAdmin
      .from("ai_teaching_library_items")
      .select("*")
      .eq("id", data.library_item_id)
      .eq("org_id", me.org_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("Library item was not found.");
    await supabaseAdmin
      .from("ai_teaching_library_items")
      .update({ reuse_count: Number(item.reuse_count ?? 0) + 1 })
      .eq("id", item.id);
    await recordTransaction(supabaseAdmin, {
      orgId: me.org_id,
      teacherUserId: context.userId,
      transactionType: "reuse",
      credits: 0,
      balanceAfter: null,
      notes: `Reused saved teaching library item: ${item.title}. No additional credits consumed.`,
      createdBy: context.userId,
    });
    return item;
  });

export const getDailyTeachingAssistantPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const me = await loadMembership(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const { data: years, error: yearError } = await supabaseAdmin
      .from("academic_years")
      .select("id, label, start_date, end_date, school_id, schools(name, board, city, state, country)")
      .eq("org_id", me.org_id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (yearError) throw new Error(yearError.message);
    const year = years?.[0] ?? null;
    if (!year) return { year: null, today: todayIso, lessons: [] };

    const startTime = new Date(year.start_date).getTime();
    const currentWeekNo = Number.isFinite(startTime)
      ? Math.max(1, Math.ceil((today.getTime() - startTime + 1) / (7 * 24 * 60 * 60 * 1000)))
      : 1;

    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from("teacher_assignments")
      .select("*")
      .eq("org_id", me.org_id)
      .eq("academic_year_id", year.id)
      .eq("teacher_user_id", context.userId)
      .order("grade");
    if (assignmentError) throw new Error(assignmentError.message);

    const { data: curricula, error: curriculaError } = await supabaseAdmin
      .from("subject_curricula")
      .select("*")
      .eq("year_id", year.id);
    if (curriculaError) throw new Error(curriculaError.message);

    const { data: gradeSubjects } = await supabaseAdmin
      .from("grade_subjects")
      .select("id, grade, subject, textbooks_input(title, publisher, author)")
      .eq("academic_year_id", year.id)
      .eq("org_id", me.org_id);

    const bookFor = (grade: string, subject: string) => {
      const row = (gradeSubjects ?? []).find((item: any) => item.grade === grade && item.subject === subject);
      const book = row?.textbooks_input?.[0];
      return [book?.title, book?.publisher].filter(Boolean).join(" - ") || null;
    };

    const lessons = (assignments ?? []).map((assignment: any) => {
      const curriculum = (curricula ?? []).find((row: any) => row.grade === assignment.grade && row.subject === assignment.subject);
      const chapters = Array.isArray(curriculum?.chapters) ? curriculum.chapters : [];
      const exact = chapters.find((chapter: any) => Number(chapter.week_no ?? 0) === currentWeekNo);
      const upcoming = chapters.find((chapter: any) => Number(chapter.week_no ?? 0) >= currentWeekNo);
      const chapter = exact ?? upcoming ?? chapters[0] ?? null;
      const title = chapter?.title ?? assignment.subject;
      return {
        id: `${assignment.id}:${chapter?.seq ?? "planned"}`,
        source: chapter ? "subject_curriculum_week" : "teacher_assignment_fallback",
        teacher_assignment_id: assignment.id,
        academic_year_id: year.id,
        planned_date: todayIso,
        current_week_no: currentWeekNo,
        grade: assignment.grade,
        section: assignment.section,
        subject: assignment.subject,
        board: year.schools?.board ?? null,
        book: bookFor(assignment.grade, assignment.subject),
        chapter: title,
        topic: title,
        learning_objectives: Array.isArray(chapter?.objectives) ? chapter.objectives : [],
        periods: chapter?.periods ?? assignment.periods_per_week ?? null,
        notes: chapter?.notes ?? null,
        difficulty: chapter?.difficulty ?? null,
      };
    });

    return {
      year,
      today: todayIso,
      currentWeekNo,
      lessons,
    };
  });

export const generateDailyTeachingHelp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => syllabusAwareHelpSchema.parse(input))
  .handler(async ({ context, data }) => {
    await requireOrgFeature(context.supabase, context.userId, "v2_ai");
    const me = await loadMembership(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.teacher_assignment_id) {
      const { data: assignment, error: assignmentError } = await supabaseAdmin
        .from("teacher_assignments")
        .select("id")
        .eq("id", data.teacher_assignment_id)
        .eq("org_id", me.org_id)
        .eq("teacher_user_id", context.userId)
        .maybeSingle();
      if (assignmentError) throw new Error(assignmentError.message);
      if (!assignment && !isAdminRole(me.role)) throw new Error("You can generate daily teaching help only for your assigned lessons.");
    }

    const periodMonth = monthStart();
    await ensureCreditPool(supabaseAdmin, me.org_id, periodMonth, context.userId);
    const allocation = await currentAllocation(supabaseAdmin, me.org_id, context.userId, periodMonth);
    const cost = REQUEST_COSTS[data.request_type] ?? 2;
    const available = Number(allocation?.allocated_credits ?? 0) - Number(allocation?.used_credits ?? 0);
    if (!allocation || available < cost) {
      throw new Error(`Not enough AI Teaching Credits. This request needs ${cost} credit${cost === 1 ? "" : "s"}.`);
    }

    let response = buildSyllabusAwarePlan(data);
    let provider = "offline_template";
    try {
      const ai = await aiSyllabusAwarePlan(data);
      if (ai) {
        response = ai;
        provider = "openai_compatible";
      }
    } catch (e: any) {
      response += `\n\nProvider note: AI provider was unavailable (${e?.message ?? "unknown error"}), so this editable daily teaching help used the local syllabus-aware template.`;
    }

    const newUsed = Number(allocation.used_credits ?? 0) + cost;
    const { error: allocationError } = await supabaseAdmin
      .from("ai_teaching_credit_allocations")
      .update({ used_credits: newUsed })
      .eq("id", allocation.id);
    if (allocationError) throw new Error(allocationError.message);

    const prompt = [
      `Daily Teaching Assistant Panel: ${REQUEST_LABELS[data.request_type]}`,
      `Date: ${data.planned_date || "today"}`,
      `Class: ${data.grade || "-"}${data.section ? `-${data.section}` : ""}`,
      `Subject: ${data.subject}`,
      `Board: ${data.board || "-"}`,
      `Book: ${data.book || "-"}`,
      `Chapter: ${data.chapter || "-"}`,
      `Topic: ${data.topic}`,
      `Learning objectives: ${(data.learning_objectives ?? []).join("; ") || "-"}`,
      `Selected portion: ${data.selected_portion || "-"}`,
      `Student question: ${data.student_question || "-"}`,
    ].join("\n");

    const { data: generation, error } = await supabaseAdmin
      .from("ai_teaching_generations")
      .insert({
        org_id: me.org_id,
        teacher_user_id: context.userId,
        academic_year_id: data.academic_year_id || null,
        grade: data.grade || null,
        subject: data.subject,
        chapter: data.chapter || null,
        topic: data.topic,
        sub_topic: data.selected_portion || null,
        learning_objective: (data.learning_objectives ?? []).join("; ") || null,
        request_type: data.request_type,
        credits_spent: cost,
        prompt,
        response,
        provider,
        metadata: {
          planned_date: data.planned_date,
          teacher_assignment_id: data.teacher_assignment_id,
          board: data.board,
          book: data.book,
          student_question: data.student_question,
          local_context: data.local_context,
        },
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await recordTransaction(supabaseAdmin, {
      orgId: me.org_id,
      teacherUserId: context.userId,
      allocationId: allocation.id,
      generationId: generation.id,
      transactionType: "consume",
      credits: -cost,
      balanceAfter: Number(allocation.allocated_credits ?? 0) - newUsed,
      notes: `${REQUEST_LABELS[data.request_type]} generated from daily syllabus plan for ${data.subject}: ${data.topic}.`,
      createdBy: context.userId,
    });
    await refreshPoolUsage(supabaseAdmin, me.org_id, periodMonth, context.userId);

    return {
      ...generation,
      cost,
      availableCredits: Number(allocation.allocated_credits ?? 0) - newUsed,
    };
  });
