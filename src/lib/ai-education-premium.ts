export type AiEducationPremiumPackage = { code: string; label: string; grades: string[]; monthlyInr: number; annualInr: number; active: boolean; featured?: boolean };

/** Client fallback only. The database package catalog is authoritative after migration. */
export const AI_EDUCATION_PREMIUM_DEFAULT_PACKAGES: AiEducationPremiumPackage[] = [
  ["classes_1_2", "Classes 1–2", ["1","2"], 2000, 20000], ["classes_3_5", "Classes 3–5", ["3","4","5"], 3000, 30000], ["classes_6_8", "Classes 6–8", ["6","7","8"], 4000, 40000],
  ["classes_9_10", "Classes 9–10", ["9","10"], 5000, 50000], ["classes_11_12", "Classes 11–12", ["11","12"], 6000, 60000], ["classes_1_5", "Classes 1–5", ["1","2","3","4","5"], 5000, 50000],
  ["classes_1_8", "Classes 1–8", ["1","2","3","4","5","6","7","8"], 7000, 70000], ["classes_1_10", "Classes 1–10", ["1","2","3","4","5","6","7","8","9","10"], 9000, 90000],
  ["classes_1_12", "Complete School AI Education · Classes 1–12", ["1","2","3","4","5","6","7","8","9","10","11","12"], 12000, 120000, true],
].map(([code,label,grades,monthlyInr,annualInr,featured]) => ({ code:String(code), label:String(label), grades:grades as string[], monthlyInr:Number(monthlyInr), annualInr:Number(annualInr), active:true, featured:Boolean(featured) }));

export const formatInr = (amount: number) => `₹${new Intl.NumberFormat("en-IN").format(amount)}`;
