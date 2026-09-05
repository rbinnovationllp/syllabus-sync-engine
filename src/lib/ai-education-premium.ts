export type AiEducationPremiumInterval = "monthly" | "annual";

export type AiEducationPremiumClassPrice = {
  grade: string;
  monthlyInr: number;
  annualInr: number;
  active: boolean;
};

/**
 * Client-safe fallback only. The database catalog is authoritative after the
 * migration is applied; this keeps the pricing UI useful during deployment.
 */
export const AI_EDUCATION_PREMIUM_DEFAULT_PRICES: AiEducationPremiumClassPrice[] = [
  ["1", 5000], ["2", 5000], ["3", 6000], ["4", 6000], ["5", 6000],
  ["6", 8000], ["7", 8000], ["8", 8000], ["9", 10000], ["10", 10000],
  ["11", 15000], ["12", 15000],
].map(([grade, monthlyInr]) => ({ grade: String(grade), monthlyInr: Number(monthlyInr), annualInr: Number(monthlyInr) * 10, active: true }));

export function calculateAiEducationPremium(
  selectedGrades: string[],
  prices: AiEducationPremiumClassPrice[] = AI_EDUCATION_PREMIUM_DEFAULT_PRICES,
) {
  const selected = prices.filter((price) => price.active && selectedGrades.includes(price.grade));
  return {
    selected,
    monthlyInr: selected.reduce((total, price) => total + price.monthlyInr, 0),
    annualInr: selected.reduce((total, price) => total + price.annualInr, 0),
  };
}

export const formatInr = (amount: number) => `₹${new Intl.NumberFormat("en-IN").format(amount)}`;
