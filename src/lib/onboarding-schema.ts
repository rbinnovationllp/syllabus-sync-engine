import { z } from "zod";

export const step1Schema = z.object({
  school_name: z.string().trim().min(1, "Required").max(200),
  region: z.string().trim().max(100).optional().default(""),
  country: z.string().trim().min(1, "Required").max(100),
  state_province: z.string().trim().max(100).optional().default(""),
  city: z.string().trim().max(100).optional().default(""),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
    board: z.string().min(1, "Required"),
  acquisition_source: z.string().trim().min(1, "Required"),
  acquisition_detail: z.string().trim().max(120).optional().default(""),
  partner_name: z.string().trim().max(200).optional().default(""),
  partner_referral_code: z.string().trim().max(120).optional().default(""),
  other_source: z.string().trim().max(200).optional().default(""),
});

export const textbookSchema = z.object({
  grade: z.string().min(1),
  subject: z.string().min(1),
  title: z.string().trim().max(200).optional().default(""),
  author: z.string().trim().max(200).optional().default(""),
  publisher: z.string().trim().max(200).optional().default(""),
  edition_year: z.coerce.number().int().min(1900).max(2100).optional(),
});

export const step2Schema = z.object({
  monthly_fee_per_student: z.coerce.number().min(0).optional(),
  currency: z.string().min(1).default("USD"),
  fee_tier: z.enum(["budget", "mid", "premium"]),
  textbooks: z.array(textbookSchema).default([]),
});

export const gradeSubjectSchema = z.object({
  grade: z.string().min(1),
  stream: z.string().trim().max(50).optional().default(""),
  subject: z.string().trim().min(1).max(100),
  kind: z.enum(["core", "co_curricular"]).default("core"),
  // 0 = Sunday â€¦ 6 = Saturday. Default Monâ€“Fri.
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one weekday").default([1, 2, 3, 4, 5]),
  periods_per_week: z.coerce.number().int().min(1).max(40),
  teacher_name: z.string().trim().max(200).optional().default(""),
  completed_chapters: z.string().trim().max(2000).optional().default(""),
});

// Optional extra-class window for a single senior grade (9/10/11/12).
const extraClassWindowSchema = z.object({
  enabled: z.boolean().default(false),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").optional().or(z.literal("")).default(""),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").optional().or(z.literal("")).default(""),
});

export const step3Schema = z.object({
  label: z.string().trim().min(1).max(100),
  start_date: z.string().min(1), // ISO date
  end_date: z.string().min(1),
  working_days_per_week: z.coerce.number().int().min(1).max(7),
  periods_per_day: z.coerce.number().int().min(1).max(15),
  period_duration_minutes: z.coerce.number().int().min(15).max(120),
  weekly_off_days: z.array(z.coerce.number().int().min(0).max(6)).default([0]),
  buffer_days: z.coerce.number().int().min(0).max(60).default(10),
  // School day timings (HH:MM, 24h). All optional but recommended for accurate AI plans.
  school_start_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").optional().or(z.literal("")).default(""),
  school_end_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").optional().or(z.literal("")).default(""),
  lunch_start_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").optional().or(z.literal("")).default(""),
  lunch_end_time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").optional().or(z.literal("")).default(""),
  // Optional extra-class window per senior grade (9/10/11/12).
  senior_extra_classes: z.record(z.string(), extraClassWindowSchema).default({}),
  // Schools should have 6+ rows (enforced in UI); tutors/coaching (retail tier) can submit 1.
  grade_subjects: z.array(gradeSubjectSchema).min(1, "Add at least one subject"),
});

const dateRangeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
});

export const step4Schema = z.object({
  holidays: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    date: z.string().min(1),
    scope: z.enum(["gov", "school"]).default("school"),
  })).default([]),
  vacation_breaks: z.array(dateRangeSchema).default([]),
  events: z.array(dateRangeSchema.extend({
    prep_days: z.coerce.number().int().min(0).max(30).default(0),
  })).default([]),
  exam_windows: z.array(dateRangeSchema).default([]),
  training_days: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    date: z.string().min(1),
  })).default([]),
});

export const fullOnboardingSchema = z.object({
  step1: step1Schema,
  step2: step2Schema,
  step3: step3Schema,
  step4: step4Schema,
});

export type FullOnboarding = z.infer<typeof fullOnboardingSchema>;
export type Step1 = z.infer<typeof step1Schema>;
export type Step2 = z.infer<typeof step2Schema>;
export type Step3 = z.infer<typeof step3Schema>;
export type Step4 = z.infer<typeof step4Schema>;

