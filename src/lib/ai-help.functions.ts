import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const helpInput = z.object({
  message: z.string().trim().min(1).max(2000),
  page: z.string().trim().max(300).optional().nullable(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(2000),
  })).max(8).optional().default([]),
});

const KNOWLEDGE_BASE = `
Product name: Syllabus Synk / CurriculumOS.
Support email: support@syllabus-synk.in.
Website: https://syllabus-synk.in.

Core purpose:
- Helps K-12 schools plan academic years, holidays, exams, teaching capacity, and yearly syllabus completion.
- Creates a free 30-day preview for one subject for unpaid users.
- Full annual curriculum planning, exports, and non-watermarked documents require a subscription.
- Positions Syllabus Synk as both an Academic Planning Platform and a Future-Ready Education Ecosystem.

Main workflows:
1. Sign up or sign in.
2. Create school profile and academic year.
3. Add holidays, weekly offs, exams, events, and subjects.
4. Generate annual calendar.
5. Generate per-subject curriculum.
6. Export PDF/DOCX where permitted.

Detailed product guide:
- Public website: explains CurriculumOS/Syllabus Synk, captures demo leads, shows visitor interest counters, partner/referral entry, AI Leadership Suite, and AI Future Workforce messaging.
- Authentication: email/password sign-up, sign-in, Google sign-in, invitation acceptance, password recovery, and protected routes.
- Onboarding for schools: choose institution profile; enter school name, country, region, state, city, board, acquisition source, fee tier, currency, textbooks, academic year dates, weekly offs, working days, periods per day, period duration, school timings, lunch timings, senior extra classes, grade-subject rows, teachers, completed chapters, holidays, vacations, events with prep days, exam windows, and teacher training days.
- Onboarding for tutors: retail single-access flow for one grade and subject, book details, class duration, classes per week, course dates, holidays, vacations, and exam dates.
- Dashboard: lists academic years and links to results, plan usage, partner program, school profile, assignments, curriculum proposals, and new academic year setup.
- Results page: shows teaching-day capacity, total periods, utilization, AI credit balance, capacity breakdown, annual calendar generation, subject curriculum generation, 30-day preview limitations, paid full-year generation, reschedule/recalibration, PDF/DOCX export, demo watermarking, version history, teacher curriculum proposals, and AI run history.
- Capacity engine: subtracts government holidays, school holidays, vacations, events, exams, teacher training, weekly offs, and buffer days before planning curriculum.
- AI generation: annual calendar costs 50 credits, subject curriculum costs 25 credits, recalculation costs 20 credits, lesson plan costs 5 credits, and teacher training roadmap costs 10 credits.
- Curriculum proposals: teachers can propose grade-subject curriculum changes, submit for review, receive AI evaluation, acknowledge finalized decisions, and view proposal history.
- Version history and recycle bin: annual calendars and subject curricula can be versioned, restored, soft-deleted, and governed through retention workflows where implemented.
- AI Leadership Suite: available in Plus/eligible plans; includes Principal Dashboard, Teacher Copilot, Content Studio, Assessment Generator, Academic Digital Twin, Teacher Intelligence, Student Intelligence, and Parent Communication Hub.
- Principal Dashboard: summarizes academic health, syllabus completion, classes behind, AI reliability, alerts, upcoming exams/events, readiness indicators, and teacher intervention needs.
- Teacher Copilot: generates editable lesson strategies, activities, homework, rubrics, projects, and differentiated classroom support.
- Content Studio: creates editable school resources, practice tasks, definitions, worksheets, and support material.
- Assessment Generator: creates editable class tests/exam papers with exam type, grade, subject, chapter range, marks, duration, difficulty mix, question format, answer key, and human review confirmation before download.
- Academic Digital Twin: simulates disruptions such as lost teaching days, affected teachers, exam shifts, recovery recommendations, teacher load pressure, revision risk, and projected readiness.
- Teacher Intelligence: highlights teachers tracked, average completion, high-risk/watch status, pending rows, and pacing interventions.
- Student Intelligence: prepares cohort-style learning insight placeholders and intervention guidance; richer individual student scoring requires connected student assessment/homework/attendance data.
- Parent Communication Hub: drafts PTM messages, parent notices, reminders, progress updates, and intervention communications for human review.
- Academic Execution: teachers record daily teaching progress by assignment, date, planned topic, actual chapter/topics, completion status, periods taken, and remarks; principals/coordinators monitor class-wise, subject-wise, and teacher-wise completion, risk, and recent records.
- Teacher Assignments: school admins assign teachers to grades, sections, and subjects, and can revoke assignments.
- Seats: admins invite users as admin, coordinator, teacher, or viewer; invitation links can be copied/revoked; seat limits follow subscription plan plus extra seats.
- School Governance: records official School Super Admin declaration, governance notes, member authority, session registry foundation, and recycle-bin governance.
- School Profile: read-only master profile for school, academic year, holidays, vacations, events, exams, training days, subjects, and audit logs.
- School Storage: AWS S3-backed protected storage for school documents, curriculum files, circulars, exports, and academic records within subscription quota.
- School CRM: lightweight school operations CRM for parent/contact records, admissions enquiries, enquiry stage updates, and follow-up completion.
- Company CRM: super-admin workspace for school accounts, active subscriptions, support/onboarding tickets, plan catalog, visitor conversion, acquisition/referral attribution, and pipeline visibility.
- Admin & CRM: admin dashboard for leads, clients, subscriptions, usage, AI usage, AI model settings, schools, admin access, partner enforcement, curriculum reviews, and audit logs.
- Partner/referral program: partner onboarding, referral code/link, stats, commissions, terms, and enforcement workflow.
- Notifications: in-app notification list, unread counts, mark-read/delete actions, and cron-generated reminders for curriculum risk, disruptions, and assigned teachers.
- Health and audit: super-admin health snapshots, live platform checks, platform audit logs, authenticated activity records, and human review confirmation logs.
- Payments: pricing supports USD/INR monthly and annual intervals, Stripe checkout/portal, Razorpay subscriptions for India, optional UPI panel, add-ons, AI credit top-ups, extra seats, extra campuses, and paid services by quotation.
- Billing rules: annual plans are billed as 10x monthly price for two months free; India annual rebate is intended for subscribers joining on or before April. Account-specific billing issues must go to support.
- Plan limits: plans define grade bands, user limits, AI credits, exports, storage, campuses, support level, teacher training, recalibration level, white-label/API/dedicated onboarding where available.
- Support email: use support@syllabus-synk.in for account access, billing, payment confirmation, failed checkout, plan assignment, or school-specific data issues.

Pricing:
- Primary Bundle: Rs. 2,999/month.
- Primary Plus Bundle: Rs. 4,000/month.
- Middle School Bundle: Rs. 4,999/month.
- Middle School Plus Bundle: Rs. 6,000/month.
- High School Bundle: Rs. 7,000/month.
- High School Plus Bundle: Rs. 9,000/month.
- Enterprise Bundle: Rs. 18,000/month.
- Enterprise Plus Bundle: Rs. 25,000/month.
- Plus plans include AI Leadership Suite.

AI Leadership Suite includes:
- Principal Dashboard.
- Teacher Copilot.
- Content Studio.
- Assessment Generator.
- Academic Digital Twin.
- Teacher Intelligence.
- Student Intelligence.
- Parent Communication Hub.

AI Future Workforce / AI Future Force:
- AI Future Workforce is the public-facing curriculum program also implemented in the product as AI Future Force.
- It is an optional AI education add-on for schools that want structured, future-ready AI learning alongside regular academics.
- It supports grade-wise learning paths for Primary Classes 1-5, Middle Classes 6-8, Higher Secondary Classes 9-12, and Enterprise Classes 1-12.
- Primary students focus on AI awareness, patterns, classification, responsible technology, and familiar smart-device examples.
- Middle school students focus on data labeling, machine learning basics, chatbots, image recognition, AI ethics, bias, and privacy.
- Senior students focus on Python for AI thinking, machine learning, generative AI, prompt engineering, AI agents, and capstone projects.
- Enterprise schools receive a whole-school AI readiness roadmap, teacher enablement, governance guidance, innovation projects, and reporting.
- Schools can schedule one or two AI classes per week so the course fits the existing timetable, examination calendar, revision time, and subject workload.
- The program provides curriculum previews with learning objectives, outcomes, projects, classroom activities, tools, examples, and monthly release planning.
- If a school joins in the final month, the system releases an AI Foundation Module first and carries the remaining grade-level curriculum into the next academic session.
- Benefits include AI literacy, responsible AI use, exposure to emerging tools, project-based learning, career awareness, and preparation for future AI-enabled workplaces.
- Future opportunities students can explore include AI engineer, data analyst, machine learning specialist, prompt engineer, robotics and automation roles, AI product roles, AI ethics and governance, cybersecurity, healthcare AI, education technology, business analytics, and other emerging technology careers.
- Teacher preparation matters. Schools should encourage Computer Science and Technology teachers to continuously enhance their AI knowledge and skills so students receive relevant, future-ready education.
- Artificial Intelligence is evolving rapidly across the world. Schools should encourage their Computer Science and Technology teachers to continuously enhance their knowledge and skills in AI so that students receive relevant and future-ready education.
- The AI Future Workforce Team continuously monitors global developments in Artificial Intelligence and emerging technologies. The curriculum for senior students will be regularly updated to incorporate the latest innovations, industry practices, and future workforce requirements, helping students remain prepared for the rapidly changing world of technology.
- The curriculum is periodically reviewed and updated to reflect emerging technologies, industry trends, tools, case studies, and real-world applications.
- Positioning: Syllabus Synk is both an Academic Planning Platform and a Future-Ready Education Ecosystem.

AI assistant maintenance rule:
- The assistant should guide users across every major feature listed above.
- When PROJECT_STATUS.md is amended, its latest content should be treated as the living project record for current capabilities, recent changes, known gaps, and production-readiness status.
- If a question concerns a feature that is marked prototype, partial, blocked, or needing work, clearly explain what currently works and what still requires completion.

Support policy:
- If user has billing, login, payment, or account-access problems, ask them to contact support@syllabus-synk.in.
- Do not claim a payment is successful unless the app or Razorpay confirms it.
- Do not request passwords, OTPs, private keys, service role keys, or payment card details.
- Give step-by-step practical guidance.
`;

function localAnswer(message: string, page?: string | null) {
  const q = message.toLowerCase();
  if (
    q.includes("future workforce") ||
    q.includes("future force") ||
    q.includes("ai curriculum") ||
    q.includes("ai education") ||
    q.includes("career") ||
    q.includes("emerging technolog")
  ) {
    return "AI Future Workforce is Syllabus Synk's optional future-ready AI education program, implemented in the platform as AI Future Force. It offers grade-wise AI learning paths for Classes 1-5, 6-8, 9-12, and whole-school enterprise adoption. Schools can plan one or two AI classes per week, review curriculum previews before activation, and receive monthly content updates covering current AI tools, case studies, projects, responsible AI use, and real-world applications. It helps students build AI literacy and career awareness for fields such as AI engineering, data analysis, machine learning, prompt engineering, robotics, cybersecurity, healthcare AI, education technology, and AI governance. Schools should also encourage Computer Science and Technology teachers to keep upgrading their AI skills, because AI is evolving rapidly worldwide.";
  }
  if (
    q.includes("teacher training") ||
    q.includes("teacher preparation") ||
    q.includes("professional development") ||
    q.includes("teacher awareness") ||
    q.includes("lifelong learning")
  ) {
    return "Teacher preparation is central to AI Future Workforce. Schools should motivate Computer Science and Technology teachers to continuously upgrade their knowledge of AI, emerging technologies, responsible AI use, classroom tools, and real-world applications. Syllabus Synk communicates this as lifelong professional development so teachers can guide students with current, relevant, and future-ready AI education.";
  }
  if (q.includes("free") || q.includes("trial") || q.includes("preview")) {
    return "You can test quality with one free 30-day preview syllabus plan for one subject. Create your academic year, add at least one grade-subject row, then open the results page and click Generate for one subject. Full annual planning and unwatermarked exports require a subscription.";
  }
  if (q.includes("price") || q.includes("plan") || q.includes("subscription") || q.includes("payment")) {
    return "Plans start from Primary Bundle at Rs. 2,999/month. Plus plans include the AI Leadership Suite. Open Plans from the top menu to compare packages. If a payment has failed or you need billing help, contact support@syllabus-synk.in.";
  }
  if (q.includes("razorpay") || q.includes("pay")) {
    return "For Indian schools, payments are handled through Razorpay. If checkout does not open, refresh the page, confirm you selected INR pricing, and try again. For payment confirmation problems, contact support@syllabus-synk.in.";
  }
  if (q.includes("calendar") || q.includes("holiday") || q.includes("exam") || q.includes("event")) {
    return "To prepare the academic calendar, first add the academic year dates, weekly offs, holidays, exam windows, and school events. Then generate the annual calendar so Syllabus Synk can calculate real teaching capacity before syllabus planning.";
  }
  if (q.includes("teacher") || q.includes("copilot")) {
    return "Teacher Copilot helps draft lesson strategies, classroom activities, homework, rubrics, and projects. It is part of the AI Leadership Suite available in Plus plans.";
  }
  if (q.includes("parent") || q.includes("message") || q.includes("notice")) {
    return "Parent Communication Hub can draft parent notices, PTM messages, reminders, and progress updates for review before sending. It is part of the AI Leadership Suite in Plus plans.";
  }
  if (q.includes("export") || q.includes("pdf") || q.includes("docx") || q.includes("watermark")) {
    return "PDF and DOCX exports are available from curriculum result pages. Free preview exports may be watermarked. Subscribe to the correct plan to unlock full annual exports without demo watermark.";
  }
  if (q.includes("login") || q.includes("sign") || q.includes("password")) {
    return "Use the Sign in page to log in or create an account. If email confirmation is enabled, check your inbox. Never share your password or OTP with anyone. For account access help, contact support@syllabus-synk.in.";
  }
  return `I can help with academic year setup, syllabus generation, subscriptions, AI Leadership Suite, AI Future Workforce, exports, and troubleshooting${page ? ` on this page (${page})` : ""}. Tell me what you are trying to do, and I will guide you step by step. For urgent support, email support@syllabus-synk.in.`;
}

async function projectStatusKnowledge() {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const content = await readFile(join(process.cwd(), "PROJECT_STATUS.md"), "utf8");
    return `Living project status document:\n${content.slice(0, 24000)}`;
  } catch {
    return "Living project status document: PROJECT_STATUS.md could not be loaded in this environment.";
  }
}

async function aiAnswer(data: z.infer<typeof helpInput>) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return null;

  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const { generateText } = await import("ai");
  const provider = createOpenAICompatible({
    name: "syllabus-synk-support",
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKey,
  });

  const history = data.history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = [
    `Current page: ${data.page || "unknown"}`,
    history ? `Recent chat:\n${history}` : "",
    `User question: ${data.message}`,
  ].filter(Boolean).join("\n\n");
  const statusKnowledge = await projectStatusKnowledge();

  const result = await generateText({
    model: provider(model),
    system: [
      "You are the Syllabus Synk AI Help Assistant.",
      "Answer only about using the product, academic planning, school workflows, subscriptions, AI Future Workforce, and support.",
      "Be concise, practical, and step-by-step.",
      "For broad feature questions, explain what the feature does, who uses it, where to find it, and any current limitations from the living project status.",
      "Never ask for passwords, OTPs, service role keys, API secrets, or payment card details.",
      "If unsure or if the issue is billing/account-specific, send the user to support@syllabus-synk.in.",
      KNOWLEDGE_BASE,
      statusKnowledge,
    ].join("\n\n"),
    prompt,
    temperature: 0.3,
  });

  return result.text.trim();
}

export const askAiHelpAssistant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => helpInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const ai = await aiAnswer(data);
      return { answer: ai ?? localAnswer(data.message, data.page), provider: ai ? "ai" : "local" };
    } catch (e: any) {
      return {
        answer: `${localAnswer(data.message, data.page)}\n\nAI provider note: ${e?.message ?? "unavailable"}`,
        provider: "local",
      };
    }
  });
