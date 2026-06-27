import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { recordSiteVisit } from "@/lib/site-analytics.functions";

const VISITOR_KEY = "syllabus_synk_visitor_id";

function getVisitorId() {
  const existing = window.localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;

  const id =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(VISITOR_KEY, id);
  return id;
}

export function SiteVisitTracker() {
  const location = useLocation();
  const recordVisit = useServerFn(recordSiteVisit);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const path = `${location.pathname}${location.searchStr ?? ""}`;
    if (!path || path.startsWith("/api/")) return;

    const sessionKey = `site_visit_recorded:${path}`;
    if (window.sessionStorage.getItem(sessionKey)) return;
    window.sessionStorage.setItem(sessionKey, "1");

    const visitorId = getVisitorId();

    window.setTimeout(() => {
      void recordVisit({
        data: {
          visitorId,
          path,
          pageTitle: document.title,
          referrer: document.referrer || null,
          userAgent: navigator.userAgent,
          screenWidth: window.screen?.width ?? null,
          screenHeight: window.screen?.height ?? null,
        },
      }).catch(() => {
        // Analytics must never disturb the user experience.
      });
    }, 400);
  }, [location.pathname, location.searchStr, recordVisit]);

  return null;
}
