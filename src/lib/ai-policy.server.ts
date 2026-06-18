// Server-only AI policy resolver and fallback runner. NEVER import from a
// client module — it pulls in the AI gateway secret loader.
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  ALLOWED_MODELS,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  ESCALATION_MODEL,
  isAllowedModel,
  type AllowedModel,
} from "@/lib/ai-policy";

/** Resolve the active model for a tenant. Falls back to DEFAULT_MODEL. */
export async function resolveTenantModel(
  supabaseAdmin: any,
  orgId: string | null | undefined,
): Promise<{ model: AllowedModel; allowEscalation: boolean }> {
  if (!orgId) return { model: DEFAULT_MODEL, allowEscalation: true };
  const { data } = await supabaseAdmin
    .from("ai_model_settings")
    .select("active_model, allow_fallback_escalation")
    .eq("org_id", orgId)
    .maybeSingle();
  const requested = data?.active_model as string | undefined;
  const model = requested && isAllowedModel(requested) ? requested : DEFAULT_MODEL;
  return { model, allowEscalation: data?.allow_fallback_escalation ?? true };
}

export interface RunOptions {
  /** Tenant org for resolving model preference. */
  orgId?: string | null;
  /** Override model resolution (ignored if not in ALLOWED_MODELS). */
  forceModel?: AllowedModel;
}

/** Run an AI generation with structured output and automatic fallback:
 *  1. primary model → 2. flash-lite fallback on transient error
 *  3. escalation model only if `allowEscalation` AND the first result fails
 *     a confidence check (caller can supply `lowConfidence(output)`).
 */
export async function runAiWithFallback<T>(
  supabaseAdmin: any,
  args: {
    system: string;
    prompt: string;
    schema: z.ZodSchema<T>;
    options?: RunOptions;
    /** Return `true` if output is too weak to ship and escalation should fire. */
    lowConfidence?: (out: T) => boolean;
  },
): Promise<{
  output: T;
  runId?: string;
  modelUsed: AllowedModel;
  attempts: Array<{ model: AllowedModel; ok: boolean; error?: string }>;
  escalated: boolean;
}> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI gateway not configured");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");

  const { model: primary, allowEscalation } = args.options?.forceModel
    ? { model: args.options.forceModel, allowEscalation: false }
    : await resolveTenantModel(supabaseAdmin, args.options?.orgId);

  const order: AllowedModel[] = [primary];
  if (primary !== FALLBACK_MODEL) order.push(FALLBACK_MODEL);

  const attempts: Array<{ model: AllowedModel; ok: boolean; error?: string }> = [];
  let lastError: unknown;
  for (const m of order) {
    if (!ALLOWED_MODELS.includes(m)) continue;
    try {
      const gateway = createLovableAiGatewayProvider(key);
      const { experimental_output } = await generateText({
        model: gateway(m),
        system: args.system,
        prompt: args.prompt,
        experimental_output: Output.object({ schema: args.schema }),
      });
      attempts.push({ model: m, ok: true });

      // Confidence-based escalation. Only fires if tenant opts in.
      if (allowEscalation && args.lowConfidence?.(experimental_output) && m !== ESCALATION_MODEL) {
        try {
          const gw2 = createLovableAiGatewayProvider(key);
          const escalate = await generateText({
            model: gw2(ESCALATION_MODEL),
            system: args.system,
            prompt: args.prompt,
            experimental_output: Output.object({ schema: args.schema }),
          });
          attempts.push({ model: ESCALATION_MODEL, ok: true });
          return {
            output: escalate.experimental_output,
            runId: gw2.getRunId(),
            modelUsed: ESCALATION_MODEL,
            attempts,
            escalated: true,
          };
        } catch (e: any) {
          attempts.push({ model: ESCALATION_MODEL, ok: false, error: e?.message });
          // Fall through with the original-flash output rather than failing.
        }
      }

      return {
        output: experimental_output,
        runId: gateway.getRunId(),
        modelUsed: m,
        attempts,
        escalated: false,
      };
    } catch (e: any) {
      attempts.push({ model: m, ok: false, error: e?.message ?? String(e) });
      lastError = e;
    }
  }
  throw new Error(
    `All AI models failed. Attempts: ${attempts.map((a) => `${a.model}${a.error ? `(${a.error})` : ""}`).join(" → ")}. Last: ${(lastError as Error)?.message ?? "unknown"}`,
  );
}
