// Single source of truth for subscription tiers, grade entitlements, limits,
// AI credit costs, and add-on pricing. price_id is stable across sandbox and
// live (resolved via Stripe lookup_key).

export type TierId =
  | "retail_single_access"
  | "bundle_primary_access"
  | "bundle_middle_access"
  | "bundle_high_access"
  | "enterprise_global_access";

export type Currency = "usd" | "inr";
export type BillingInterval = "monthly" | "annual";

export interface PlanPrice {
  priceId: string;
  amount: number;
  currency: Currency;
  display: string;
  interval?: BillingInterval;
}

/**
 * Annual rebate eligibility — pay for 10 months, get 12.
 *
 * Rule (per product spec): the rebate aligns with the country's academic
 * session. India's session runs April → March, so the 2-months-free offer
 * applies ONLY when the subscriber starts on or before April. Subscribers
 * who join from May onward pay full annual (12×) — no rebate.
 *
 * For non-India / USD customers we treat any month as eligible (global
 * sessions vary; honoring annual rebate year-round keeps the offer simple).
 */
export function annualRebateEligible(currency: Currency, now: Date = new Date()): boolean {
  if (currency !== "inr") return true;
  // JS months are 0-indexed: Jan=0 ... Apr=3.
  return now.getMonth() <= 3;
}

/** Hard per-plan limits enforced server-side. */
export interface PlanLimits {
  /** Max distinct grades the tenant can plan for. */
  maxGrades: number;
  /** Max subjects per grade. -1 = unlimited. */
  maxSubjectsPerGrade: number;
  /** Seat cap (teacher / staff logins). */
  maxUsers: number;
  /** Annual plan cap. */
  maxAcademicYears: number;
  /** Monthly AI credit allowance. Top-ups extend beyond this. */
  aiCreditsPerMonth: number;
  /** Monthly export cap (PDF / DOCX / XLSX / Google). */
  exportsPerMonth: number;
  /** Storage cap in gigabytes. */
  storageGb: number;
  /** Campus cap. Extra campuses are billed via the `extra_campus` add-on. */
  maxCampuses: number;
  teacherTraining: boolean;
  curriculumRecalibration: "none" | "monthly" | "standard" | "advanced";
  whiteLabel: boolean;
  apiAccess: boolean;
  dedicatedOnboarding: boolean;
  /** Human-readable support SLA string. */
  support: string;
}

export interface Plan {
  id: TierId;
  name: string;
  tagline: string;
  features: string[];
  /** Plain-language restrictions surfaced on the pricing page. */
  restrictions: string[];
  grades: string[] | "all";
  rank: number;
  limits: PlanLimits;
  prices: PlanPrice[];
}

export const ALL_GRADES = [
  "Pre-K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
];

/** AI credit cost per action. Source of truth for fair-use accounting. */
export const AI_ACTION_COSTS = {
  generate_annual_calendar: 50,
  generate_subject_curriculum: 25,
  recalculate_schedule: 20,
  generate_lesson_plan: 5,
  generate_teacher_training: 10,
} as const;

export type AiAction = keyof typeof AI_ACTION_COSTS;

export const PLANS: Plan[] = [
  {
    id: "retail_single_access",
    name: "Retail Single Access",
    tagline: "Individual teachers, tutors, coaching faculty",
    features: ["Single grade", "Single subject", "Capacity engine", "All exports"],
    restrictions: [
      "1 class only",
      "1 subject only",
      "1 user login",
      "1 academic year plan",
      "500 AI credits / month",
      "100 exports / month",
      "No teacher training module",
      "No curriculum recalibration",
      "Email support (48–72 hrs)",
    ],
    grades: [],
    rank: 1,
    limits: {
      maxGrades: 1,
      maxSubjectsPerGrade: 1,
      maxUsers: 1,
      maxAcademicYears: 1,
      aiCreditsPerMonth: 500,
      exportsPerMonth: 100,
      storageGb: 2,
      maxCampuses: 1,
      teacherTraining: false,
      curriculumRecalibration: "none",
      whiteLabel: false,
      apiAccess: false,
      dedicatedOnboarding: false,
      support: "Email (48–72 hrs)",
    },
    prices: [
      { priceId: "retail_single_monthly_usd", amount: 900, currency: "usd", display: "$9/mo", interval: "monthly" },
      { priceId: "retail_single_monthly_inr", amount: 49900, currency: "inr", display: "₹499/mo", interval: "monthly" },
      { priceId: "retail_single_annual_usd", amount: 9000, currency: "usd", display: "$90/yr", interval: "annual" },
      { priceId: "retail_single_annual_inr", amount: 499000, currency: "inr", display: "₹4,990/yr", interval: "annual" },
    ],
  },
  {
    id: "bundle_primary_access",
    name: "Primary Bundle",
    tagline: "Pre-K – Grade 5, all subjects",
    features: ["Pre-K through Grade 5", "All subjects", "Standard curriculum generation", "Monthly recalibration"],
    restrictions: [
      "Up to 5 grades",
      "Up to 20 teacher accounts",
      "2,000 AI credits / month",
      "10 GB storage",
      "Standard reports",
      "Monthly recalibration",
      "Email support (24–48 hrs)",
      "No custom development",
    ],
    grades: ["Pre-K", "K", "1", "2", "3", "4", "5"],
    rank: 2,
    limits: {
      maxGrades: 5,
      maxSubjectsPerGrade: -1,
      maxUsers: 20,
      maxAcademicYears: 3,
      aiCreditsPerMonth: 2000,
      exportsPerMonth: 1000,
      storageGb: 10,
      maxCampuses: 1,
      teacherTraining: false,
      curriculumRecalibration: "monthly",
      whiteLabel: false,
      apiAccess: false,
      dedicatedOnboarding: false,
      support: "Email (24–48 hrs)",
    },
    prices: [
      { priceId: "bundle_primary_monthly_usd", amount: 4900, currency: "usd", display: "$49/mo" },
      { priceId: "bundle_primary_monthly_inr", amount: 199900, currency: "inr", display: "₹1,999/mo" },
    ],
  },
  {
    id: "bundle_middle_access",
    name: "Middle School Bundle",
    tagline: "Grades 6 – 8, all subjects",
    features: ["Grades 6–8", "All subjects", "Advanced reports", "Quarterly teacher webinars"],
    restrictions: [
      "Up to 3 grades",
      "Up to 30 teacher accounts",
      "5,000 AI credits / month",
      "20 GB storage",
      "Advanced reports",
      "Quarterly teacher webinars",
      "Priority email support",
      "No white-labeling",
    ],
    grades: ["6", "7", "8"],
    rank: 3,
    limits: {
      maxGrades: 3,
      maxSubjectsPerGrade: -1,
      maxUsers: 30,
      maxAcademicYears: 3,
      aiCreditsPerMonth: 5000,
      exportsPerMonth: 2000,
      storageGb: 20,
      maxCampuses: 1,
      teacherTraining: true,
      curriculumRecalibration: "standard",
      whiteLabel: false,
      apiAccess: false,
      dedicatedOnboarding: false,
      support: "Priority email",
    },
    prices: [
      { priceId: "bundle_middle_monthly_usd", amount: 9900, currency: "usd", display: "$99/mo" },
      { priceId: "bundle_middle_monthly_inr", amount: 299900, currency: "inr", display: "₹2,999/mo" },
    ],
  },
  {
    id: "bundle_high_access",
    name: "High School Bundle",
    tagline: "Grades 9 – 12, all subjects",
    features: ["Grades 9–12", "Board exam planning tools", "Advanced recalibration", "Phone support"],
    restrictions: [
      "Up to 4 grades",
      "Up to 50 teacher accounts",
      "10,000 AI credits / month",
      "50 GB storage",
      "Board exam planning tools",
      "Advanced recalibration engine",
      "Phone support during working hours",
      "No custom integrations",
    ],
    grades: ["9", "10", "11", "12"],
    rank: 4,
    limits: {
      maxGrades: 4,
      maxSubjectsPerGrade: -1,
      maxUsers: 50,
      maxAcademicYears: 4,
      aiCreditsPerMonth: 10000,
      exportsPerMonth: 5000,
      storageGb: 50,
      maxCampuses: 1,
      teacherTraining: true,
      curriculumRecalibration: "advanced",
      whiteLabel: false,
      apiAccess: false,
      dedicatedOnboarding: false,
      support: "Phone (working hours)",
    },
    prices: [
      { priceId: "bundle_high_monthly_usd", amount: 14900, currency: "usd", display: "$149/mo" },
      { priceId: "bundle_high_monthly_inr", amount: 499900, currency: "inr", display: "₹4,999/mo" },
    ],
  },
  {
    id: "enterprise_global_access",
    name: "Enterprise Global",
    tagline: "Large schools & school groups",
    features: [
      "All grades, all subjects",
      "White-label branding",
      "API access",
      "Dedicated onboarding",
      "Monthly review meeting",
    ],
    restrictions: [
      "Up to 2 campuses included",
      "Up to 200 staff accounts",
      "50,000 AI credits / month",
      "200 GB storage",
      "White-label branding",
      "API access",
      "Dedicated onboarding",
      "Monthly review meeting",
      "Additional campuses: ₹5,000 / $59 per month each",
    ],
    grades: "all",
    rank: 5,
    limits: {
      maxGrades: ALL_GRADES.length,
      maxSubjectsPerGrade: -1,
      maxUsers: 200,
      maxAcademicYears: 10,
      aiCreditsPerMonth: 50000,
      exportsPerMonth: 50000,
      storageGb: 200,
      maxCampuses: 2,
      teacherTraining: true,
      curriculumRecalibration: "advanced",
      whiteLabel: true,
      apiAccess: true,
      dedicatedOnboarding: true,
      support: "Dedicated + monthly review",
    },
    prices: [
      { priceId: "enterprise_global_monthly_usd", amount: 49900, currency: "usd", display: "$499/mo" },
      { priceId: "enterprise_global_monthly_inr", amount: 1499900, currency: "inr", display: "₹14,999/mo" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Add-ons (one-time AI credit packs + per-campus recurring seat)
// ---------------------------------------------------------------------------

export type AddOnId = "ai_credits_500" | "ai_credits_2k" | "extra_campus";

export interface AddOn {
  id: AddOnId;
  name: string;
  description: string;
  /** Credits granted per purchase, or 0 for recurring seat add-ons. */
  creditsGranted: number;
  recurring: boolean;
  prices: PlanPrice[];
}

export const ADD_ONS: AddOn[] = [
  {
    id: "ai_credits_500",
    name: "AI Credits — 500",
    description: "Top-up pack: 500 additional AI credits, never expires.",
    creditsGranted: 500,
    recurring: false,
    prices: [
      { priceId: "ai_credits_500_usd", amount: 599, currency: "usd", display: "$5.99 one-time" },
      { priceId: "ai_credits_500_inr", amount: 49900, currency: "inr", display: "₹499 one-time" },
    ],
  },
  {
    id: "ai_credits_2k",
    name: "AI Credits — 2,000",
    description: "Top-up pack: 2,000 additional AI credits, never expires.",
    creditsGranted: 2000,
    recurring: false,
    prices: [
      { priceId: "ai_credits_2k_usd", amount: 2399, currency: "usd", display: "$23.99 one-time" },
      { priceId: "ai_credits_2k_inr", amount: 199900, currency: "inr", display: "₹1,999 one-time" },
    ],
  },
  {
    id: "extra_campus",
    name: "Additional Campus",
    description: "Add one campus to your Enterprise Global subscription.",
    creditsGranted: 0,
    recurring: true,
    prices: [
      { priceId: "extra_campus_monthly_usd", amount: 5900, currency: "usd", display: "$59 / mo" },
      { priceId: "extra_campus_monthly_inr", amount: 500000, currency: "inr", display: "₹5,000 / mo" },
    ],
  },
];

const ADDON_PRICE_TO_CREDITS: Record<string, number> = Object.fromEntries(
  ADD_ONS.flatMap((a) => a.prices.map((pr) => [pr.priceId, a.creditsGranted] as const)),
);

/** Returns credits granted for a one-time top-up price, or null. */
export function creditsForAddOnPrice(priceId: string | null | undefined): number | null {
  if (!priceId) return null;
  const v = ADDON_PRICE_TO_CREDITS[priceId];
  return v && v > 0 ? v : null;
}

// ---------------------------------------------------------------------------
// Paid services (NOT included in any plan — separate quotation)
// ---------------------------------------------------------------------------

export const PAID_SERVICES = [
  { name: "Teacher training workshop", price: "₹10,000 – 25,000 / session" },
  { name: "Curriculum consulting", price: "₹2,000 – 5,000 / hour" },
  { name: "Board compliance audit", price: "₹25,000 – 1,00,000" },
  { name: "Custom reports", price: "₹10,000+" },
  { name: "Custom software feature", price: "Separate quotation" },
  { name: "On-site visit", price: "Travel + consulting fee" },
  { name: "Data migration", price: "₹10,000 – 50,000" },
] as const;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

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

export function limitsForTier(tier: TierId | null): PlanLimits | null {
  return planForTier(tier)?.limits ?? null;
}

export function aiCostForAction(action: AiAction): number {
  return AI_ACTION_COSTS[action];
}
