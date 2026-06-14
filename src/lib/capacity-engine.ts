// Pure capacity calculation. No DB, no network — safe for client + server.
// Implements T_available = C_total − (H_gov + H_school + V + E + X + T_training + W_offs + B_buffer)
// Each calendar date is counted in exactly one bucket (priority order below) so the
// equation sums to C_total - T_available - B_buffer + teaching days, no double-count.

type DateStr = string; // YYYY-MM-DD

interface CapacityInput {
  start_date: DateStr;
  end_date: DateStr;
  weekly_off_days: number[]; // 0=Sun..6=Sat
  buffer_days: number;
  holidays: { date: DateStr; scope: "gov" | "school" }[];
  vacation_breaks: { start_date: DateStr; end_date: DateStr }[];
  events: { start_date: DateStr; end_date: DateStr; prep_days: number }[];
  exam_windows: { start_date: DateStr; end_date: DateStr }[];
  training_days: { date: DateStr }[];
}

export interface CapacityBreakdown {
  c_total: number;
  h_gov: number;
  h_school: number;
  v_vacation: number;
  e_events: number;
  x_exams: number;
  t_training: number;
  w_offs: number;
  b_buffer: number;
  t_available: number;
}

function parseDate(s: DateStr): Date {
  // Local-noon to dodge DST edges
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function fmt(d: Date): DateStr {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function enumerate(start: DateStr, end: DateStr): DateStr[] {
  const out: DateStr[] = [];
  const s = parseDate(start);
  const e = parseDate(end);
  for (let d = new Date(s); d <= e; d = addDays(d, 1)) out.push(fmt(d));
  return out;
}

function rangeDays(start: DateStr, end: DateStr): DateStr[] {
  if (parseDate(end) < parseDate(start)) return [];
  return enumerate(start, end);
}

export function calculateCapacity(input: CapacityInput): CapacityBreakdown {
  const allDays = enumerate(input.start_date, input.end_date);
  const c_total = allDays.length;
  const offSet = new Set(input.weekly_off_days);

  // Assign each date to a single bucket with priority:
  // 1. gov holiday > 2. school holiday > 3. exam > 4. vacation > 5. event(+prep) > 6. training > 7. weekly off
  const bucket = new Map<DateStr, string>();

  for (const h of input.holidays) {
    if (!bucket.has(h.date)) bucket.set(h.date, h.scope === "gov" ? "h_gov" : "h_school");
  }
  for (const x of input.exam_windows) {
    for (const d of rangeDays(x.start_date, x.end_date)) if (!bucket.has(d)) bucket.set(d, "x_exams");
  }
  for (const v of input.vacation_breaks) {
    for (const d of rangeDays(v.start_date, v.end_date)) if (!bucket.has(d)) bucket.set(d, "v_vacation");
  }
  for (const e of input.events) {
    const prepStart = e.prep_days > 0 ? fmt(addDays(parseDate(e.start_date), -e.prep_days)) : e.start_date;
    for (const d of rangeDays(prepStart, e.end_date)) if (!bucket.has(d)) bucket.set(d, "e_events");
  }
  for (const t of input.training_days) {
    if (!bucket.has(t.date)) bucket.set(t.date, "t_training");
  }
  for (const day of allDays) {
    if (bucket.has(day)) continue;
    const dow = parseDate(day).getDay();
    if (offSet.has(dow)) bucket.set(day, "w_offs");
  }

  const counts = { h_gov: 0, h_school: 0, v_vacation: 0, e_events: 0, x_exams: 0, t_training: 0, w_offs: 0 };
  for (const day of allDays) {
    const b = bucket.get(day);
    if (b && b in counts) (counts as Record<string, number>)[b]++;
  }

  const b_buffer = Math.max(0, Math.min(input.buffer_days, c_total));
  const blackouts = counts.h_gov + counts.h_school + counts.v_vacation + counts.e_events +
                    counts.x_exams + counts.t_training + counts.w_offs + b_buffer;
  const t_available = Math.max(0, c_total - blackouts);

  return { c_total, ...counts, b_buffer, t_available };
}
