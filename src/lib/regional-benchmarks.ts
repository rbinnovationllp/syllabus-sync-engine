// Zero-null fallback benchmarks for blank-state inputs.
// Used by the capacity engine when users skip fields.

export const BOARDS = [
  { id: "cbse", label: "CBSE (India)" },
  { id: "icse", label: "ICSE (India)" },
  { id: "ib", label: "International Baccalaureate" },
  { id: "cambridge", label: "Cambridge International" },
  { id: "common_core", label: "American Common Core" },
  { id: "british", label: "British National Curriculum" },
  { id: "acara", label: "Australian ACARA" },
  { id: "canadian", label: "Canadian Provincial" },
  { id: "custom", label: "Private / Custom" },
];

export const FEE_TIERS = [
  { id: "budget", label: "Budget", description: "< ₹2,500/mo or local equivalent" },
  { id: "mid", label: "Mid-Range", description: "₹2,500 – ₹6,000/mo or local equivalent" },
  { id: "premium", label: "Premium", description: "> ₹6,000/mo or local equivalent" },
];

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "SGD", "AUD", "CAD", "AED"];

export const GRADES = [
  "Pre-K", "K",
  "1", "2", "3", "4", "5",
  "6", "7", "8",
  "9", "10",
  "11", "12",
];

export const DEFAULT_SUBJECTS = [
  "Mathematics", "English", "Science", "Social Studies",
  "Second Language", "Computer Science", "Art", "Physical Education",
];

export const BENCHMARK_DEFAULTS = {
  working_days_per_week: 5,
  periods_per_day: 7,
  period_duration_minutes: 45,
  weekly_off_days: [0], // Sunday
  buffer_days: 10,
  periods_per_week_default: 5,
};
