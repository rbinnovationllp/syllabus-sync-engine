import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { recalculateSchedule } from "./ai-generation.functions";

const reportInput = z.object({
  year_id: z.string().uuid(),
  category: z.enum([
    "weather", "closure", "illness", "exam_shift",
    "event_overrun", "election", "strike", "other",
  ]),
  reason: z.string().trim().min(3).max(500),
  lost_days: z.number().int().min(0).max(365),
  lost_periods: z.number().int().min(0).max(2000).default(0),
  affected_grades: z.array(z.string().max(20)).max(15).default([]),
  affected_sections: z.array(z.string().max(20)).max(40).default([]),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  apply_recalibration: z.boolean().default(true),
});

export const reportDisruption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => reportInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: yr } = await supabase
      .from("academic_years")
      .select("id, org_id, school_id, start_date, end_date")
      .eq("id", data.year_id)
      .maybeSingle();
    if (!yr) throw new Error("Academic year not found");

    const { data: row, error } = await supabase
      .from("disruptions")
      .insert({
        org_id: (yr as any).org_id,
        school_id: (yr as any).school_id,
        year_id: data.year_id,
        reason: data.reason,
        category: data.category,
        lost_days: data.lost_days,
        lost_periods: data.lost_periods,
        affected_grades: data.affected_grades,
        affected_sections: data.affected_sections,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        reported_by: userId,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (!data.apply_recalibration) {
      return { ok: true as const, disruption: row, recalibration: null };
    }

    const summary =
      `${data.category.toUpperCase()} — ${data.reason}. ` +
      `Lost ${data.lost_days} day(s)/${data.lost_periods} period(s). ` +
      (data.affected_grades.length ? `Grades: ${data.affected_grades.join(", ")}. ` : "") +
      (data.affected_sections.length ? `Sections: ${data.affected_sections.join(", ")}. ` : "") +
      (data.start_date ? `Window: ${data.start_date}${data.end_date ? `→${data.end_date}` : ""}. ` : "");

    const recalc = await recalculateSchedule({
      data: { year_id: data.year_id, disruption: summary.slice(0, 500) },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if ((recalc as any).error) {
      const status = (recalc as any).error === "INSUFFICIENT_CREDITS" ? "infeasible" : "pending";
      await supabaseAdmin
        .from("disruptions")
        .update({ status, notes: `Recalibration failed: ${(recalc as any).error}` })
        .eq("id", (row as any).id);
      return { ok: true as const, disruption: row, recalibration: recalc };
    }

    // Link this disruption to the latest annual_calendar version
    const { data: latest } = await supabaseAdmin
      .from("curriculum_versions")
      .select("id")
      .eq("year_id", data.year_id)
      .eq("entity_type", "annual_calendar")
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabaseAdmin
      .from("disruptions")
      .update({
        status: "recalibrated",
        applied_version_id: (latest as any)?.id ?? null,
      })
      .eq("id", (row as any).id);

    return { ok: true as const, disruption: row, recalibration: recalc };
  });

export const listDisruptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ year_id: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("disruptions")
      .select("*")
      .eq("year_id", data.year_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const dismissDisruption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("disruptions")
      .update({ status: "dismissed" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
