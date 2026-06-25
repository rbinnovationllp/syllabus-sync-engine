import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { tierForPriceId, planForTier, type TierId } from "@/lib/plans";

interface SubscriptionRow {
  id: string;
  status: string;
  price_id: string;
  product_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_customer_id: string;
}

async function fetchSubscription(userId: string): Promise<SubscriptionRow | null> {
  const env = getStripeEnvironment();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id,status,price_id,product_id,current_period_end,cancel_at_period_end,stripe_customer_id")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SubscriptionRow | null) ?? null;
}

export function useSubscription() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const query = useQuery({
    queryKey: ["subscription", userId],
    queryFn: () => fetchSubscription(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`subscription:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => query.refetch(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, query]);

  const row = query.data ?? null;
  const tier: TierId | null = tierForPriceId(row?.price_id);
  const plan = planForTier(tier);
  const isActive = !!row && (
    (["active", "trialing", "past_due"].includes(row.status) &&
      (!row.current_period_end || new Date(row.current_period_end) > new Date()))
    || (row.status === "canceled" && !!row.current_period_end && new Date(row.current_period_end) > new Date())
  );

  return { subscription: row, tier, plan, isActive, isLoading: query.isLoading, userId };
}
