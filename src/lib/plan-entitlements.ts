export type PlanFeature =
  | "v2_ai"
  | "school_crm"
  | "parent_hub"
  | "assessment_ai"
  | "multi_campus"
  | "priority_support";

export async function getPrimaryOrgId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.org_id) throw new Error("Create or join a school profile first.");
  return data.org_id as string;
}

export async function hasOrgFeature(supabase: any, userId: string, feature: PlanFeature): Promise<boolean> {
  const orgId = await getPrimaryOrgId(supabase, userId);

  const { data, error } = await supabase
    .from("organization_subscription_profiles")
    .select("plan_code, status, ends_at, subscription_plan_catalog(feature_flags)")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    if (String(error.message ?? "").includes("organization_subscription_profiles")) return false;
    throw new Error(error.message);
  }

  if (!data) return false;
  if (data.ends_at && new Date(data.ends_at).getTime() < Date.now()) return false;
  if (!["active", "trialing", "manual", "paid"].includes(data.status)) return false;

  const flags = (data.subscription_plan_catalog as any)?.feature_flags ?? {};
  return flags[feature] === true;
}

export async function requireOrgFeature(supabase: any, userId: string, feature: PlanFeature) {
  const ok = await hasOrgFeature(supabase, userId, feature);
  if (!ok) {
    throw new Error("This feature is available only in the required subscription plan. Please upgrade or ask the company admin to assign the correct plan code.");
  }
}
