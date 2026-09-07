// Server-only loader for the proprietary Claude teaching-planner skill.
// Never import this module from browser code.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const SKILL_ROOT = join(process.cwd(), "server-skills", "skills", "ai-teaching-planner");
const bandForGrade = (grade: string) => Number(grade) <= 2 ? "classes-1-2.md" : Number(grade) <= 5 ? "classes-3-5.md" : Number(grade) <= 8 ? "classes-6-8.md" : Number(grade) <= 10 ? "classes-9-10.md" : "classes-11-12.md";

async function read(relative: string) { return readFile(join(SKILL_ROOT, relative), "utf8"); }

export async function loadTeachingPlannerSkill(grade: string, purpose: "lesson" | "annual") {
  try {
    const files = await Promise.all([
      read("SKILL.md"), read(`references/${bandForGrade(grade)}`), read("references/output-template.md"), read("references/tool-and-responsible-ai-guidance.md"),
      purpose === "annual" ? read("references/syllabus-synk-integration.md") : Promise.resolve(""),
    ]);
    return { text: files.filter(Boolean).join("\n\n--- SKILL REFERENCE ---\n\n"), version: createHash("sha256").update(files.join("\n")).digest("hex") };
  } catch (error) {
    console.error("[AI Education Premium] Skill package unavailable");
    throw new Error("TEACHING_PLANNER_SKILL_UNAVAILABLE");
  }
}
