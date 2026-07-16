import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const chapterInputSchema = z.object({
  board: z.string().trim().max(120).optional().nullable(),
  academic_year_id: z.string().uuid().optional().nullable(),
  grade: z.string().trim().min(1).max(40),
  subject: z.string().trim().min(1).max(120),
  book_name: z.string().trim().max(220).optional().nullable(),
  publisher: z.string().trim().max(220).optional().nullable(),
  chapter_text: z.string().trim().min(2).max(12000),
});

const runIdSchema = z.object({
  mapping_run_id: z.string().uuid(),
});

const acceptSchema = z.object({
  mapping_run_id: z.string().uuid(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const uniqueInfoSchema = z.object({
  request_id: z.string().uuid(),
  chapter_summary: z.string().trim().max(2000).optional().nullable(),
  learning_objectives: z.string().trim().max(2000).optional().nullable(),
  topics_covered: z.string().trim().max(2000).optional().nullable(),
  key_concepts: z.string().trim().max(2000).optional().nullable(),
  rights_confirmation: z.boolean(),
});

type Membership = { org_id: string; role: string };
type ChapterInput = {
  chapter_name: string;
  topic_names: string[];
  learning_objectives: string[];
};
type Reference = {
  id: string | null;
  source: string;
  board?: string | null;
  grade: string;
  subject: string;
  chapter_name: string;
  topic_names: string[];
  learning_objectives: string[];
  key_concepts: string[];
  suggested_periods?: number | null;
};

const BUILT_IN_REFERENCES: Reference[] = [
  {
    id: null,
    source: "ncert",
    board: "CBSE",
    grade: "6",
    subject: "Science",
    chapter_name: "Food: Where Does It Come From?",
    topic_names: ["food sources", "plant parts", "animal products"],
    learning_objectives: ["identify food sources", "classify edible plant parts"],
    key_concepts: ["food", "plants", "animals"],
    suggested_periods: 5,
  },
  {
    id: null,
    source: "ncert",
    board: "CBSE",
    grade: "7",
    subject: "Science",
    chapter_name: "Nutrition in Plants",
    topic_names: ["photosynthesis", "autotrophs", "chlorophyll"],
    learning_objectives: ["explain how plants prepare food", "identify conditions for photosynthesis"],
    key_concepts: ["nutrition", "photosynthesis", "plants"],
    suggested_periods: 6,
  },
  {
    id: null,
    source: "ncert",
    board: "CBSE",
    grade: "7",
    subject: "Science",
    chapter_name: "Heat",
    topic_names: ["temperature", "conduction", "convection", "radiation"],
    learning_objectives: ["differentiate heat and temperature", "explain modes of heat transfer"],
    key_concepts: ["heat", "temperature", "transfer"],
    suggested_periods: 7,
  },
  {
    id: null,
    source: "ncert",
    board: "CBSE",
    grade: "7",
    subject: "Science",
    chapter_name: "Acids, Bases and Salts",
    topic_names: ["acid", "base", "indicator", "neutralisation"],
    learning_objectives: ["classify acids and bases", "explain neutralisation"],
    key_concepts: ["acid", "base", "salt"],
    suggested_periods: 6,
  },
  {
    id: null,
    source: "cbse_learning_outcomes",
    board: "CBSE",
    grade: "8",
    subject: "Mathematics",
    chapter_name: "Linear Equations in One Variable",
    topic_names: ["linear equation", "variable", "solution"],
    learning_objectives: ["solve linear equations", "apply equations in word problems"],
    key_concepts: ["equation", "variable", "solution"],
    suggested_periods: 8,
  },
  {
    id: null,
    source: "ncert",
    board: "CBSE",
    grade: "8",
    subject: "Mathematics",
    chapter_name: "Squares and Square Roots",
    topic_names: ["square numbers", "square roots", "estimation"],
    learning_objectives: ["find squares and square roots", "estimate roots"],
    key_concepts: ["squares", "roots"],
    suggested_periods: 8,
  },
  {
    id: null,
    source: "public_framework",
    board: null,
    grade: "8",
    subject: "Social Science",
    chapter_name: "Resources",
    topic_names: ["natural resources", "human resources", "conservation"],
    learning_objectives: ["classify resources", "explain conservation"],
    key_concepts: ["resources", "conservation"],
    suggested_periods: 5,
  },
  {
    id: null,
    source: "public_framework",
    board: null,
    grade: "6",
    subject: "English",
    chapter_name: "Reading Comprehension and Writing Skills",
    topic_names: ["comprehension", "vocabulary", "paragraph writing"],
    learning_objectives: ["read for meaning", "write coherent paragraphs"],
    key_concepts: ["reading", "writing", "vocabulary"],
    suggested_periods: 6,
  },
  {
    id: null,
    source: "public_framework",
    board: null,
    grade: "6",
    subject: "Computer Science",
    chapter_name: "Introduction to Computers",
    topic_names: ["hardware", "software", "input", "output"],
    learning_objectives: ["identify computer components", "differentiate hardware and software"],
    key_concepts: ["computer", "hardware", "software"],
    suggested_periods: 5,
  },
  {
    id: null,
    source: "public_framework",
    board: null,
    grade: "1",
    subject: "Environmental Studies",
    chapter_name: "My Family and My School",
    topic_names: ["family", "school", "community helpers"],
    learning_objectives: ["identify family roles", "describe school surroundings"],
    key_concepts: ["family", "school", "community"],
    suggested_periods: 4,
  },
];

function isAdminRole(role: string) {
  return ["owner", "admin", "super_admin", "coordinator"].includes(role);
}

async function loadMembership(supabase: any, userId: string): Promise<Membership> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No school workspace membership found.");
  return data;
}

function splitList(value: string | undefined | null) {
  return String(value ?? "")
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function parseChapters(chapterText: string): ChapterInput[] {
  return chapterText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cleaned = line.replace(/^\s*(chapter|ch\.?)?\s*\d+[\).:-]?\s*/i, "").trim();
      const [namePart, topicsPart = "", objectivesPart = ""] = cleaned.split(/\s+(?:topics?|objectives?|outcomes?)\s*:\s*/i);
      return {
        chapter_name: (namePart || cleaned).trim().slice(0, 220),
        topic_names: splitList(topicsPart),
        learning_objectives: splitList(objectivesPart),
      };
    })
    .filter((row) => row.chapter_name.length > 0)
    .slice(0, 120);
}

function tokens(value: string) {
  const stop = new Set(["and", "the", "for", "with", "from", "into", "of", "in", "a", "an", "to", "how", "what", "is", "are"]);
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((v) => v.trim())
      .filter((v) => v.length > 2 && !stop.has(v)),
  );
}

function similarity(a: string, b: string) {
  const aa = tokens(a);
  const bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  let common = 0;
  for (const token of aa) if (bb.has(token)) common += 1;
  return common / Math.max(aa.size, bb.size);
}

function referenceText(ref: Reference) {
  return [
    ref.chapter_name,
    ...ref.topic_names,
    ...ref.learning_objectives,
    ...ref.key_concepts,
  ].join(" ");
}

function inputText(input: ChapterInput) {
  return [input.chapter_name, ...input.topic_names, ...input.learning_objectives].join(" ");
}

function sourceLabel(source: string) {
  return source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function estimatePeriods(chapter: ChapterInput, match?: Reference | null, confidence = 0) {
  if (match?.suggested_periods) return Number(match.suggested_periods);
  const topicCount = chapter.topic_names.length || Math.ceil(tokens(chapter.chapter_name).size / 3);
  const objectiveCount = chapter.learning_objectives.length;
  const base = 3 + Math.min(8, topicCount + Math.ceil(objectiveCount / 2));
  return confidence >= 0.7 ? base : base + 1;
}

async function loadReferences(admin: any, data: z.infer<typeof chapterInputSchema>): Promise<Reference[]> {
  const { data: rows, error } = await admin
    .from("curriculum_standard_references")
    .select("*")
    .eq("active", true)
    .ilike("grade", data.grade)
    .ilike("subject", data.subject)
    .limit(200);
  if (error && !String(error.message).includes("curriculum_standard_references")) throw new Error(error.message);
  const dbRefs: Reference[] = (rows ?? []).map((row: any) => ({
    id: row.id,
    source: row.source,
    board: row.board,
    grade: row.grade,
    subject: row.subject,
    chapter_name: row.chapter_name,
    topic_names: row.topic_names ?? [],
    learning_objectives: row.learning_objectives ?? [],
    key_concepts: row.key_concepts ?? [],
    suggested_periods: row.suggested_periods,
  }));
  const builtIns = BUILT_IN_REFERENCES.filter((ref) =>
    ref.grade.toLowerCase() === data.grade.toLowerCase() &&
    ref.subject.toLowerCase() === data.subject.toLowerCase()
  );
  return [...dbRefs, ...builtIns];
}

function mapChapter(chapter: ChapterInput, refs: Reference[]) {
  let best: Reference | null = null;
  let bestScore = 0;
  for (const ref of refs) {
    const titleScore = similarity(chapter.chapter_name, ref.chapter_name);
    const fullScore = similarity(inputText(chapter), referenceText(ref));
    const score = Math.max(titleScore * 0.75 + fullScore * 0.25, fullScore);
    if (score > bestScore) {
      best = ref;
      bestScore = score;
    }
  }
  const confidence = Math.round(Math.min(0.98, bestScore) * 100) / 100;
  let mapping_status: "mapped" | "partial_match" | "needs_information";
  if (confidence >= 0.72) mapping_status = "mapped";
  else if (confidence >= 0.42) mapping_status = "partial_match";
  else mapping_status = "needs_information";
  const information_needed = mapping_status === "needs_information"
    ? ["chapter_summary", "learning_objectives", "topics_covered", "key_concepts"]
    : [];
  return {
    best,
    confidence,
    mapping_status,
    estimated_periods: estimatePeriods(chapter, best, confidence),
    information_needed,
  };
}

export const generateCurriculumMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => chapterInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await loadMembership(context.supabase, context.userId);
    if (!isAdminRole(me.role)) throw new Error("Only school admins/coordinators can create curriculum mappings.");

    const chapters = parseChapters(data.chapter_text);
    if (!chapters.length) throw new Error("Enter at least one chapter name.");
    const refs = await loadReferences(supabaseAdmin, data);
    const mapped = chapters.map((chapter) => ({ chapter, ...mapChapter(chapter, refs) }));
    const mappedCount = mapped.filter((row) => row.mapping_status === "mapped").length;
    const uniqueCount = mapped.filter((row) => row.mapping_status === "needs_information").length;
    const averageConfidence = mapped.length
      ? Math.round((mapped.reduce((sum, row) => sum + row.confidence, 0) / mapped.length) * 100) / 100
      : 0;
    const status = uniqueCount > 0 || mapped.some((row) => row.mapping_status === "partial_match") ? "needs_review" : "mapped";

    const { data: run, error: runError } = await supabaseAdmin
      .from("curriculum_mapping_runs")
      .insert({
        org_id: me.org_id,
        academic_year_id: data.academic_year_id || null,
        grade: data.grade,
        subject: data.subject,
        board: data.board || null,
        book_name: data.book_name || null,
        publisher: data.publisher || null,
        input_chapters: chapters,
        status,
        total_chapters: chapters.length,
        mapped_chapters: mappedCount,
        unique_chapters: uniqueCount,
        average_confidence: averageConfidence,
        notes: "Generated with copyright-safe curriculum mapping. Full textbook upload was not required.",
        created_by: context.userId,
      })
      .select()
      .single();
    if (runError) {
      if (String(runError.message).includes("curriculum_mapping_runs")) {
        throw new Error("Apply the Curriculum Mapping Supabase migration before using this module.");
      }
      throw new Error(runError.message);
    }

    const rows = mapped.map((row) => ({
      mapping_run_id: run.id,
      org_id: me.org_id,
      chapter_name: row.chapter.chapter_name,
      topic_names: row.chapter.topic_names,
      learning_objectives: row.chapter.learning_objectives,
      matched_reference_id: row.best?.id ?? null,
      matched_source: row.best ? sourceLabel(row.best.source) : null,
      matched_chapter_name: row.best?.chapter_name ?? null,
      matched_topic_names: row.best?.topic_names ?? [],
      mapping_status: row.mapping_status,
      confidence: row.confidence,
      estimated_periods: row.estimated_periods,
      revision_periods: Math.max(1, Math.round(row.estimated_periods * 0.15)),
      examination_weight: row.confidence >= 0.72 ? "standard" : row.confidence >= 0.42 ? "review" : "school_specific",
      information_needed: row.information_needed,
      copyright_handling: "metadata_only",
    }));

    const { data: mappingRows, error: mappingError } = await supabaseAdmin
      .from("curriculum_chapter_mappings")
      .insert(rows)
      .select();
    if (mappingError) throw new Error(mappingError.message);

    const uniqueRequests = (mappingRows ?? [])
      .filter((row: any) => row.mapping_status === "needs_information")
      .map((row: any) => ({
        org_id: me.org_id,
        mapping_run_id: run.id,
        chapter_mapping_id: row.id,
        chapter_name: row.chapter_name,
        created_by: context.userId,
      }));
    if (uniqueRequests.length) {
      const { error } = await supabaseAdmin.from("curriculum_unique_chapter_requests").insert(uniqueRequests);
      if (error) throw new Error(error.message);
    }

    return { run, mappings: mappingRows ?? [] };
  });

export const getCurriculumMappingWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await loadMembership(context.supabase, context.userId);
    const { data: years } = await supabaseAdmin
      .from("academic_years")
      .select("id, name, start_date, end_date, schools(board)")
      .eq("org_id", me.org_id)
      .order("start_date", { ascending: false })
      .limit(10);
    const { data: runs, error } = await supabaseAdmin
      .from("curriculum_mapping_runs")
      .select("*, curriculum_chapter_mappings(*), curriculum_unique_chapter_requests(*)")
      .eq("org_id", me.org_id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      if (String(error.message).includes("curriculum_mapping_runs")) {
        return { years: years ?? [], runs: [], needsMigration: true };
      }
      throw new Error(error.message);
    }
    return { years: years ?? [], runs: runs ?? [], needsMigration: false };
  });

export const approveCurriculumMappingRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => acceptSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await loadMembership(context.supabase, context.userId);
    if (!isAdminRole(me.role)) throw new Error("Only school admins/coordinators can approve curriculum mappings.");
    const { data: run, error } = await supabaseAdmin
      .from("curriculum_mapping_runs")
      .update({
        status: "approved",
        notes: data.notes || "Approved for syllabus planning.",
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", data.mapping_run_id)
      .eq("org_id", me.org_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return run;
  });

export const submitUniqueChapterInformation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uniqueInfoSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!data.rights_confirmation) {
      throw new Error("Confirm that the school has permission to use the provided information for internal academic planning.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await loadMembership(context.supabase, context.userId);
    const response = {
      chapter_summary: data.chapter_summary || null,
      learning_objectives: data.learning_objectives || null,
      topics_covered: data.topics_covered || null,
      key_concepts: data.key_concepts || null,
    };
    const { data: request, error } = await supabaseAdmin
      .from("curriculum_unique_chapter_requests")
      .update({
        school_response: response,
        status: "submitted",
        rights_confirmation: true,
      })
      .eq("id", data.request_id)
      .eq("org_id", me.org_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return request;
  });
