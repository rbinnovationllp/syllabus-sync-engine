// Default national / state holiday seeds for the onboarding wizard.
// These are curated, fixed-date public holidays — religious holidays that
// follow lunar calendars (Eid, Diwali, Easter, etc.) are intentionally omitted
// because their dates vary year to year; the school admin can add them
// manually after prefill.
//
// All entries are editable: the admin can delete any that don't apply to
// their state, and add anything missing.

export type SeededHoliday = {
  name: string;
  date: string; // YYYY-MM-DD
  scope: "gov" | "school";
};

type FixedHoliday = {
  name: string;
  month: number; // 1-12
  day: number; // 1-31
};

type CountryDef = {
  national: FixedHoliday[];
  states?: Record<string, FixedHoliday[]>;
};

// Normalize loosely typed country/state strings to a canonical key.
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

const COUNTRY_ALIASES: Record<string, string> = {
  "india": "india", "in": "india", "bharat": "india",
  "united states": "usa", "usa": "usa", "us": "usa", "u s a": "usa", "america": "usa",
  "united kingdom": "uk", "uk": "uk", "great britain": "uk", "britain": "uk", "england": "uk",
  "australia": "australia", "au": "australia",
  "canada": "canada", "ca": "canada",
  "singapore": "singapore", "sg": "singapore",
  "uae": "uae", "united arab emirates": "uae",
  "new zealand": "nz", "nz": "nz",
  "south africa": "za", "za": "za",
};

const COUNTRIES: Record<string, CountryDef> = {
  india: {
    national: [
      { name: "Republic Day", month: 1, day: 26 },
      { name: "Independence Day", month: 8, day: 15 },
      { name: "Gandhi Jayanti", month: 10, day: 2 },
      { name: "Christmas Day", month: 12, day: 25 },
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "Labour Day", month: 5, day: 1 },
    ],
    states: {
      "maharashtra": [
        { name: "Maharashtra Day", month: 5, day: 1 },
        { name: "Chhatrapati Shivaji Jayanti", month: 2, day: 19 },
      ],
      "tamil nadu": [
        { name: "Tamil New Year", month: 4, day: 14 },
        { name: "Pongal", month: 1, day: 14 },
      ],
      "karnataka": [{ name: "Kannada Rajyotsava", month: 11, day: 1 }],
      "kerala": [{ name: "Kerala Piravi", month: 11, day: 1 }],
      "west bengal": [{ name: "Poila Boishakh", month: 4, day: 15 }],
      "delhi": [],
      "gujarat": [
        { name: "Gujarat Day", month: 5, day: 1 },
        { name: "Sardar Patel Jayanti", month: 10, day: 31 },
      ],
      "punjab": [{ name: "Punjabi Day", month: 11, day: 1 }],
      "telangana": [{ name: "Telangana Formation Day", month: 6, day: 2 }],
      "andhra pradesh": [{ name: "AP Formation Day", month: 11, day: 1 }],
    },
  },
  usa: {
    national: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "Juneteenth", month: 6, day: 19 },
      { name: "Independence Day", month: 7, day: 4 },
      { name: "Veterans Day", month: 11, day: 11 },
      { name: "Christmas Day", month: 12, day: 25 },
    ],
  },
  uk: {
    national: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "Christmas Day", month: 12, day: 25 },
      { name: "Boxing Day", month: 12, day: 26 },
    ],
  },
  australia: {
    national: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "Australia Day", month: 1, day: 26 },
      { name: "Anzac Day", month: 4, day: 25 },
      { name: "Christmas Day", month: 12, day: 25 },
      { name: "Boxing Day", month: 12, day: 26 },
    ],
  },
  canada: {
    national: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "Canada Day", month: 7, day: 1 },
      { name: "Remembrance Day", month: 11, day: 11 },
      { name: "Christmas Day", month: 12, day: 25 },
      { name: "Boxing Day", month: 12, day: 26 },
    ],
  },
  singapore: {
    national: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "Labour Day", month: 5, day: 1 },
      { name: "National Day", month: 8, day: 9 },
      { name: "Christmas Day", month: 12, day: 25 },
    ],
  },
  uae: {
    national: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "Commemoration Day", month: 12, day: 1 },
      { name: "National Day", month: 12, day: 2 },
      { name: "National Day Holiday", month: 12, day: 3 },
    ],
  },
  nz: {
    national: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "Day after New Year's", month: 1, day: 2 },
      { name: "Waitangi Day", month: 2, day: 6 },
      { name: "Anzac Day", month: 4, day: 25 },
      { name: "Christmas Day", month: 12, day: 25 },
      { name: "Boxing Day", month: 12, day: 26 },
    ],
  },
  za: {
    national: [
      { name: "New Year's Day", month: 1, day: 1 },
      { name: "Human Rights Day", month: 3, day: 21 },
      { name: "Freedom Day", month: 4, day: 27 },
      { name: "Workers' Day", month: 5, day: 1 },
      { name: "Youth Day", month: 6, day: 16 },
      { name: "Heritage Day", month: 9, day: 24 },
      { name: "Day of Reconciliation", month: 12, day: 16 },
      { name: "Christmas Day", month: 12, day: 25 },
    ],
  },
};

function resolveCountry(country: string): CountryDef | null {
  const key = COUNTRY_ALIASES[norm(country)];
  return key ? COUNTRIES[key] ?? null : null;
}

function fmt(year: number, m: number, d: number): string {
  return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Return default holiday rows that fall within [startDate, endDate].
 * Both inclusive, ISO `YYYY-MM-DD`. Returns [] when the country is unknown
 * or the range is invalid — the admin always retains full add/edit/delete
 * control.
 */
export function getDefaultHolidays(
  country: string,
  state: string,
  startDate: string,
  endDate: string,
): SeededHoliday[] {
  const def = resolveCountry(country || "");
  if (!def) return [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const stateKey = norm(state || "");
  const stateRows = def.states?.[stateKey] ?? [];
  const all: FixedHoliday[] = [...def.national, ...stateRows];

  const out: SeededHoliday[] = [];
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    for (const h of all) {
      const iso = fmt(y, h.month, h.day);
      const d = new Date(iso);
      if (d >= start && d <= end) {
        out.push({ name: h.name, date: iso, scope: "gov" });
      }
    }
  }
  // Stable sort by date then name.
  out.sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date.localeCompare(b.date)));
  return out;
}

export function hasCountryDefaults(country: string): boolean {
  return resolveCountry(country || "") !== null;
}
