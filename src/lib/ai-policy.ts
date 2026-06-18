// Client-safe AI policy: allowed models, USD pricing, and per-action cost
// estimator. Used by the cost-estimator dashboard, the admin model-picker,
// and the server-side policy resolver. Never import server secrets here.
import { AI_ACTION_COSTS, type AiAction } from "@/lib/plans";

export type AllowedModel =
  | "google/gemini-2.5-flash"
  | "google/gemini-2.5-flash-lite"
  | "google/gemini-3-flash-preview"
  | "google/gemini-3.1-flash-lite"
  | "google/gemini-3.5-flash";

/** Anything NOT in this list is rejected by the gateway policy layer. */
export const ALLOWED_MODELS: AllowedModel[] = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-flash-lite",
  "google/gemini-3.5-flash",
];

/** Models explicitly blocked from being set as a tenant's default. */
export const BLOCKED_MODELS = [
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-5.2",
  "openai/gpt-5.4",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.4-pro",
  "openai/gpt-5.5",
  "openai/gpt-5.5-pro",
  "google/gemini-2.5-pro",
  "google/gemini-3.1-pro-preview",
];

export const DEFAULT_MODEL: AllowedModel = "google/gemini-2.5-flash";
export const FALLBACK_MODEL: AllowedModel = "google/gemini-2.5-flash-lite";
/** Used ONLY when the org explicitly opts in to escalation and a run is
 *  flagged as low-confidence by the validator. Still a flash model. */
export const ESCALATION_MODEL: AllowedModel = "google/gemini-3.5-flash";

/** Approx USD cost per 1M tokens (input / output) — published Gateway rates. */
export const MODEL_PRICING: Record<AllowedModel, { input: number; output: number; tier: "ultra-low" | "low" | "balanced" }> = {
  "google/gemini-2.5-flash-lite": { input: 0.075, output: 0.30, tier: "ultra-low" },
  "google/gemini-3.1-flash-lite": { input: 0.10, output: 0.40, tier: "ultra-low" },
  "google/gemini-2.5-flash":      { input: 0.30, output: 2.50, tier: "low" },
  "google/gemini-3-flash-preview":{ input: 0.30, output: 2.50, tier: "low" },
  "google/gemini-3.5-flash":      { input: 0.40, output: 3.00, tier: "balanced" },
};

/** Rough token budget per action (input prompt + output JSON). Used by the
 *  cost estimator. Tuned to the prompts in ai-generation.functions.ts. */
export const ACTION_TOKEN_ESTIMATES: Record<AiAction, { input: number; output: number }> = {
  generate_annual_calendar:     { input: 4_500, output: 6_000 },
  generate_subject_curriculum:  { input: 3_500, output: 5_000 },
  recalculate_schedule:         { input: 8_000, output: 6_000 },
  generate_lesson_plan:         { input: 1_500, output: 1_500 },
  generate_teacher_training:    { input: 2_000, output: 2_500 },
};

/** Revenue per credit (target). 500 credits in the $9 retail tier = $0.018 */
export const CREDIT_REVENUE_USD = 0.018;
/** Top-up pack revenue per credit (500-pack @ $5.99). */
export const TOPUP_CREDIT_REVENUE_USD = 5.99 / 500;

export interface CostEstimate {
  model: AllowedModel;
  action: AiAction;
  inputTokens: number;
  outputTokens: number;
  /** Provider USD cost for one run. */
  providerUsd: number;
  /** Credits charged to the user for this action. */
  credits: number;
  /** Revenue the action generates (credits × revenue/credit). */
  revenueUsd: number;
  /** revenueUsd − providerUsd. */
  grossUsd: number;
  /** Margin %. */
  marginPct: number;
}

export function estimateActionCost(
  action: AiAction,
  model: AllowedModel = DEFAULT_MODEL,
  opts: { revenuePerCredit?: number } = {},
): CostEstimate {
  const tokens = ACTION_TOKEN_ESTIMATES[action];
  const price = MODEL_PRICING[model];
  const providerUsd =
    (tokens.input / 1_000_000) * price.input +
    (tokens.output / 1_000_000) * price.output;
  const credits = AI_ACTION_COSTS[action];
  const revenuePerCredit = opts.revenuePerCredit ?? CREDIT_REVENUE_USD;
  const revenueUsd = credits * revenuePerCredit;
  const grossUsd = revenueUsd - providerUsd;
  const marginPct = revenueUsd > 0 ? (grossUsd / revenueUsd) * 100 : 0;
  return {
    model,
    action,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    providerUsd,
    credits,
    revenueUsd,
    grossUsd,
    marginPct,
  };
}

/** Estimate cost for an entire generated calendar (annual + N subjects). */
export function estimateCalendarBundleCost(
  subjects: number,
  model: AllowedModel = DEFAULT_MODEL,
  opts: { revenuePerCredit?: number } = {},
) {
  const annual = estimateActionCost("generate_annual_calendar", model, opts);
  const oneSubject = estimateActionCost("generate_subject_curriculum", model, opts);
  return {
    model,
    annual,
    subjects,
    perSubject: oneSubject,
    providerUsd: annual.providerUsd + oneSubject.providerUsd * subjects,
    credits: annual.credits + oneSubject.credits * subjects,
    revenueUsd: annual.revenueUsd + oneSubject.revenueUsd * subjects,
    get grossUsd() { return this.revenueUsd - this.providerUsd; },
    get marginPct() {
      return this.revenueUsd > 0 ? (this.grossUsd / this.revenueUsd) * 100 : 0;
    },
  };
}

export function isAllowedModel(m: string): m is AllowedModel {
  return (ALLOWED_MODELS as string[]).includes(m);
}
