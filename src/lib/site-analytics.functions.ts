import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const visitSchema = z.object({
  visitorId: z.string().trim().min(8).max(120),
  path: z.string().trim().min(1).max(500),
  pageTitle: z.string().trim().max(250).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
  userAgent: z.string().trim().max(500).optional().nullable(),
  screenWidth: z.number().int().positive().max(10000).optional().nullable(),
  screenHeight: z.number().int().positive().max(10000).optional().nullable(),
});

function cleanPath(path: string) {
  try {
    const url = new URL(path, "https://syllabus-synk.in");
    return `${url.pathname}${url.search ? url.search.slice(0, 180) : ""}`;
  } catch {
    return path.slice(0, 500);
  }
}

export const recordSiteVisit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => visitSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const path = cleanPath(data.path);
    if (
      path.startsWith("/api/") ||
      path.startsWith("/assets/") ||
      path.includes("favicon") ||
      path.includes("robots.txt")
    ) {
      return { ok: true, skipped: true };
    }

    const { error } = await supabaseAdmin.from("site_page_views").insert({
      visitor_id: data.visitorId,
      path,
      page_title: data.pageTitle ?? null,
      referrer: data.referrer ?? null,
      user_agent: data.userAgent ?? null,
      screen_width: data.screenWidth ?? null,
      screen_height: data.screenHeight ?? null,
    });

    if (error) {
      console.warn("Could not record site visit", error.message);
      return { ok: false };
    }

    return { ok: true };
  });
