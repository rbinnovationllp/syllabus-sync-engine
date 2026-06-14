// Single source of truth for subscription tiers, grade entitlements, and pricing.
// price_id is stable across sandbox and live (resolved via Stripe lookup_key).

export type TierId =
  | "retail_single_access"
  | "bundle_primary_access"
  | "bundle_middle_access"
  | "bundle_high_access"
  | "enterprise_global_access";

export type Currency = "usd" | "inr";

export interface PlanPrice {
  priceId: string;
  amount: number;
  currency: Currency;
  display: string;
}

export interface Plan {
  id: TierId;
  name: string;
  tagline: string;
  features: string[];
  grades: string[] | "all";
  rank: number;
  prices: PlanPrice[];
}

export const ALL_GRADES = [
  "Pre-K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
];

export const PLANS: Plan[] = [
  {
    id: "retail_single_access",
    name: "Retail Single Access",
    tagline: "1 class, 1 subject",
    features: ["Single grade", "Single subject", "Capacity engine", "All exports"],
    grades: [],
    rank: 1,
    prices: [
      { priceId: "retail_single_monthly_usd", amount: 900, currency: "usd", display: "$9/mo" },
      { priceId: "retail_single_monthly_inr", amount: 49900, currency: "inr", display: "₹499/mo" },
    ],
  },
  {
    id: "bundle_primary_access",
    name: "Primary Bundle",
    tagline: "Pre-K – Grade 5, all subjects",
    features: ["Pre-K through Grade 5", "All subjects", "Teacher training", "All exports"],
    grades: ["Pre-K", "K", "1", "2", "3", "4", "5"],
    rank: 2,
    prices: [
      { priceId: "bundle_primary_monthly_usd", amount: 4900, currency: "usd", display: "$49/mo" },
      { priceId: "bundle_primary_monthly_inr", amount: 199900, currency: "inr", display: "₹1,999/mo" },
    ],
  },
  {
    id: "bundle_middle_access",
    name: "Middle School Bundle",
    tagline: "Grades 6 – 8, all subjects",
    features: ["Grades 6–8", "All subjects", "Teacher training", "All exports"],
    grades: ["6", "7", "8"],
    rank: 3,
    prices: [
      { priceId: "bundle_middle_monthly_usd", amount: 9900, currency: "usd", display: "$99/mo" },
      { priceId: "bundle_middle_monthly_inr", amount: 299900, currency: "inr", display: "₹2,999/mo" },
    ],
  },
  {
    id: "bundle_high_access",
    name: "High School Bundle",
    tagline: "Grades 9 – 12, all subjects",
    features: ["Grades 9–12", "Board exam guardrails", "Teacher training", "All exports"],
    grades: ["9", "10", "11", "12"],
    rank: 4,
    prices: [
      { priceId: "bundle_high_monthly_usd", amount: 14900, currency: "usd", display: "$149/mo" },
      { priceId: "bundle_high_monthly_inr", amount: 499900, currency: "inr", display: "₹4,999/mo" },
    ],
  },
  {
    id: "enterprise_global_access",
    name: "Enterprise Global",
    tagline: "Multi-campus, white-label, dedicated support",
    features: [
      "All grades, all subjects",
      "Multi-campus & white-label",
      "AI curriculum + teacher training",
      "Consulting & board compliance",
      "Dedicated support",
    ],
    grades: "all",
    rank: 5,
    prices: [
      { priceId: "enterprise_global_monthly_usd", amount: 49900, currency: "usd", display: "$499/mo" },
      { priceId: "enterprise_global_monthly_inr", amount: 1499900, currency: "inr", display: "₹14,999/mo" },
    ],
  },
];

const PRICE_TO_TIER: Record<string, TierId> = Object.fromEntries(
  PLANS.flatMap((p) => p.prices.map((pr) => [pr.priceId, p.id] as const)),
);

export function tierForPriceId(priceId: string | null | undefined): TierId | null {
  if (!priceId) return null;
  return PRICE_TO_TIER[priceId] ?? null;
}

export function planForTier(tier: TierId | null): Plan | null {
  if (!tier) return null;
  return PLANS.find((p) => p.id === tier) ?? null;
}

export function gradesEntitled(tier: TierId | null): string[] {
  const plan = planForTier(tier);
  if (!plan) return [];
  return plan.grades === "all" ? ALL_GRADES : plan.grades;
}

export function hasGradeAccess(tier: TierId | null, grade: string): boolean {
  const plan = planForTier(tier);
  if (!plan) return false;
  if (plan.grades === "all") return true;
  if (plan.id === "retail_single_access") return true;
  return plan.grades.includes(grade);
}
