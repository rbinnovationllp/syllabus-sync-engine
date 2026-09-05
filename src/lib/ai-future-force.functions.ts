import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planForTier, tierForPriceId } from "@/lib/plans";

type Band = "primary" | "middle" | "higher" | "enterprise";
type WeeklyFrequency = 1 | 2;

const BAND_META: Record<Band, { label: string; grades: string[]; price: number; billing: string; focus: string[]; preview: Array<{ chapter: string; objectives: string[]; outcomes: string[]; activities: string[] }> }> = {
  primary: {
    label: "Primary School (Classes 1-5)",
    grades: ["1", "2", "3", "4", "5"],
    price: 1000,
    billing: "one-time activation",
    focus: ["AI awareness", "pattern games", "smart devices", "responsible technology", "story-based learning"],
    preview: [
      {
        chapter: "AI in Everyday Life",
        objectives: ["Recognize simple AI examples", "Build curiosity about smart devices"],
        outcomes: ["Students can explain AI with familiar examples"],
        activities: ["Voice assistant discussion", "AI/not AI sorting game"],
      },
      {
        chapter: "Patterns and Classification",
        objectives: ["Identify patterns", "Sort objects by rules"],
        outcomes: ["Students understand how computers group information"],
        activities: ["Picture sorting", "Classroom pattern hunt"],
      },
      {
        chapter: "Responsible Technology",
        objectives: ["Use technology safely", "Understand human supervision"],
        outcomes: ["Students know AI should be used with care"],
        activities: ["Story-based ethics circle", "Safe technology pledge"],
      },
    ],
  },
  middle: {
    label: "Middle School (Classes 6-8)",
    grades: ["6", "7", "8"],
    price: 2000,
    billing: "one-time activation",
    focus: ["data labeling", "machine learning basics", "chatbots", "image recognition", "AI ethics"],
    preview: [
      {
        chapter: "Data and Labeling",
        objectives: ["Understand data collection", "Label examples for training"],
        outcomes: ["Students can prepare a small labeled dataset"],
        activities: ["Image labeling activity", "Class survey dataset"],
      },
      {
        chapter: "Machine Learning Basics",
        objectives: ["Understand training and prediction", "Compare rule-based and learning systems"],
        outcomes: ["Students can describe how AI learns from examples"],
        activities: ["Prediction game", "No-code classifier demo"],
      },
      {
        chapter: "AI Ethics and Privacy",
        objectives: ["Recognize bias and privacy risks", "Use AI responsibly"],
        outcomes: ["Students can evaluate safe AI use cases"],
        activities: ["Bias discussion", "Privacy checklist"],
      },
    ],
  },
  higher: {
    label: "Higher Secondary School (Classes 9-12)",
    grades: ["9", "10", "11", "12"],
    price: 5000,
    billing: "one-time activation",
    focus: ["Python", "machine learning", "generative AI", "AI agents", "capstone projects"],
    preview: [
      {
        chapter: "Python for AI Thinking",
        objectives: ["Use basic Python structures", "Prepare data for analysis"],
        outcomes: ["Students can write simple AI-supporting scripts"],
        activities: ["Data table exercise", "Simple Python notebook"],
      },
      {
        chapter: "Generative AI and Prompt Engineering",
        objectives: ["Understand text/image generation", "Write structured prompts"],
        outcomes: ["Students can use generative AI with review and responsibility"],
        activities: ["Prompt improvement lab", "Fact-checking exercise"],
      },
      {
        chapter: "AI Capstone Project",
        objectives: ["Identify a real problem", "Design an AI-assisted solution"],
        outcomes: ["Students produce a project brief and demonstration"],
        activities: ["Problem statement workshop", "Prototype presentation"],
      },
    ],
  },
  enterprise: {
    label: "Enterprise AI Future Force (Classes 1-12)",
    grades: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
    price: 10000,
    billing: "monthly subscription",
    focus: ["whole-school AI roadmap", "advanced reporting", "administrative controls", "teacher enablement", "future AI education features"],
    preview: [
      {
        chapter: "Whole-School AI Readiness Roadmap",
        objectives: ["Map AI learning outcomes across grades", "Align AI periods with school operations"],
        outcomes: ["Leadership receives a grade-wise AI adoption roadmap"],
        activities: ["Readiness audit", "Leadership planning workshop"],
      },
      {
        chapter: "Teacher Enablement and Governance",
        objectives: ["Prepare teachers for AI classroom delivery", "Define review and safety rules"],
        outcomes: ["School can deliver AI education with controlled governance"],
        activities: ["Teacher orientation", "AI usage policy checklist"],
      },
      {
        chapter: "Innovation Projects and Reporting",
        objectives: ["Track projects and outcomes", "Show management-level progress"],
        outcomes: ["School can monitor AI adoption, projects, and student readiness"],
        activities: ["Innovation showcase", "Monthly leadership report"],
      },
    ],
  },
};

async function loadMyOrg(supabase: any, userId: string) {
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("Create or join a school first.");
  return data as { org_id: string; role: string };
}

async function requirePlusPlan(supabase: any, userId: string) {
  const { data: tester } = await supabase.rpc("is_active_tester", {
    user_uuid: userId,
    feature: "ai_future_force",
  });
  if (tester === true) return true;

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("price_id,status,current_period_end,grace_until")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tier = tierForPriceId(sub?.price_id);
  const plan = planForTier(tier);
  const statusOk =
    !!sub &&
    (
      ["active", "authenticated", "charged", "trialing", "past_due"].includes(sub.status) ||
      (sub.status === "pending" && sub.grace_until && new Date(sub.grace_until) > new Date())
    );

  const planAllowsAiFutureForce =
    !!plan &&
    (plan.id.includes("plus") || plan.id === "enterprise_global_access" || plan.id === "enterprise_plus_access");

  if (!statusOk || !planAllowsAiFutureForce) {
    throw new Error("AI Future Force is available only to schools with an active Plus subscription plan.");
  }
  return true;
}

function monthKey(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, count: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
}

function curriculumPreview(band: Band, weeklyClassesPerWeek: WeeklyFrequency, months: number) {
  const meta = BAND_META[band];
  const safeMonths = Math.max(1, Math.min(12, months || 1));
  const expectedSessions = safeMonths * 4 * weeklyClassesPerWeek;
  return {
    grade_structure: meta.grades,
    weekly_classes_per_week: weeklyClassesPerWeek,
    expected_sessions: expectedSessions,
    pacing:
      weeklyClassesPerWeek === 1
        ? "One AI class per week keeps adoption gradual and protects regular subject teaching time."
        : "Two AI classes per week allows deeper project work, practical demonstrations, and assessment time.",
    integration_note:
      "The AI Future Force plan is designed to run alongside regular academics without disturbing the school's core curriculum, examination calendar, revision time, or subject workload.",
    chapters: meta.preview,
  };
}

function dynamicReleaseContent(band: Band, index: number, foundationMode: boolean, weeklyClassesPerWeek: WeeklyFrequency) {
  const meta = BAND_META[band];
  if (foundationMode) {
    return {
      title: "AI Foundation Module",
      learning_outcomes: [
        "Introduction to AI and how it appears in daily life",
        "Basic AI terminology explained at the correct grade level",
        "Responsible, ethical, and safe use of AI tools",
        "Grade-appropriate classroom demonstration and reflection activity",
      ],
      project_ideas: [
        "AI awareness poster or classroom discussion activity",
        "Identify AI examples used at home, school, transport, healthcare, farming, or media",
        weeklyClassesPerWeek === 2 ? "Short practical demonstration and student reflection sheet" : "Simple take-home observation activity",
      ],
      tools_and_examples: [
        "Current AI examples refreshed at content creation time",
        "Age-appropriate teacher-led demonstrations",
      ],
    };
  }

  const focus = meta.focus[index % meta.focus.length];
  return {
    title: `Month ${index + 1}: ${focus}`,
    learning_outcomes: [
      `Age-appropriate understanding of ${focus}`,
      "Responsible use of AI tools",
      "Updated AI examples, tools, case studies, and classroom practice",
      weeklyClassesPerWeek === 2
        ? "Additional practical activity or mini-project completed with teacher guidance"
        : "Balanced weekly exposure without affecting core subject load",
    ],
    project_ideas: [
      index % 2 === 0 ? "Mini AI awareness project" : "Applied classroom AI activity",
      "Teacher-led discussion and student worksheet",
      weeklyClassesPerWeek === 2 ? "Extended lab or group project activity" : "Short classroom practice task",
    ],
    tools_and_examples: [
      "Updated monthly case studies",
      "Current AI tools and classroom examples",
    ],
  };
}

function releaseRows(activationId: string, orgId: string, band: Band, sessionStart: string, months: number, weeklyClassesPerWeek: WeeklyFrequency) {
  const start = monthKey(new Date(sessionStart));
  const foundationMode = months <= 1;
  const total = foundationMode ? 1 : Math.max(1, Math.min(12, months));
  return Array.from({ length: total }).map((_, index) => {
    const releaseMonth = addMonths(start, index);
    const nextMonth = addMonths(start, index + 1);
    const unlocksAt = new Date(nextMonth);
    unlocksAt.setUTCDate(unlocksAt.getUTCDate() - 2);
    const content = dynamicReleaseContent(band, index, foundationMode, weeklyClassesPerWeek);
    return {
      activation_id: activationId,
      org_id: orgId,
      release_month: releaseMonth.toISOString().slice(0, 10),
      unlocks_at: foundationMode ? new Date().toISOString() : unlocksAt.toISOString(),
      title: content.title,
      learning_outcomes: content.learning_outcomes,
      project_ideas: content.project_ideas,
      tools_and_examples: content.tools_and_examples,
      content_status: index === 0 ? "released" : "planned",
      download_enabled: index === 0,
    };
  });
}

export const getAiFutureForce = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const me = await loadMyOrg(supabase, userId);

    const [schools, activations] = await Promise.all([
      supabase.from("schools").select("id,name").eq("org_id", me.org_id).limit(1).maybeSingle(),
      supabase
        .from("ai_future_force_activations")
        .select("*, ai_future_force_monthly_releases(*)")
        .eq("org_id", me.org_id)
        .order("created_at", { ascending: false }),
    ]);

    let plusEligible = false;
    try {
      await requirePlusPlan(supabase, userId);
      plusEligible = true;
    } catch {
      plusEligible = false;
    }

    const now = new Date();
    const rows = (activations.data ?? []).map((activation: any) => ({
      ...activation,
      releases: (activation.ai_future_force_monthly_releases ?? [])
        .filter(() => activation.status === "active")
        .filter((release: any) => new Date(release.unlocks_at) <= now)
        .sort((a: any, b: any) => String(a.release_month).localeCompare(String(b.release_month))),
    }));

    return {
      org_id: me.org_id,
      role: me.role,
      school: schools.data,
      plusEligible,
      bands: BAND_META,
      activations: rows,
      adoptionMessage:
        "AI Future Force is optional. It prepares students for future careers while complementing the school's existing curriculum, timetable, revision, and examination schedule.",
    };
  });

const activateSchema = z.object({
  wants_ai_future_force: z.literal(true),
  band: z.enum(["primary", "middle", "higher", "enterprise"]),
  session_start_date: z.string().min(8),
  session_end_date: z.string().min(8),
  remaining_teaching_months: z.coerce.number().int().min(0).max(12),
  weekly_classes_per_week: z.coerce.number().int().refine((v): v is WeeklyFrequency => v === 1 || v === 2, {
    message: "Select one or two AI classes per week.",
  }),
});

export const activateAiFutureForce = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => activateSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Historical activations remain accessible for audit and delivery, but this
    // legacy add-on is no longer sold. New AI education sales use the separate
    // AI Education Premium product and its class-specific entitlements.
    throw new Error("AI Future Force is archived for new activations. Use AI Education Premium for new AI education subscriptions.");
    /* c8 ignore next */
    const { supabase, userId, claims } = context;
    const me = await loadMyOrg(supabase, userId);
    if (!["admin", "super_admin"].includes(me.role)) {
      throw new Error("Only the School Admin can activate AI Future Force.");
    }
    await requirePlusPlan(supabase, userId);
    if (data.wants_ai_future_force !== true) {
      throw new Error("AI Future Force is optional. Please confirm that the school wants to activate this add-on.");
    }

    const { data: school } = await supabase
      .from("schools")
      .select("id")
      .eq("org_id", me.org_id)
      .limit(1)
      .maybeSingle();

    const meta = BAND_META[data.band];
    const foundationMode = data.remaining_teaching_months <= 1;
    const expectedSessions = Math.max(1, data.remaining_teaching_months || 1) * 4 * data.weekly_classes_per_week;
    const preview = curriculumPreview(data.band, data.weekly_classes_per_week, data.remaining_teaching_months);
    const compression =
      foundationMode
        ? "Final-month enrollment: AI Foundation Module is released now; remaining grade-level curriculum is carried forward to the next academic session."
        : data.remaining_teaching_months < 12
        ? `Annual AI curriculum compressed into ${data.remaining_teaching_months} teaching months with ${data.weekly_classes_per_week} AI class${data.weekly_classes_per_week === 1 ? "" : "es"} per week while preserving priority outcomes.`
        : `Standard full-year AI curriculum structure with ${data.weekly_classes_per_week} AI class${data.weekly_classes_per_week === 1 ? "" : "es"} per week.`;
    const scheduleSummary =
      data.weekly_classes_per_week === 1
        ? `Approx. ${expectedSessions} AI learning sessions planned. This is a gradual weekly model designed to avoid extra workload.`
        : `Approx. ${expectedSessions} AI learning sessions planned. This adds more practical activities, projects, and guided lab time.`;
    const carryForwardTopics = foundationMode
      ? meta.focus.map((item) => `${item} - pending for next academic session`)
      : [];
    const nextSessionRoadmap = foundationMode
      ? {
          status: "pending_for_next_session",
          note: "The next academic session should continue from the learning stage after the completed AI Foundation Module.",
          completed_foundation_topics: [
            "AI introduction",
            "AI awareness and applications",
            "Basic AI terminology",
            "Responsible and ethical AI use",
            "Grade-appropriate classroom activity",
          ],
          carried_forward_topics: carryForwardTopics,
        }
      : {};

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (school?.id) {
      await supabaseAdmin
        .from("schools")
        .update({
          ai_future_force_weekly_classes_per_week: data.weekly_classes_per_week,
          ai_future_force_scheduling_confirmed_at: new Date().toISOString(),
        })
        .eq("id", school.id);
    }

    const { data: activation, error } = await supabaseAdmin
      .from("ai_future_force_activations")
      .upsert(
        {
          org_id: me.org_id,
          school_id: school?.id ?? null,
          activated_by: userId,
          band: data.band,
          grades: meta.grades,
          one_time_price_inr: meta.price,
          status: "pending_payment",
          access_model: data.band === "enterprise" ? "enterprise_monthly" : "one_time_activation",
          session_start_date: data.session_start_date,
          session_end_date: data.session_end_date,
          remaining_teaching_months: data.remaining_teaching_months,
          wants_ai_future_force: data.wants_ai_future_force,
          weekly_classes_per_week: data.weekly_classes_per_week,
          expected_sessions: expectedSessions,
          curriculum_preview: preview,
          schedule_summary: scheduleSummary,
          compression_note: compression,
          foundation_mode: foundationMode,
          foundation_completed_at: foundationMode ? new Date().toISOString() : null,
          carry_forward_topics: carryForwardTopics,
          next_session_roadmap: nextSessionRoadmap,
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,band" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);

    const releases = releaseRows(
      activation.id,
      me.org_id,
      data.band,
      data.session_start_date,
      data.remaining_teaching_months,
      data.weekly_classes_per_week,
    );
    await supabaseAdmin
      .from("ai_future_force_monthly_releases")
      .upsert(releases, { onConflict: "activation_id,release_month" });

    await supabaseAdmin.from("platform_audit_logs").insert({
      org_id: me.org_id,
      user_id: userId,
      user_email: (claims?.email as string | undefined) ?? null,
      user_role: me.role,
      action: "ai_future_force_activation_requested",
      target_type: "ai_future_force_activations",
      target_id: activation.id,
      details: {
        band: data.band,
        remaining_teaching_months: data.remaining_teaching_months,
        weekly_classes_per_week: data.weekly_classes_per_week,
        expected_sessions: expectedSessions,
        price_inr: meta.price,
        foundation_mode: foundationMode,
      },
    });

    return activation;
  });
