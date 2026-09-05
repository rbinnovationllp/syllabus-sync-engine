import { describe, expect, it } from "bun:test";
import { calculateAiEducationPremium } from "../ai-education-premium";

describe("AI Education Premium class pricing", () => {
  it("uses the required per-class totals", () => {
    expect(calculateAiEducationPremium(["1"]).monthlyInr).toBe(5000);
    expect(calculateAiEducationPremium(["1", "2"]).monthlyInr).toBe(10000);
    expect(calculateAiEducationPremium(["1", "2", "3", "4", "5"]).monthlyInr).toBe(28000);
    expect(calculateAiEducationPremium(["1", "2", "3", "4", "5", "6", "7", "8"]).monthlyInr).toBe(52000);
    expect(calculateAiEducationPremium(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]).monthlyInr).toBe(72000);
    const full = calculateAiEducationPremium(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
    expect(full.monthlyInr).toBe(102000);
    expect(full.annualInr).toBe(1020000);
  });
});
