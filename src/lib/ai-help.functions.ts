import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  escalateAskSynkaiUnknownQuestion,
  getApprovedAskSynkaiKnowledge,
} from "@/lib/ask-synkai-knowledge.functions";

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
Public website assistant name: Ask Synk AI.
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
- Public website: explains CurriculumOS/Syllabus Synk, captures demo leads, shows visitor interest counters, partner/referral entry, AI Leadership Suite, and AI Future Force / AI Future Workforce messaging.
- Ask Synk AI: public-facing visitor assistant on the homepage. It explains Syllabus Synk features, AI Future Force curriculum, sample monthly plans, pricing, implementation, dashboards, FAQs, and demo-request next steps. It should not operate internal curriculum monitoring, teacher tracking, progress analysis, or management reporting; those remain inside authenticated Syllabus Synk administration dashboards.
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
- AI Teaching Assistant / Teacher Copilot: premium teaching-assistance workspace for teachers. For any chapter, topic, sub-topic, or learning objective, teachers can ask "How can I teach this topic effectively?" and receive age-appropriate activity-based teaching methods, classroom demonstrations, practical examples, story-based explanations, role-play suggestions, group activities, project ideas, local environment examples, real-world applications, visual learning ideas, and interactive exercises. It supports Science, Mathematics, Social Science, English, Hindi, languages, Computer Science, Environmental Studies, Commerce, Economics, Geography, History, Physics, Chemistry, Biology, and future subjects.
- AI Teaching Credits: this premium teaching-assistance feature uses a school-controlled credit model. Each school has a monthly AI Teaching Credit pool, with purchased credits able to extend the pool when commercial top-up packs are configured. Example costs are Simple Activity Suggestion = 1 credit, Detailed Activity Plan = 2 credits, Complete Teaching Toolkit = 5 credits, Project-Based Learning Plan = 5 credits, and Multi-Day Activity Module = 10 credits. School Super Admins can allocate monthly AI Teaching Credits to teachers, monitor consumption, and increase or reduce teacher allocations according to school policy. Teachers can see available credits, used credits, history, and estimated cost before generating.
- Syllabus-aware daily teaching assistance: inside Academic Execution, teachers can see today's planned topics from their assigned class/subject and generated subject curriculum. The Daily Teaching Assistant automatically uses available Syllabus Synk context such as class, subject, board, book, chapter, topic, learning objectives, and academic calendar week. Teachers can click Explain Full Topic, Explain Selected Portion, Generate Activity, Generate Real-Life Examples, Generate Teacher Notes, Student Question Help, Beyond Textbook Explanation, or Revision Summary without repeatedly entering chapter details. Advanced daily help consumes AI Teaching Credits according to school policy.
- AI Teaching Innovation Library: useful generated activities can be saved, bookmarked, searched, and reused by teachers without consuming additional credits. This reduces repeated AI cost and helps schools build a practical internal repository of activity-based learning methods.
- Content Studio: creates editable school resources, practice tasks, definitions, worksheets, and support material.
- Assessment Generator: creates editable class tests/exam papers with exam type, grade, subject, chapter range, marks, duration, difficulty mix, question format, answer key, and human review confirmation before download.
- Academic Digital Twin: simulates disruptions such as lost teaching days, affected teachers, exam shifts, recovery recommendations, teacher load pressure, revision risk, and projected readiness.
- Teacher Intelligence: highlights teachers tracked, average completion, high-risk/watch status, pending rows, and pacing interventions.
- Student Intelligence: prepares cohort-style learning insight placeholders and intervention guidance; richer individual student scoring requires connected student assessment/homework/attendance data.
- Parent Communication Hub: drafts PTM messages, parent notices, reminders, progress updates, and intervention communications for human review.
- Academic Execution: teachers record daily teaching progress by assignment, date, planned topic, actual chapter/topics, completion status, periods taken, and remarks; principals/coordinators monitor class-wise, subject-wise, and teacher-wise completion, risk, recent records, daily syllabus exception reports, and Teacher Credit Distribution Recommendations.
- Teacher Credit Distribution Recommendations: School Super Admins can review advisory workload scores in Academic Execution. The engine analyzes assigned classes, subjects, weekly periods, academic responsibilities, examination duties, co-curricular responsibilities, special projects, and recent teaching activity to identify balanced, moderate overload, high overload, or underutilized teachers. Recommendations are advisory only; final decisions remain with school management.
- Teacher Assignments: school admins assign teachers to grades, sections, and subjects, and can revoke assignments.
- Seats: admins invite users as admin, coordinator, teacher, or viewer; invitation links can be copied/revoked; seat limits follow subscription plan plus extra seats.
- School Governance: records official School Super Admin declaration, governance notes, member authority, session registry foundation, and recycle-bin governance.
- School Profile: read-only master profile for school, academic year, holidays, vacations, events, exams, training days, subjects, and audit logs.
- School Storage: AWS S3-backed protected storage for school documents, curriculum files, circulars, exports, and academic records within subscription quota. Supabase stores application data and file metadata, while AWS S3 stores large school files through signed upload/download URLs. School Super Admins can see allocated, used, and available storage; largest files; file-type breakdown; user-wise usage; category usage; archive usage; threshold alerts at 80%, 90%, and 100%; upload blocking at quota limit; add-on storage packs; fair usage policy; enterprise storage options; and academic session archival controls. Paid additional storage packs are automatically provisioned after verified payment, with CRM activity logging, school-admin notifications, audit entries, and exception tickets if allocation fails.
- Data privacy and security: school data remains the property of the respective school. Syllabus Synk acts as a technology platform and custodian only. School data must not be sold, shared, distributed, or commercially used without authorization. Schools are logically isolated, access is role-based, company administrator access is limited to authorized support/troubleshooting/maintenance, and critical access should be audit logged.
- School CRM: lightweight school operations CRM for parent/contact records, admissions enquiries, enquiry stage updates, and follow-up completion.
- Company CRM: super-admin workspace for school accounts, active subscriptions, support/onboarding tickets, plan catalog, visitor conversion, acquisition/referral attribution, and pipeline visibility.
- Admin & CRM: admin dashboard for leads, clients, subscriptions, usage, AI usage, AI model settings, schools, admin access, partner enforcement, curriculum reviews, and audit logs.
- Partner/referral program: partner onboarding, referral code/link, stats, commissions, terms, and enforcement workflow.
- Notifications: in-app notification list, unread counts, mark-read/delete actions, and cron-generated reminders for curriculum risk, disruptions, and assigned teachers.
- Health and audit: super-admin health snapshots, live platform checks, platform audit logs, authenticated activity records, and human review confirmation logs.
- Payments: Indian customer and school payments use Razorpay as the primary gateway for subscriptions, annual plans, additional storage, add-ons, partner-linked payments, and future school services. Stripe remains a modular future-ready option for international markets when activated. Optional UPI guidance can be used as a fallback/manual route where enabled.
- Paid pilot subscription benefit workflow: approved pilot schools are recorded by Company Super Admin as paid pilot subscriptions with pilot dates, plan, MOU reference/link, monthly base amount, GST, gateway/bank/other charges, total paid, and refund/credit eligibility. This must not be described as a free trial. After the two-month pilot, School Super Admin can request either "Continue Subscription and Claim Pilot Credit" or "Discontinue Subscription and Request Refund." Requests remain Pending Company Super Admin Approval until reviewed in Company CRM. Refund and credit calculations are server-side, show base amount and deductions, and support GST treatment as refundable, non-refundable, or manual review. Approved refunds are initiated through Razorpay using the original Razorpay payment ID; approved continuation credits are posted to a school credit ledger and applied to future invoices until exhausted. Company Super Admin approvals require a secure admin code, mandatory reasons for extra deductions, CRM/audit logging, school notifications, and permanent records.
- Billing rules: annual plans are billed as 10x monthly price for two months free; India annual rebate is intended for subscribers joining on or before April. Account-specific billing issues must go to support.
- Plan limits: plans define grade bands, user limits, AI credits, exports, storage, campuses, support level, teacher training, recalibration level, white-label/API/dedicated onboarding where available.
- Additional storage: schools can purchase or be allocated add-on storage packs of 25 GB at Rs. 250/month, 50 GB at Rs. 500/month, 100 GB at Rs. 900/month, 250 GB at Rs. 2,000/month, and 500 GB at Rs. 3,500/month. For 1 TB or larger storage needs, custom enterprise pricing is available through support@syllabus-synk.in.
- Fair usage policy: Each subscription plan includes a defined storage allocation. Additional storage may be purchased separately. The company reserves the right to archive inactive academic records and enforce fair usage policies to maintain platform performance.
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
- Confirmed capability: the web-based software includes a comprehensive AI Future Force Curriculum Planner designed to prepare age-appropriate AI education courses for Classes 1-12.
- It supports grade-wise learning paths for Primary Classes 1-5, Middle Classes 6-8, Higher Secondary Classes 9-12, and Enterprise Classes 1-12.
- Primary students focus on AI awareness, patterns, classification, responsible technology, and familiar smart-device examples.
- Middle school students focus on data labeling, machine learning basics, chatbots, image recognition, AI ethics, bias, and privacy.
- Senior students focus on Python for AI thinking, machine learning, generative AI, prompt engineering, AI agents, and capstone projects.
- Enterprise schools receive a whole-school AI readiness roadmap, teacher enablement, governance guidance, innovation projects, and reporting.
- Schools can schedule one or two AI classes per week so the course fits the existing timetable, examination calendar, revision time, and subject workload.
- The program provides curriculum previews with learning objectives, outcomes, projects, classroom activities, tools, examples, and monthly release planning.
- One-month sample course plan model:
  * Once per week: Week 1 AI awareness or concept introduction, Week 2 guided demonstration, Week 3 classroom activity or worksheet, Week 4 recap, reflection, and short assessment.
  * Twice per week: Week 1 concept plus hands-on demo, Week 2 data/tool activity plus responsible-use discussion, Week 3 mini-project build plus peer review, Week 4 presentation, assessment, and teacher feedback.
  * Primary demo examples: AI in everyday life, patterns, smart devices, safe technology use, poster/story activity.
  * Middle demo examples: data labeling, chatbot basics, image recognition demo, bias/privacy discussion, small worksheet/project.
  * Senior demo examples: Python for AI thinking, prompt engineering, generative AI review, AI agent concepts, capstone problem framing.
- If a school joins in the final month, the system releases an AI Foundation Module first and carries the remaining grade-level curriculum into the next academic session.
- Benefits include AI literacy, responsible AI use, exposure to emerging tools, project-based learning, career awareness, and preparation for future AI-enabled workplaces.
- Future opportunities students can explore include AI engineer, data analyst, machine learning specialist, prompt engineer, robotics and automation roles, AI product roles, AI ethics and governance, cybersecurity, healthcare AI, education technology, business analytics, and other emerging technology careers.
- Teacher preparation matters. Schools should encourage Computer Science and Technology teachers to continuously enhance their AI knowledge and skills so students receive relevant, future-ready education.
- Artificial Intelligence is evolving rapidly across the world. Schools should encourage their Computer Science and Technology teachers to continuously enhance their knowledge and skills in AI so that students receive relevant and future-ready education.
- The AI Future Workforce Team continuously monitors global developments in Artificial Intelligence and emerging technologies. The curriculum for senior students will be regularly updated to incorporate the latest innovations, industry practices, and future workforce requirements, helping students remain prepared for the rapidly changing world of technology.
- The curriculum is periodically reviewed and updated to reflect emerging technologies, industry trends, tools, case studies, and real-world applications.
- Positioning: Syllabus Synk is both an Academic Planning Platform and a Future-Ready Education Ecosystem.

Teacher progress monitoring:
- In authenticated dashboards, teachers can mark scheduled chapters or sessions as Not Started, In Progress, Completed, Partially Completed, or Rescheduled.
- Teacher updates should capture topic taught, date and period, portion completed, student participation, activity/assessment conducted, reason for delay if any, and next planned topic.
- Principal and School Super Admin dashboards should monitor today's AI classes, completed/pending chapters, teacher-wise progress, class-wise completion percentage, delayed/rescheduled lessons, student assessment results, missed progress updates, and monthly completion status.
- Alerts for missing updates or unfinished planned chapters belong to the authenticated admin/dashboard system, not the public Ask Synk AI assistant.

AI assistant maintenance rule:
- The assistant should guide users across every major feature listed above.
- Ask SynkAI uses an approved knowledge-index layer plus static fallback knowledge. Company Super Admin can refresh, review, and approve indexed knowledge sources.
- When PROJECT_STATUS.md is amended, its latest content should be indexed and treated as the living project record for current capabilities, recent changes, known gaps, and production-readiness status.
- If a question concerns a feature that is marked prototype, partial, blocked, or needing work, clearly explain what currently works and what still requires completion.
- If a question is beyond the approved Ask SynkAI knowledge base, answer passively, avoid guessing, and escalate it to the Syllabus Synk support queue for review by support@syllabus-synk.in.

School data assurance:
- All school data stored within Syllabus Synk is protected using industry-standard security practices, access controls, encryption, monitoring, and backup systems.
- Each school's data remains isolated and confidential.
- The platform is designed to prevent unauthorized access, cross-school visibility, and accidental disclosure of information.
- School data remains the property of the respective institution.

Support policy:
- If user has billing, login, payment, or account-access problems, ask them to contact support@syllabus-synk.in.
- Do not claim a payment is successful unless the app or Razorpay confirms it.
- Do not request passwords, OTPs, private keys, service role keys, or payment card details.
- Give step-by-step practical guidance.
`;

function localAnswer(message: string, page?: string | null) {
  const q = message.toLowerCase();
  if (q.includes("one-month") || q.includes("one month") || q.includes("monthly ai course") || q.includes("demo plan")) {
    return "Schools can request a one-month AI Future Force demo plan from the homepage demo form. Select \"Request a One-Month AI Future Force Course Demo Plan\" and share the school name, board/location, classes, preferred frequency once or twice a week, available periods during the month, and contact person details. A simple sample structure is: once weekly - concept, demonstration, classroom activity, recap/assessment; twice weekly - concept plus hands-on demo, tool/data activity, mini-project work, presentation, and assessment.";
  }
  if (
    q.includes("future workforce") ||
    q.includes("future force") ||
    q.includes("ai curriculum") ||
    q.includes("ai education") ||
    q.includes("career") ||
    q.includes("emerging technolog")
  ) {
    return "AI Future Force is Syllabus Synk's optional future-ready AI education program. The web-based software includes a comprehensive curriculum planner for age-appropriate AI courses across Classes 1-12. Schools can plan one or two AI classes per week, request a one-month demo plan, review grade-wise curriculum previews, and introduce AI education without disturbing regular academic classes. It covers AI awareness for primary grades, data and machine-learning basics for middle school, and Python, generative AI, prompt engineering, AI agents, and capstone projects for senior students.";
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
  if (q.includes("pilot") || q.includes("refund") || q.includes("credit note") || q.includes("subscription credit")) {
    return "Syllabus Synk supports a paid pilot subscription benefit workflow. Company Super Admin can mark a school as an approved paid pilot school with MOU, pilot dates, approved plan, base subscription amount, GST, gateway/bank/other deductions, and total paid. After the two-month pilot, the School Super Admin can request either continuation with Pilot Participation Credit or discontinuation with Pilot Refund review from School Governance. Requests go to Company CRM for Company Super Admin approval. Refunds are calculated server-side and, once approved, initiated through Razorpay using the original Razorpay payment ID. Credits are posted to a school credit ledger and applied to future invoices until exhausted. This is not described as a free trial.";
  }
  if (q.includes("free") || q.includes("trial") || q.includes("preview")) {
    return "You can test quality with one free 30-day preview syllabus plan for one subject. Create your academic year, add at least one grade-subject row, then open the results page and click Generate for one subject. Full annual planning and unwatermarked exports require a subscription.";
  }
  if (q.includes("price") || q.includes("plan") || q.includes("subscription") || q.includes("payment")) {
    return "Plans start from Primary Bundle at Rs. 2,999/month. Plus plans include the AI Leadership Suite. For Indian schools, Razorpay is the primary payment gateway for subscriptions, annual plans, add-ons, and additional storage. Stripe remains future-ready for international markets when activated. Open Plans from the top menu to compare packages. If a payment has failed or you need billing help, contact support@syllabus-synk.in.";
  }
  if (q.includes("storage") || q.includes("upload limit") || q.includes("archive") || q.includes("fair usage")) {
    return "School Storage uses AWS S3-backed protected storage for large school files, with Supabase storing application data and file metadata. The School Super Admin dashboard shows allocated, used, and available storage, largest files, category usage, file-type breakdown, user-wise usage, archive usage, and alerts at 80%, 90%, and 100%. Uploads are paused when the quota is full until files are removed, old academic sessions are archived, or additional storage is purchased. Paid storage add-ons are automatically activated after verified payment, and the School Super Admin receives a confirmation notification with previous and new storage limits. Additional storage prices are: 25 GB - Rs. 250/month, 50 GB - Rs. 500/month, 100 GB - Rs. 900/month, 250 GB - Rs. 2,000/month, and 500 GB - Rs. 3,500/month. For 1 TB or more, custom enterprise pricing is available through support@syllabus-synk.in.";
  }
  if (q.includes("teacher credit") || q.includes("workload") || q.includes("teacher load") || q.includes("distribution")) {
    return "School Super Admins can review Teacher Credit Distribution Recommendations inside Academic Execution. The system scores teacher workload using assigned classes, subjects, weekly periods, duties, special projects, and recent teaching activity, then highlights balanced, moderate overload, high overload, or underutilized teachers. These recommendations are advisory; final decisions remain with school management.";
  }
  if (
    q.includes("teach this topic") ||
    q.includes("teaching assistant") ||
    q.includes("activity based") ||
    q.includes("activity-based") ||
    q.includes("teaching credits") ||
    q.includes("teaching idea") ||
    q.includes("classroom demonstration") ||
    q.includes("role play") ||
    q.includes("project based")
  ) {
    return "The AI Teaching Assistant helps teachers answer: \"How can I teach this topic effectively?\" For any chapter, topic, sub-topic, or learning objective, it can generate activity-based methods, demonstrations, practical examples, stories, role-play, group activities, projects, local environment examples, real-world applications, visual ideas, and interactive exercises across subjects. It is a premium credit-based feature: Simple Activity Suggestion costs 1 AI Teaching Credit, Detailed Activity Plan 2, Complete Teaching Toolkit 5, Project-Based Learning Plan 5, and Multi-Day Activity Module 10. School Super Admins allocate monthly credits to teachers and monitor usage. Saved activities can be reused from the AI Teaching Innovation Library without consuming extra credits.";
  }
  if (q.includes("daily teaching") || q.includes("today") && q.includes("topic") || q.includes("planned lesson") || q.includes("syllabus-aware")) {
    return "Syllabus-aware Teaching Assistance is available inside Academic Execution. When teachers open their daily teaching plan, Syllabus Synk can show today's planned topics from assigned class/subject and generated curriculum context. Against each planned topic, teachers can request Explain Full Topic, Explain Selected Portion, Generate Activity, Real-Life Examples, Teacher Notes, Student Question Help, Beyond Textbook Explanation, or Revision Summary. The assistant automatically uses class, subject, board, book, chapter, topic, learning objectives, and academic calendar context, so the teacher does not need to repeatedly enter details already planned in Syllabus Synk. Advanced help consumes AI Teaching Credits as controlled by the School Super Admin.";
  }
  if (q.includes("razorpay") || q.includes("pay")) {
    return "For Indian schools, payments are handled primarily through Razorpay. Razorpay payment success, failure, renewal, cancellation, and refund events should drive subscription status, CRM updates, storage upgrades, invoice/payment confirmation, and exception alerts. If checkout does not open, refresh the page, confirm you selected INR pricing, and try again. For payment confirmation problems, contact support@syllabus-synk.in.";
  }
  if (
    q.includes("privacy") ||
    q.includes("security") ||
    q.includes("confidential") ||
    q.includes("data leak") ||
    q.includes("data ownership") ||
    q.includes("tenant") ||
    q.includes("isolation") ||
    q.includes("encryption") ||
    q.includes("backup")
  ) {
    return "Syllabus Synk treats school data as the property of the respective institution. The platform is designed around tenant isolation, role-based access, audit logging, encrypted transmission/storage practices, controlled exports, backups, and confidentiality commitments. Syllabus Synk acts as a technology custodian and should not sell, share, distribute, or commercially use school data without explicit authorization.";
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
  return `I do not have enough approved information to answer that confidently. I can help with Syllabus Synk features, academic year setup, syllabus generation, subscriptions, AI Leadership Suite, AI Future Force, one-month demo plans, exports, storage, privacy/security, and visitor guidance${page ? ` on this page (${page})` : ""}. I have forwarded this question to the Syllabus Synk support queue for review at support@syllabus-synk.in.`;
}

function priorityAnswer(message: string) {
  const q = message.toLowerCase();
  const asksStorage =
    q.includes("storage") ||
    q.includes("gb") ||
    q.includes("quota") ||
    q.includes("upload limit");
  const asksPrice =
    q.includes("price") ||
    q.includes("pricing") ||
    q.includes("cost") ||
    q.includes("rate") ||
    q.includes("charges") ||
    q.includes("add-on") ||
    q.includes("addon") ||
    q.includes("additional");

  if (asksStorage && asksPrice) {
    return "Additional storage add-on prices for Syllabus Synk are: 25 GB - Rs. 250/month, 50 GB - Rs. 500/month, 100 GB - Rs. 900/month, 250 GB - Rs. 2,000/month, and 500 GB - Rs. 3,500/month. For 1 TB or more, custom enterprise pricing is available through support@syllabus-synk.in. These add-ons increase the school's available storage quota and can be used when uploads are blocked because the current plan quota is full.";
  }

  return null;
}

async function approvedKnowledge() {
  const indexed = await getApprovedAskSynkaiKnowledge();
  if (indexed) return `Approved Ask SynkAI knowledge index:\n${indexed}`;

  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const content = await readFile(join(process.cwd(), "PROJECT_STATUS.md"), "utf8");
    return `Fallback living project status document:\n${content.slice(0, 24000)}`;
  } catch {
    return "Approved Ask SynkAI knowledge index: no approved indexed knowledge could be loaded in this environment.";
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
  const statusKnowledge = await approvedKnowledge();

  const result = await generateText({
    model: provider(model),
    system: [
      "You are Ask Synk AI, the public-facing Syllabus Synk website visitor assistant.",
      "Answer only about using the product, academic planning, school workflows, subscriptions, AI Future Workforce, and support.",
      "Be concise, practical, and step-by-step.",
      "You may explain internal dashboards and monitoring capabilities, but do not claim to operate teacher tracking, curriculum monitoring, progress analysis, or management reporting from the public chat. Direct those actions to authenticated Syllabus Synk dashboards.",
      "When visitors ask for a demo, guide them to the homepage demo form and the one-month AI Future Force demo-plan option.",
      "For broad feature questions, explain what the feature does, who uses it, where to find it, and any current limitations from the living project status.",
      "If the approved knowledge does not contain enough information, say you do not have enough approved information, avoid guessing, and say the question will be sent to support@syllabus-synk.in for review.",
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
      const priority = priorityAnswer(data.message);
      if (priority) return { answer: priority, provider: "local" };

      const ai = await aiAnswer(data);
      const answer = ai ?? localAnswer(data.message, data.page);
      if (answer.includes("I do not have enough approved information")) {
        await escalateAskSynkaiUnknownQuestion({
          question: data.message,
          page: data.page,
          answer,
        });
      }
      return { answer, provider: ai ? "ai" : "local" };
    } catch (e: any) {
      const answer = `${localAnswer(data.message, data.page)}\n\nAI provider note: ${e?.message ?? "unavailable"}`;
      if (answer.includes("I do not have enough approved information")) {
        await escalateAskSynkaiUnknownQuestion({
          question: data.message,
          page: data.page,
          answer,
        }).catch(() => undefined);
      }
      return {
        answer,
        provider: "local",
      };
    }
  });
