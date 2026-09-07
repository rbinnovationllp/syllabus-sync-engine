/** Prices come exclusively from the database catalog. No purchasable fallback. */
export type AiEducationPremiumPackage = {
  code: string;
  label: string;
  grades: string[];
  monthlyInr: number;
  annualInr: number;
  currency: string;
  active: boolean;
  featured: boolean;
  gstRate: number;
  gstInclusive: boolean;
  groupKind: "group" | "school";
};
export function formatMoney(amount: number, currency = "inr") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount);
}
export const formatInr = (amount: number) => formatMoney(amount);
export function packageAvailable(row: any, now = Date.now()): boolean {
  return (
    row?.active === true &&
    (!row.effective_from || Date.parse(row.effective_from) <= now) &&
    (!row.effective_to || Date.parse(row.effective_to) > now)
  );
}
export function packageFromRow(row: any): AiEducationPremiumPackage {
  return {
    code: row.code,
    label: row.label,
    grades: row.grades,
    monthlyInr: row.monthly_price_inr,
    annualInr: row.annual_price_inr,
    currency: row.currency,
    active: row.active,
    featured: row.featured,
    gstRate: Number(row.gst_rate),
    gstInclusive: row.gst_inclusive,
    groupKind: row.group_kind,
  };
}
export function priceBreakdown(item: AiEducationPremiumPackage, interval: "monthly" | "annual") {
  const listed = Math.round((interval === "monthly" ? item.monthlyInr : item.annualInr) * 100);
  const base = item.gstInclusive ? Math.round(listed / (1 + item.gstRate / 100)) : listed;
  const total = item.gstInclusive ? listed : base + Math.round((base * item.gstRate) / 100);
  return { base, tax: total - base, total };
}
export function entitlementActive(row: any, now = Date.now()): boolean {
  const sub = row.ai_education_premium_subscriptions;
  return (
    row.status === "active" &&
    ["active", "cancelled"].includes(sub?.status) &&
    !!row.starts_at &&
    !!row.ends_at &&
    !!sub.starts_at &&
    !!sub.renews_at &&
    Date.parse(row.starts_at) <= now &&
    Date.parse(row.ends_at) > now &&
    Date.parse(sub.starts_at) <= now &&
    Date.parse(sub.renews_at) > now
  );
}
