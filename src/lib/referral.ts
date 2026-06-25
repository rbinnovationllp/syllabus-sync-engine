// Client-side helpers for ?ref=CODE capture.
// Stores the partner code in a first-party cookie + localStorage for 90 days.

const COOKIE_NAME = "cos_ref";
const STORAGE_KEY = "cos_ref";
const MAX_AGE_DAYS = 90;
const CODE_RE = /^[A-Z0-9]{4,16}$/;

function setCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 86400 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

/** Read ?ref= from the URL, validate, persist for 90 days. */
export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("ref");
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!CODE_RE.test(code)) return null;
  setCookie(COOKIE_NAME, code, MAX_AGE_DAYS);
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // ignore (private mode, etc.)
  }
  return code;
}

export function getStoredReferralCode(): string | null {
  const fromCookie = readCookie(COOKIE_NAME);
  if (fromCookie && CODE_RE.test(fromCookie)) return fromCookie;
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && CODE_RE.test(v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearStoredReferralCode() {
  clearCookie(COOKIE_NAME);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
