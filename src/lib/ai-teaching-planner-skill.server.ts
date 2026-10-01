// Server-only loader for the proprietary Claude teaching-planner skill.
// Never import this module from browser code.
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const skillRelativePath = join("server-skills", "skills", "ai-teaching-planner");
const bandForGrade = (grade: string) => Number(grade) <= 2 ? "classes-1-2.md" : Number(grade) <= 5 ? "classes-3-5.md" : Number(grade) <= 8 ? "classes-6-8.md" : Number(grade) <= 10 ? "classes-9-10.md" : "classes-11-12.md";

async function skillRoot() {
  // The explicit setting is useful for PM2/container deployments. The module-relative
  // candidates make the normal production build independent of its working directory.
  const configured = process.env.SYLLABUS_SYNK_SKILL_ROOT;
  const candidates = [
    configured,
    join(moduleDirectory, skillRelativePath),
    join(moduleDirectory, "..", skillRelativePath),
    join(moduleDirectory, "..", "..", skillRelativePath),
    join(moduleDirectory, "..", "..", "..", skillRelativePath),
    join(process.cwd(), skillRelativePath),
  ].filter((candidate): candidate is string => Boolean(candidate)).map((candidate) => resolve(candidate));
  for (const candidate of [...new Set(candidates)]) {
    try {
      await access(join(candidate, "SKILL.md"));
      return candidate;
    } catch { /* try the next deployment-safe location */ }
  }
  console.error("[AI Education Premium] Teaching planner skill files are unavailable", { configured: Boolean(configured) });
  throw new Error("TEACHING_PLANNER_SKILL_UNAVAILABLE");
}

async function read(root: string, relative: string) { return readFile(join(root, relative), "utf8"); }

export async function loadTeachingPlannerSkill(grade: string, purpose: "lesson" | "annual") {
  try {
    const root = await skillRoot();
    const files = await Promise.all([
      read(root, "SKILL.md"), read(root, `references/${bandForGrade(grade)}`), read(root, "references/output-template.md"), read(root, "references/tool-and-responsible-ai-guidance.md"),
      purpose === "annual" ? read(root, "references/syllabus-synk-integration.md") : Promise.resolve(""),
    ]);
    return { text: files.filter(Boolean).join("\n\n--- SKILL REFERENCE ---\n\n"), version: createHash("sha256").update(files.join("\n")).digest("hex") };
  } catch (error) {
    console.error("[AI Education Premium] Skill package unavailable", { purpose, grade });
    throw new Error("TEACHING_PLANNER_SKILL_UNAVAILABLE");
  }
}
