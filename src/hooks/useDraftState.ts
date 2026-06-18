import { useEffect, useRef, useState } from "react";

/**
 * useDraftState — like useState, but transparently persists to localStorage
 * so that on page refresh the user's last typed value prevails (until they
 * change it themselves or the draft is explicitly cleared).
 *
 * Writes are debounced (~400ms) so rapid typing is not chatty.
 *
 *   const [s1, setS1, clearS1] = useDraftState("onboarding.s1", initial);
 */
export function useDraftState<T>(
  key: string,
  initial: T,
  debounceMs = 400,
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* quota or serialization error — silent */
      }
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, value, debounceMs]);

  function clear() {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  }

  return [value, setValue, clear];
}
