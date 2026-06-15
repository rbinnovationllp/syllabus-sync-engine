// Region- and stream-aware subject catalog.
// Used in onboarding step 3 to populate the subject dropdown.

export type CountryKey = "india" | "usa" | "uk" | "australia" | "canada" | "singapore" | "uae" | "other";

export function detectCountryKey(country: string, board: string): CountryKey {
  const c = (country || "").toLowerCase();
  if (c.includes("india") || ["cbse", "icse"].includes(board)) return "india";
  if (c.includes("united states") || c === "us" || c === "usa" || c.includes("america")) return "usa";
  if (c.includes("united kingdom") || c === "uk" || c.includes("england") || c.includes("britain")) return "uk";
  if (c.includes("australia")) return "australia";
  if (c.includes("canada")) return "canada";
  if (c.includes("singapore")) return "singapore";
  if (c.includes("emirates") || c === "uae") return "uae";
  return "other";
}

// Academic session end date based on country convention.
// India: April → March 31. Returns ISO date string.
export function sessionEndForStart(startISO: string, country: string, board: string): string {
  if (!startISO) return "";
  const [y, m, d] = startISO.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const key = detectCountryKey(country, board);

  const endOn = (year: number, month1: number, day: number) =>
    `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  switch (key) {
    case "india": {
      // session: April–March. If starting Apr–Dec → March 31 next year. If Jan–Mar → March 31 same year.
      const year = start.getMonth() >= 3 ? start.getFullYear() + 1 : start.getFullYear();
      return endOn(year, 3, 31);
    }
    case "usa":
    case "canada": {
      // Aug/Sep → May/Jun. End May 31 of next calendar year (or same year if start Jan–May).
      const year = start.getMonth() >= 5 ? start.getFullYear() + 1 : start.getFullYear();
      return endOn(year, 5, 31);
    }
    case "uk": {
      // Sep → Jul. End Jul 20.
      const year = start.getMonth() >= 7 ? start.getFullYear() + 1 : start.getFullYear();
      return endOn(year, 7, 20);
    }
    case "australia": {
      // Jan/Feb → Dec. End Dec 15.
      return endOn(start.getFullYear(), 12, 15);
    }
    case "singapore": {
      // Jan → Nov. End Nov 20.
      return endOn(start.getFullYear(), 11, 20);
    }
    case "uae": {
      // Sep → Jun.
      const year = start.getMonth() >= 7 ? start.getFullYear() + 1 : start.getFullYear();
      return endOn(year, 6, 30);
    }
    default: {
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      return end.toISOString().slice(0, 10);
    }
  }
}

export function sessionLabel(startISO: string, endISO: string): string {
  if (!startISO || !endISO) return "Academic Year";
  const sy = Number(startISO.slice(0, 4));
  const ey = Number(endISO.slice(0, 4));
  return sy === ey ? `Academic Year ${sy}` : `Academic Year ${sy}-${String(ey).slice(2)}`;
}

// Streams apply mainly to senior secondary (Grades 11–12) in India-like systems.
export interface StreamOption { id: string; label: string }

export function getStreams(country: string, board: string, grade: string): StreamOption[] {
  const key = detectCountryKey(country, board);
  const isSenior = grade === "11" || grade === "12";
  if (!isSenior) return [];

  if (key === "india") {
    return [
      { id: "science_pcm", label: "Science (PCM)" },
      { id: "science_pcb", label: "Science (PCB)" },
      { id: "science_pcmb", label: "Science (PCMB)" },
      { id: "commerce_math", label: "Commerce (with Maths)" },
      { id: "commerce", label: "Commerce (without Maths)" },
      { id: "humanities", label: "Humanities / Arts" },
      { id: "vocational", label: "Vocational" },
    ];
  }
  if (key === "usa" || key === "canada") {
    return [
      { id: "stem", label: "STEM Track" },
      { id: "humanities", label: "Humanities Track" },
      { id: "business", label: "Business / Economics Track" },
      { id: "arts", label: "Visual & Performing Arts" },
      { id: "general", label: "General / College Prep" },
    ];
  }
  if (key === "uk") {
    return [
      { id: "a_sciences", label: "A-Level Sciences" },
      { id: "a_humanities", label: "A-Level Humanities" },
      { id: "a_arts", label: "A-Level Arts" },
      { id: "btec", label: "BTEC / Vocational" },
    ];
  }
  if (board === "ib") {
    return [
      { id: "ib_dp", label: "IB Diploma Programme" },
      { id: "ib_cp", label: "IB Career-related Programme" },
    ];
  }
  return [{ id: "general", label: "General" }];
}

// Master subject lists per region + grade band + (optional) stream.
function indiaSubjects(grade: string, stream?: string): string[] {
  const g = grade;
  // Pre-K / K
  if (g === "Pre-K" || g === "K") {
    return ["English", "Numeracy", "Environmental Awareness", "Art & Craft", "Rhymes & Stories", "Physical Activity"];
  }
  // Primary 1–5
  if (["1", "2", "3", "4", "5"].includes(g)) {
    return ["Mathematics", "English", "Hindi", "EVS (Environmental Studies)", "General Knowledge", "Computer Science", "Art & Craft", "Physical Education", "Moral Science", "Sanskrit", "Regional Language"];
  }
  // Middle 6–8
  if (["6", "7", "8"].includes(g)) {
    return ["Mathematics", "English", "Hindi", "Science", "Social Science", "Sanskrit", "Computer Science", "Art Education", "Physical Education", "Regional Language", "French", "German"];
  }
  // 9–10
  if (g === "9" || g === "10") {
    return ["Mathematics", "Mathematics (Standard)", "Mathematics (Basic)", "English", "Hindi", "Sanskrit", "Science", "Social Science", "Information Technology", "Artificial Intelligence", "Physical Education", "Art Education", "Regional Language", "French", "German"];
  }
  // 11–12 by stream
  if (g === "11" || g === "12") {
    const core = ["English Core", "Physical Education", "General Studies"];
    switch (stream) {
      case "science_pcm":
        return ["Physics", "Chemistry", "Mathematics", "Computer Science", "Informatics Practices", "Engineering Graphics", ...core];
      case "science_pcb":
        return ["Physics", "Chemistry", "Biology", "Biotechnology", "Psychology", ...core];
      case "science_pcmb":
        return ["Physics", "Chemistry", "Mathematics", "Biology", "Computer Science", ...core];
      case "commerce_math":
        return ["Accountancy", "Business Studies", "Economics", "Mathematics", "Informatics Practices", "Entrepreneurship", ...core];
      case "commerce":
        return ["Accountancy", "Business Studies", "Economics", "Informatics Practices", "Entrepreneurship", "Legal Studies", ...core];
      case "humanities":
        return ["History", "Political Science", "Geography", "Economics", "Sociology", "Psychology", "Philosophy", "Fine Arts", "Hindi Elective", "English Elective", ...core];
      case "vocational":
        return ["Retail", "Tourism", "Banking", "Healthcare", "IT/ITeS", "Beauty & Wellness", ...core];
      default:
        return [...core, "Physics", "Chemistry", "Mathematics", "Biology", "Accountancy", "Business Studies", "Economics", "History", "Political Science", "Geography"];
    }
  }
  return ["Mathematics", "English"];
}

function usSubjects(grade: string, stream?: string): string[] {
  if (["Pre-K", "K", "1", "2", "3", "4", "5"].includes(grade)) {
    return ["English Language Arts", "Mathematics", "Science", "Social Studies", "Physical Education", "Art", "Music", "Health", "Library / Media"];
  }
  if (["6", "7", "8"].includes(grade)) {
    return ["English Language Arts", "Mathematics", "Science", "Social Studies", "World Language", "Physical Education", "Art", "Music", "Technology / STEM"];
  }
  if (["9", "10"].includes(grade)) {
    return ["English", "Algebra I", "Algebra II", "Geometry", "Biology", "Chemistry", "World History", "US History", "Spanish", "French", "Physical Education", "Art", "Computer Science"];
  }
  if (["11", "12"].includes(grade)) {
    const core = ["English", "US Government", "Health"];
    switch (stream) {
      case "stem":
        return ["AP Calculus", "Pre-Calculus", "Statistics", "AP Physics", "AP Chemistry", "AP Biology", "Computer Science", "Engineering", ...core];
      case "humanities":
        return ["AP English Literature", "AP US History", "Psychology", "Sociology", "Philosophy", "World Languages", ...core];
      case "business":
        return ["Economics", "AP Economics", "Accounting", "Business Management", "Marketing", "Statistics", ...core];
      case "arts":
        return ["Studio Art", "AP Art History", "Theater", "Music Performance", "Film Studies", "Graphic Design", ...core];
      default:
        return ["English", "Mathematics", "Science Elective", "Social Studies Elective", "World Language", "Physical Education", "Elective"];
    }
  }
  return ["English", "Mathematics"];
}

function ukSubjects(grade: string, stream?: string): string[] {
  if (["Pre-K", "K", "1", "2", "3", "4", "5", "6"].includes(grade)) {
    return ["English", "Mathematics", "Science", "History", "Geography", "Religious Education", "Art & Design", "Music", "PE", "Computing", "Modern Foreign Language"];
  }
  if (["7", "8", "9"].includes(grade)) {
    return ["English Language", "English Literature", "Mathematics", "Biology", "Chemistry", "Physics", "History", "Geography", "RE", "Computing", "Design & Technology", "MFL", "PE", "Art", "Music", "Drama"];
  }
  if (["10", "11"].includes(grade)) {
    return ["GCSE English Language", "GCSE English Literature", "GCSE Mathematics", "GCSE Biology", "GCSE Chemistry", "GCSE Physics", "GCSE Combined Science", "GCSE History", "GCSE Geography", "GCSE Computer Science", "GCSE Business", "GCSE Art", "GCSE PE", "GCSE MFL"];
  }
  if (["12"].includes(grade)) {
    switch (stream) {
      case "a_sciences":
        return ["A-Level Mathematics", "A-Level Further Maths", "A-Level Physics", "A-Level Chemistry", "A-Level Biology", "A-Level Computer Science", "EPQ"];
      case "a_humanities":
        return ["A-Level English Literature", "A-Level History", "A-Level Geography", "A-Level Politics", "A-Level Sociology", "A-Level Psychology", "EPQ"];
      case "a_arts":
        return ["A-Level Art", "A-Level Drama", "A-Level Music", "A-Level Media Studies", "A-Level Photography"];
      case "btec":
        return ["BTEC Business", "BTEC IT", "BTEC Health & Social Care", "BTEC Engineering", "BTEC Sport"];
      default:
        return ["A-Level English", "A-Level Mathematics", "A-Level Science", "A-Level Humanities Option"];
    }
  }
  return ["English", "Mathematics"];
}

function genericSubjects(grade: string): string[] {
  if (["Pre-K", "K", "1", "2", "3", "4", "5"].includes(grade)) {
    return ["Mathematics", "English", "Science", "Social Studies", "Second Language", "Computer Science", "Art", "Physical Education", "Music"];
  }
  if (["6", "7", "8"].includes(grade)) {
    return ["Mathematics", "English", "Science", "Social Studies", "Second Language", "Computer Science", "Art", "Physical Education", "Technology"];
  }
  return ["Mathematics", "English", "Science", "Social Studies", "Second Language", "Computer Science", "Physical Education", "Elective"];
}

// Common co-curricular activities exposed in the subject dropdown so schools can
// schedule them alongside core academics. Placed after academic subjects, with
// "Other" always last so users can specify any custom subject.
export const CO_CURRICULAR_SUBJECTS = [
  "Sports / Games",
  "Music",
  "Dance",
  "Art & Craft",
  "Drama / Theatre",
  "Yoga",
  "Karate / Martial Arts",
  "Library",
  "Club Activity",
] as const;

export const SUBJECT_OTHER = "Other" as const;

export function getSubjects(country: string, board: string, grade: string, stream?: string): string[] {
  const key = detectCountryKey(country, board);
  let academic: string[];
  if (key === "india") academic = indiaSubjects(grade, stream);
  else if (key === "usa" || key === "canada") academic = usSubjects(grade, stream);
  else if (key === "uk") academic = ukSubjects(grade, stream);
  else academic = genericSubjects(grade);
  // De-dupe in case any catalog already includes a co-curricular name.
  const seen = new Set(academic);
  const co = CO_CURRICULAR_SUBJECTS.filter((s) => !seen.has(s));
  return [...academic, ...co, SUBJECT_OTHER];
}

/** Heuristic: rows that look like sports/music/art default to co-curricular. */
export function inferSubjectKind(subject: string): "core" | "co_curricular" {
  const s = subject.toLowerCase();
  if (
    s.includes("sport") || s.includes("game") || s.includes("music") || s.includes("dance") ||
    s.includes("art") || s.includes("craft") || s.includes("drama") || s.includes("theatre") ||
    s.includes("yoga") || s.includes("karate") || s.includes("martial") ||
    s.includes("library") || s.includes("club") || s.includes("physical education") || s === "pe"
  ) return "co_curricular";
  return "core";
}
