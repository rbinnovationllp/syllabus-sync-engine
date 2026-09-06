import { describe, expect, it } from "bun:test";
import { AI_EDUCATION_PREMIUM_DEFAULT_PACKAGES } from "../ai-education-premium";

describe("AI Education Premium class pricing", () => {
  it("uses the required group-package prices", () => {
    const price = (code: string) => AI_EDUCATION_PREMIUM_DEFAULT_PACKAGES.find((x) => x.code === code)!;
    expect(price("classes_1_2").monthlyInr).toBe(2000);
    expect(price("classes_3_5").annualInr).toBe(30000);
    expect(price("classes_1_5").monthlyInr).toBe(5000);
    expect(price("classes_1_8").monthlyInr).toBe(7000);
    expect(price("classes_1_10").monthlyInr).toBe(9000);
    expect(price("classes_1_12").monthlyInr).toBe(12000);
    expect(price("classes_1_12").annualInr).toBe(120000);
  });
});
