import { z } from "zod";

export const teachingPlanSchema = z.object({
  full_lesson: z.object(Object.fromEntries("ABCDEFGHIJKLMNOPQR".split("").map(key => [key, z.string().min(1)])) as Record<string, z.ZodString>),
  title: z.string().min(1).max(200), what_to_teach: z.string().min(1), why_appropriate: z.string().min(1), when_to_teach: z.string().min(1),
  learning_outcomes: z.array(z.string()).min(1).max(8), teacher_guidance: z.string().min(1), teaching_script: z.string().min(1),
  lesson_timeline: z.array(z.object({ time: z.string(), stage: z.string(), teacher_action: z.string(), student_action: z.string() })).min(1),
  activity: z.object({ title:z.string(), materials:z.array(z.string()), steps:z.array(z.string()), offline_alternative:z.string() }),
  student_practice: z.string().min(1), understanding_check: z.object({ questions:z.array(z.string()).min(1), expected_answers:z.array(z.string()).min(1) }),
  responsible_ai_note: z.string().min(1), next_step: z.string().min(1), teacher_preparation: z.array(z.string()),
});
export type TeachingPlan = z.infer<typeof teachingPlanSchema>;

export const annualPlanSchema = z.object({
  title: z.string().min(1).max(200),
  grade_progression: z.string().min(1),
  periods_per_week: z.literal(2),
  modules: z.array(z.object({
    week_start: z.number().int().min(1).max(60), week_end: z.number().int().min(1).max(60),
    title: z.string().min(1), competencies: z.array(z.string()).min(1).max(12),
    learning_objectives: z.array(z.string()).min(1).max(8), period_type: z.enum(["teaching", "practical", "project", "revision", "assessment", "buffer"]),
    prerequisite_competencies: z.array(z.string()).default([]), responsible_ai_focus: z.string().min(1), bharat_context: z.string().min(1),
  })).min(6).max(30),
  assessment_strategy: z.string().min(1), progress_tracking: z.string().min(1),
  teacher_notes: z.string().min(1),
});
export type AnnualPlan = z.infer<typeof annualPlanSchema>;

export async function generateWithClaude<T extends z.ZodTypeAny = typeof teachingPlanSchema>(system: string, prompt: string, schema: T = teachingPlanSchema as T): Promise<{ plan: z.infer<T>; usage: unknown; model: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_NOT_CONFIGURED");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", signal:controller.signal, headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"}, body:JSON.stringify({ model:process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", max_tokens:12000, temperature:0.2, system, messages:[{role:"user",content:prompt}] }) });
    if (!response.ok) { console.error("[AI Education Premium] Claude error", response.status); throw new Error(response.status === 429 ? "ANTHROPIC_RATE_LIMIT" : "ANTHROPIC_UNAVAILABLE"); }
    const payload:any = await response.json(); const text = payload.content?.find((part:any)=>part.type === "text")?.text;
    if (!text) throw new Error("ANTHROPIC_INVALID_RESPONSE");
    const json = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
    return { plan:schema.parse(json), usage:payload.usage ?? {}, model:payload.model ?? process.env.ANTHROPIC_MODEL ?? "claude" };
  } catch (error:any) {
    if (error?.name === "AbortError") throw new Error("ANTHROPIC_TIMEOUT");
    if (error instanceof z.ZodError || error instanceof SyntaxError) throw new Error("ANTHROPIC_INVALID_RESPONSE");
    throw error;
  } finally { clearTimeout(timeout); }
}
