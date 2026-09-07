// Imported only inside the Ask Synk AI server-function handler.
export type AiFailureCategory =
  | "configuration" | "authentication" | "billing" | "rate_limit"
  | "unavailable" | "timeout" | "invalid_response";

export class AskSynkaiProviderError extends Error {
  category: AiFailureCategory;
  constructor(category: AiFailureCategory) {
    super("Ask Synk AI is temporarily unavailable");
    this.name = "AskSynkaiProviderError";
    this.category = category;
  }
}

export function publicAiFailure(error: unknown): string {
  const category = error instanceof AskSynkaiProviderError ? error.category : "unavailable";
  if (category === "rate_limit") return "Ask Synk AI is busy right now. Please try again in a minute, or email support@syllabus-synk.in for help.";
  if (category === "timeout") return "Ask Synk AI took too long to respond. Please try again shortly, or email support@syllabus-synk.in for help.";
  return "Ask Synk AI is temporarily unavailable. Please try again later, or email support@syllabus-synk.in for help.";
}

// Only fixed categories and numeric metadata are logged. Never log response bodies,
// prompts, headers, environment values, or arbitrary Error objects.
function log(event: "selected" | "success" | "failure", attempt: number, category?: AiFailureCategory, status?: number) {
  console.info("[ask-synkai]", JSON.stringify({ provider: "anthropic", event, attempt, category, status }));
}

function classify(status: number, body: unknown): AiFailureCategory {
  const error = (body as { error?: { type?: string; message?: string } })?.error;
  // Inspect billing wording only to classify it; never return or log the wording.
  if (status === 402 || (status === 400 && /credit balance|billing|purchase credits|insufficient.*credit/i.test(error?.message ?? ""))) return "billing";
  if (status === 401 || status === 403) return "authentication";
  if (status === 429) return "rate_limit";
  if (status === 400 || status === 404 || status === 422) return "configuration";
  return "unavailable";
}

export async function answerWithClaude(system: string, prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  log("selected", 0);
  if (!key) {
    log("failure", 0, "configuration");
    throw new AskSynkaiProviderError("configuration");
  }
  const skillId = process.env.ANTHROPIC_SKILL_ID?.trim();
  const skillVersion = process.env.ANTHROPIC_SKILL_VERSION?.trim() || "latest";
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
  const messages: Array<{ role: string; content: unknown }> = [{ role: "user", content: prompt }];
  let containerId: string | undefined;
  // One deadline bounds retries and Skill continuation together.
  const signal = AbortSignal.timeout(45_000);
  let transientRetries = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model, max_tokens: 1600, system, messages,
          ...(skillId ? {
            container: { ...(containerId ? { id: containerId } : {}), skills: [{ type: "custom", skill_id: skillId, version: skillVersion }] },
            tools: [{ type: "code_execution_20250825", name: "code_execution" }],
          } : {}),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const category = classify(response.status, payload);
        log("failure", attempt, category, response.status);
        // Never retry authentication, configuration, or billing failures.
        // A single transient retry stays on Anthropic; no other provider exists here.
        if ((category === "rate_limit" || response.status >= 500) && transientRetries++ < 1 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500;
          if (delay <= 2000) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }
        throw new AskSynkaiProviderError(category);
      }
      if (!Array.isArray(payload?.content)) throw new AskSynkaiProviderError("invalid_response");
      if (payload.stop_reason === "pause_turn" && skillId && attempt < 3 && payload.container?.id) {
        containerId = payload.container.id;
        messages.push({ role: "assistant", content: payload.content });
        continue;
      }
      if (payload.stop_reason !== "end_turn") throw new AskSynkaiProviderError("invalid_response");
      const text = payload.content.filter((block: { type?: string; text?: unknown }) => block.type === "text" && typeof block.text === "string")
        .map((block: { text: string }) => block.text).join("\n").trim();
      if (!text) throw new AskSynkaiProviderError("invalid_response");
      log("success", attempt);
      return text;
    } catch (error) {
      if (error instanceof AskSynkaiProviderError) throw error;
      const category = signal.aborted ? "timeout" : "unavailable";
      log("failure", attempt, category);
      throw new AskSynkaiProviderError(category);
    }
  }
  log("failure", 3, "invalid_response");
  throw new AskSynkaiProviderError("invalid_response");
}
