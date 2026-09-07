import { LEGACY_PLANS } from "./legacy-plan-entitlements"; // Single source of truth for subscription tiers, grade entitlements, limits,
// AI credit costs, and add-on pricing. price_id is stable across sandbox and
// live (resolved via Stripe lookup_key).

export type TierId =
  | "retail_single_access"
  | "bundle_primary_access"
  | "bundle_primary_plus_access"
  | "bundle_middle_access"
  | "bundle_middle_plus_access"
  | "bundle_high_access"
  | "bundle_high_plus_access"
  | "enterprise_global_access"
  | "enterprise_plus_access";

export type Currency = "usd" | "inr";
export type BillingInterval = "monthly" | "annual";

export interface PlanPrice {
  priceId: string;
  amount: number;
  currency: Currency;
  display: string;
  interval?: BillingInterval;
}

export function annualRebateEligible(_currency: Currency, _now: Date = new Date()): boolean {
  return true;
}

export interface PlanLimits {
  maxGrades: number;
  maxSubjectsPerGrade: number;
  maxUsers: number;
  maxAcademicYears: number;
  aiCreditsPerMonth: number;
  exportsPerMonth: number;
  storageGb: number;
  maxCampuses: number;
  teacherTraining: boolean;
  curriculumRecalibration: "none" | "monthly" | "standard" | "advanced";
  whiteLabel: boolean;
  apiAccess: boolean;
  dedicatedOnboarding: boolean;
  support: string;
}

export interface Plan {
  id: TierId;
  name: string;
  tagline: string;
  features: string[];
  restrictions: string[];
  grades: string[] | "all";
  rank: number;
  limits: PlanLimits;
  prices: PlanPrice[];
}

export const ALL_GRADES = [
  "Pre-K",
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

export const AI_ACTION_COSTS = {
  generate_annual_calendar: 50,
  generate_subject_curriculum: 25,
  recalculate_schedule: 20,
  generate_lesson_plan: 5,
  generate_teacher_training: 10,
} as const;

export type AiAction = keyof typeof AI_ACTION_COSTS;

function prices(
  id: string,
  usd: number,
  inr: number,
  usdDisplay: string,
  inrDisplay: string,
): PlanPrice[] {
  return [
    {
      priceId: `${id}_monthly_usd`,
      amount: usd * 100,
      currency: "usd",
      display: `$${usdDisplay}/mo`,
      interval: "monthly",
    },
    {
      priceId: `${id}_monthly_inr`,
      amount: inr * 100,
      currency: "inr",
      display: `Rs. ${inrDisplay}/mo — Inclusive of GST`,
      interval: "monthly",
    },
    {
      priceId: `${id}_annual_usd`,
      amount: usd * 1000,
      currency: "usd",
      display: `$${Number(usdDisplay.replace(/,/g, "")) * 10}/yr`,
      interval: "annual",
    },
    {
      priceId: `${id}_annual_inr`,
      amount: inr * 1000,
      currency: "inr",
      display: `Rs. ${(inr * 10).toLocaleString("en-IN")}/yr — Inclusive of GST`,
      interval: "annual",
    },
  ];
}

const V2_PLUS_FEATURE =
  "AI Leadership Suite: principal dashboard, teacher copilot, content studio, assessments, academic simulations, teacher/student insights, and parent communication drafts.";

export const PLANS: Plan[] = [
  {
    id: "retail_single_access",
    name: "Retail Single Access",
    tagline: "Individual teachers, tutors, coaching faculty",
    features: ["1 class, 1 subject", "Capacity engine", "All export formats", "500 AI credits/mo"],
    restrictions: [
      "1 user login (no sharing)",
      "1 class, 1 subject",
      "500 AI credits / month",
      "1 GB storage",
      "Email support",
      "No additional users",
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
      storageGb: 1,
      maxCampuses: 1,
      teacherTraining: false,
      curriculumRecalibration: "none",
      whiteLabel: false,
      apiAccess: false,
      dedicatedOnboarding: false,
      support: "Email only",
    },
    prices: prices("retail_single", 9, 590, "9", "590"),
  },
  {
    id: "bundle_primary_access",
    name: "Primary Bundle",
    tagline: "Pre-K to Grade 5, single school",
    features: [
      "Pre-K-Grade 5, all subjects",
      "Up to 6 users",
      "2,000 AI credits/mo",
      "50 GB storage",
    ],
    restrictions: [
      "Single school",
      "Maximum 6 users (extra user: {extra_user_price})",
      "2,000 AI credits / month",
      "50 GB storage",
      "Email support (48 hrs)",
      "Monthly recalibration",
    ],
    grades: ["Pre-K", "K", "1", "2", "3", "4", "5"],
    rank: 2,
    limits: {
      maxGrades: 7,
      maxSubjectsPerGrade: -1,
      maxUsers: 6,
      maxAcademicYears: 3,
      aiCreditsPerMonth: 2000,
      exportsPerMonth: 1000,
      storageGb: 50,
      maxCampuses: 1,
      teacherTraining: false,
      curriculumRecalibration: "monthly",
      whiteLabel: false,
      apiAccess: false,
      dedicatedOnboarding: false,
      support: "Email (48 hrs)",
    },
    prices: prices("bundle_primary", 29, 3540, "29", "3,540"),
  },
  {
    id: "bundle_middle_access",
    name: "Middle School Bundle",
    tagline: "Grades 6-8, single school",
    features: [
      "Grades 6-8, all subjects",
      "Up to 10 users",
      "4,000 AI credits/mo",
      "100 GB storage",
    ],
    restrictions: [
      "Single school",
      "Maximum 10 users (extra user: {extra_user_price})",
      "4,000 AI credits / month",
      "100 GB storage",
      "Priority email support",
      "Standard recalibration",
    ],
    grades: ["6", "7", "8"],
    rank: 4,
    limits: {
      maxGrades: 3,
      maxSubjectsPerGrade: -1,
      maxUsers: 10,
      maxAcademicYears: 3,
      aiCreditsPerMonth: 4000,
      exportsPerMonth: 2500,
      storageGb: 100,
      maxCampuses: 1,
      teacherTraining: true,
      curriculumRecalibration: "standard",
      whiteLabel: false,
      apiAccess: false,
      dedicatedOnboarding: false,
      support: "Priority Email",
    },
    prices: prices("bundle_middle", 49, 5900, "49", "5,900"),
  },
  {
    id: "bundle_high_access",
    name: "High School Bundle",
    tagline: "Grades 9-12, single school",
    features: [
      "Grades 9-12, all subjects",
      "Up to 18 users",
      "6,500 AI credits/mo",
      "200 GB storage",
    ],
    restrictions: [
      "Single school",
      "Maximum 18 users (extra user: {extra_user_price})",
      "6,500 AI credits / month",
      "200 GB storage",
      "Phone + Email support",
      "Board exam planning",
      "Advanced recalibration",
    ],
    grades: ["9", "10", "11", "12"],
    rank: 6,
    limits: {
      maxGrades: 4,
      maxSubjectsPerGrade: -1,
      maxUsers: 18,
      maxAcademicYears: 4,
      aiCreditsPerMonth: 6500,
      exportsPerMonth: 6000,
      storageGb: 200,
      maxCampuses: 1,
      teacherTraining: true,
      curriculumRecalibration: "advanced",
      whiteLabel: false,
      apiAccess: false,
      dedicatedOnboarding: false,
      support: "Phone + Email",
    },
    prices: prices("bundle_high", 69, 8260, "69", "8,260"),
  },
  {
    id: "enterprise_global_access",
    name: "Enterprise",
    tagline: "Single campus, full K-12",
    features: [
      "All grades, all subjects",
      "Up to 60 users",
      "25,000 AI credits/mo",
      "400 GB storage",
    ],
    restrictions: [
      "1 campus only (extra campus: {extra_campus_price})",
      "Maximum 60 users (extra user: {extra_user_price})",
      "25,000 AI credits / month",
      "400 GB storage",
      "Dedicated account manager",
      "White-label branding",
      "API access",
      "Dedicated onboarding",
    ],
    grades: "all",
    rank: 8,
    limits: {
      maxGrades: ALL_GRADES.length,
      maxSubjectsPerGrade: -1,
      maxUsers: 60,
      maxAcademicYears: 10,
      aiCreditsPerMonth: 25000,
      exportsPerMonth: 50000,
      storageGb: 400,
      maxCampuses: 1,
      teacherTraining: true,
      curriculumRecalibration: "advanced",
      whiteLabel: true,
      apiAccess: true,
      dedicatedOnboarding: true,
      support: "Dedicated Account Manager",
    },
    prices: prices("enterprise_global", 179, 21240, "179", "21,240"),
  },
];

export type AddOnId =
  | "ai_credits_500"
  | "ai_credits_2k"
  | "ai_credits_10k"
  | "extra_campus"
  | "extra_user"
  | "extra_storage_25gb"
  | "extra_storage_50gb"
  | "extra_storage_100gb"
  | "extra_storage_250gb"
  | "extra_storage_500gb"
  | "ai_future_force_primary"
  | "ai_future_force_middle"
  | "ai_future_force_higher"
  | "ai_future_force_enterprise";

export interface AddOn {
  id: AddOnId;
  name: string;
  description: string;
  creditsGranted: number;
  recurring: boolean;
  prices: PlanPrice[];
}

export const ADD_ONS: AddOn[] = [
  {
    id: "extra_user",
    name: "Additional User Seat",
    description: "Add one extra user seat beyond your plan's base seat count. Recurring monthly.",
    creditsGranted: 0,
    recurring: true,
    prices: [
      {
        priceId: "extra_user_monthly_usd",
        amount: 250,
        currency: "usd",
        display: "$2.50 / mo per seat",
      },
      {
        priceId: "extra_user_monthly_inr",
        amount: 23600,
        currency: "inr",
        display: "Rs. 236 / mo per seat — Inclusive of GST",
      },
    ],
  },
  {
    id: "extra_campus",
    name: "Additional Campus",
    description: "Add one extra campus to your Enterprise subscription.",
    creditsGranted: 0,
    recurring: true,
    prices: [
      { priceId: "extra_campus_monthly_usd", amount: 5900, currency: "usd", display: "$59 / mo" },
      {
        priceId: "extra_campus_monthly_inr",
        amount: 590000,
        currency: "inr",
        display: "Rs. 5,900 / mo — Inclusive of GST",
      },
    ],
  },
  {
    id: "extra_storage_25gb",
    name: "Additional Storage - 25 GB",
    description:
      "Add 25 GB storage to the school's document and academic record storage quota. Recurring monthly.",
    creditsGranted: 0,
    recurring: true,
    prices: [
      {
        priceId: "extra_storage_25gb_monthly_inr",
        amount: 29500,
        currency: "inr",
        display: "Rs. 295 / mo — Inclusive of GST",
        interval: "monthly",
      },
    ],
  },
  {
    id: "extra_storage_50gb",
    name: "Additional Storage - 50 GB",
    description:
      "Add 50 GB storage to the school's document and academic record storage quota. Recurring monthly.",
    creditsGranted: 0,
    recurring: true,
    prices: [
      {
        priceId: "extra_storage_50gb_monthly_inr",
        amount: 59000,
        currency: "inr",
        display: "Rs. 590 / mo — Inclusive of GST",
        interval: "monthly",
      },
    ],
  },
  {
    id: "extra_storage_100gb",
    name: "Additional Storage - 100 GB",
    description:
      "Add 100 GB storage to the school's document and academic record storage quota. Recurring monthly.",
    creditsGranted: 0,
    recurring: true,
    prices: [
      {
        priceId: "extra_storage_100gb_monthly_inr",
        amount: 118000,
        currency: "inr",
        display: "Rs. 1,180 / mo — Inclusive of GST",
        interval: "monthly",
      },
    ],
  },
  {
    id: "extra_storage_250gb",
    name: "Additional Storage - 250 GB",
    description:
      "Add 250 GB storage to the school's document and academic record storage quota. Recurring monthly.",
    creditsGranted: 0,
    recurring: true,
    prices: [
      {
        priceId: "extra_storage_250gb_monthly_inr",
        amount: 236000,
        currency: "inr",
        display: "Rs. 2,360 / mo — Inclusive of GST",
        interval: "monthly",
      },
    ],
  },
  {
    id: "extra_storage_500gb",
    name: "Additional Storage - 500 GB",
    description:
      "Add 500 GB storage to the school's document and academic record storage quota. Recurring monthly.",
    creditsGranted: 0,
    recurring: true,
    prices: [
      {
        priceId: "extra_storage_500gb_monthly_inr",
        amount: 413000,
        currency: "inr",
        display: "Rs. 4,130 / mo — Inclusive of GST",
        interval: "monthly",
      },
    ],
  },
  {
    id: "ai_credits_500",
    name: "AI Credits - 500",
    description: "Top-up pack: 500 additional AI credits, never expires.",
    creditsGranted: 500,
    recurring: false,
    prices: [
      { priceId: "ai_credits_500_usd", amount: 599, currency: "usd", display: "$5.99 one-time" },
      {
        priceId: "ai_credits_500_inr",
        amount: 59000,
        currency: "inr",
        display: "Rs. 590 one-time — Inclusive of GST",
      },
    ],
  },
  {
    id: "ai_credits_2k",
    name: "AI Credits - 2,000",
    description: "Top-up pack: 2,000 additional AI credits, never expires.",
    creditsGranted: 2000,
    recurring: false,
    prices: [
      { priceId: "ai_credits_2k_usd", amount: 2399, currency: "usd", display: "$23.99 one-time" },
      {
        priceId: "ai_credits_2k_inr",
        amount: 236000,
        currency: "inr",
        display: "Rs. 2,360 one-time — Inclusive of GST",
      },
    ],
  },
  {
    id: "ai_credits_10k",
    name: "AI Credits - 10,000",
    description: "Top-up pack: 10,000 additional AI credits, never expires. Best value.",
    creditsGranted: 10000,
    recurring: false,
    prices: [
      { priceId: "ai_credits_10k_usd", amount: 8999, currency: "usd", display: "$89.99 one-time" },
      {
        priceId: "ai_credits_10k_inr",
        amount: 826000,
        currency: "inr",
        display: "Rs. 8,260 one-time — Inclusive of GST",
      },
    ],
  },
];

const ADDON_PRICE_TO_CREDITS: Record<string, number> = Object.fromEntries(
  ADD_ONS.flatMap((a) => a.prices.map((pr) => [pr.priceId, a.creditsGranted] as const)),
);

const ADDON_PRICE_TO_STORAGE_GB: Record<string, number> = {
  extra_storage_25gb_monthly_inr: 25,
  extra_storage_50gb_monthly_inr: 50,
  extra_storage_100gb_monthly_inr: 100,
  extra_storage_250gb_monthly_inr: 250,
  extra_storage_500gb_monthly_inr: 500,
};

export function creditsForAddOnPrice(priceId: string | null | undefined): number | null {
  if (!priceId) return null;
  const v = ADDON_PRICE_TO_CREDITS[priceId];
  return v && v > 0 ? v : null;
}

export function storageGbForAddOnPrice(priceId: string | null | undefined): number | null {
  if (!priceId) return null;
  return ADDON_PRICE_TO_STORAGE_GB[priceId] ?? null;
}

export const PAID_SERVICES = [
  { name: "Teacher training workshop", price: "Rs. 11,800 - 29,500 / session — Inclusive of GST" },
  { name: "Curriculum consulting", price: "Rs. 2,360 - 5,900 / hour — Inclusive of GST" },
  { name: "Board compliance audit", price: "Rs. 29,500 - 1,18,000 — Inclusive of GST" },
  { name: "Custom reports", price: "Contact Us — GST-inclusive quotation" },
  { name: "Custom software feature", price: "Separate quotation" },
  { name: "On-site visit", price: "Travel + consulting fee" },
  { name: "Data migration", price: "Contact Us — GST-inclusive quotation" },
  { name: "Additional storage - 1 TB", price: "Custom Pricing" },
] as const;

const PRICE_TO_TIER: Record<string, TierId> = Object.fromEntries(
  PLANS.flatMap((p) => p.prices.map((pr) => [pr.priceId, p.id] as const)),
);

export function tierForPriceId(priceId: string | null | undefined): TierId | null {
  if (!priceId) return null;
  return (
    PRICE_TO_TIER[priceId] ??
    LEGACY_PLANS.find((p) => priceId.startsWith(p.id.replace(/_access$/, "") + "_"))?.id ??
    null
  );
}

export function planForTier(tier: TierId | null): Plan | null {
  if (!tier) return null;
  return [...PLANS, ...LEGACY_PLANS].find((p) => p.id === tier) ?? null;
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

export function addOnPriceDisplay(addOnId: AddOnId, currency: Currency): string {
  const addon = ADD_ONS.find((a) => a.id === addOnId);
  if (!addon) return "";
  const price = addon.prices.find((p) => p.currency === currency);
  return price?.display ?? "";
}

export function planDisplayRestrictions(plan: Plan, currency: Currency): string[] {
  const extraUser = addOnPriceDisplay("extra_user", currency);
  const extraCampus = addOnPriceDisplay("extra_campus", currency);
  return plan.restrictions.map((r) =>
    r.replace("{extra_user_price}", extraUser).replace("{extra_campus_price}", extraCampus),
  );
}

export function purchasablePrice(priceId: string) {
  for (const item of PLANS) {
    const price = item.prices.find((p) => p.priceId === priceId);
    if (price) return { item, price, recurring: true };
  }
  for (const item of ADD_ONS) {
    const price = item.prices.find((p) => p.priceId === priceId);
    if (price) return { item, price, recurring: item.recurring };
  }
  return null;
}
export function gstInclusiveBreakdown(totalMinor: number, currency: string) {
  const taxableMinor =
    currency.toLowerCase() === "inr" ? Math.round(totalMinor / 1.18) : totalMinor;
  return { taxableMinor, gstMinor: totalMinor - taxableMinor, totalMinor };
}
