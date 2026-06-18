import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ALLOWED_MODELS, DEFAULT_MODEL, isAllowedModel, type AllowedModel } from "@/lib/ai-policy";

const orgInput = z.object({ org_id: z.string().uuid() });

/** Read the active model + escalation flag for an org. Returns defaults if no row exists. */
export const getOrgAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("ai_model_settings")
      .select("active_model, allow_fallback_escalation, updated_at, updated_by")
      .eq("org_id", data.org_id)
      .maybeSingle();
    return {
      org_id: data.org_id,
      active_model: (row?.active_model as AllowedModel) ?? DEFAULT_MODEL,
      allow_fallback_escalation: row?.allow_fallback_escalation ?? true,
      updated_at: row?.updated_at ?? null,
      updated_by: row?.updated_by ?? null,
    };
  });

const updateInput = z.object({
  org_id: z.string().uuid(),
  active_model: z.string(),
  allow_fallback_escalation: z.boolean().optional(),
});

export const updateOrgAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => updateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!isAllowedModel(data.active_model)) {
      throw new Error(
        `Model "${data.active_model}" is blocked by policy. Allowed: ${ALLOWED_MODELS.join(", ")}`,
      );
    }
    const { error } = await supabase
      .from("ai_model_settings")
      .upsert(
        {
          org_id: data.org_id,
          active_model: data.active_model,
          allow_fallback_escalation: data.allow_fallback_escalation ?? true,
          updated_by: userId,
        },
        { onConflict: "org_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** List the orgs the caller belongs to with role + active model, for the admin picker. */
export const listMyOrgsWithAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: members } = await supabase
      .from("org_members")
      .select("org_id, role, organizations(name)")
      .eq("user_id", userId);
    const orgIds = (members ?? []).map((m: any) => m.org_id);
    if (orgIds.length === 0) return [];
    const { data: settings } = await supabase
      .from("ai_model_settings")
      .select("org_id, active_model, allow_fallback_escalation, updated_at")
      .in("org_id", orgIds);
    const byOrg = new Map((settings ?? []).map((s: any) => [s.org_id, s]));
    return (members ?? []).map((m: any) => {
      const s = byOrg.get(m.org_id) as any;
      return {
        org_id: m.org_id,
        org_name: m.organizations?.name ?? "Untitled org",
        role: m.role,
        active_model: (s?.active_model as AllowedModel) ?? DEFAULT_MODEL,
        allow_fallback_escalation: s?.allow_fallback_escalation ?? true,
        updated_at: s?.updated_at ?? null,
      };
    });
  });
