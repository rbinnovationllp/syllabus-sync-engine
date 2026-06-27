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

Main workflows:
1. Sign up or sign in.
2. Create school profile and academic year.
3. Add holidays, weekly offs, exams, events, and subjects.
4. Generate annual calendar.
5. Generate per-subject curriculum.
6. Export PDF/DOCX where permitted.

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

Support policy:
- If user has billing, login, payment, or account-access problems, ask them to contact support@syllabus-synk.in.
- Do not claim a payment is successful unless the app or Razorpay confirms it.
- Do not request passwords, OTPs, private keys, service role keys, or payment card details.
- Give step-by-step practical guidance.
`;

function localAnswer(message: string, page?: string | null) {
  const q = message.toLowerCase();
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
  return `I can help with academic year setup, syllabus generation, subscriptions, AI Leadership Suite, exports, and troubleshooting${page ? ` on this page (${page})` : ""}. Tell me what you are trying to do, and I will guide you step by step. For urgent support, email support@syllabus-synk.in.`;
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

  const result = await generateText({
    model: provider(model),
    system: [
      "You are the Syllabus Synk AI Help Assistant.",
      "Answer only about using the product, academic planning, school workflows, subscriptions, and support.",
      "Be concise, practical, and step-by-step.",
      "Never ask for passwords, OTPs, service role keys, API secrets, or payment card details.",
      "If unsure or if the issue is billing/account-specific, send the user to support@syllabus-synk.in.",
      KNOWLEDGE_BASE,
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
