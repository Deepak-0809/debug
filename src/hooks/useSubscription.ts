import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PlanName = "free" | "plus" | "pro";
export type SubscriptionStatus = "none" | "pending" | "active" | "past_due" | "cancelled" | "halted";

export interface PlanDetails {
  name: string;
  interval: "lifetime" | "monthly";
  runLimit: number;
  priceInr: number;
}

export interface SubscriptionDetails {
  user_id: string;
  plan: PlanName;
  status: SubscriptionStatus;
  runs_used: number;
  run_limit: number;
  cycle_start: string | null;
  cycle_end: string | null;
  grace_period_end: string | null;
  pending_plan: PlanName | null;
}

export interface SubscriptionPayload {
  subscription: SubscriptionDetails;
  config: {
    currency: "INR";
    graceDays: number;
    plans: Record<PlanName, PlanDetails>;
  };
}

async function loadSubscription(): Promise<SubscriptionPayload> {
  const { data, error } = await supabase.functions.invoke("subscription-api", { body: { action: "status" } });
  if (error) throw new Error(error.message || "Unable to load subscription");
  if (data?.error) throw new Error(data.error);
  return data as SubscriptionPayload;
}

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: loadSubscription,
    enabled: Boolean(user),
    staleTime: 15_000,
  });
  return {
    ...query,
    subscription: query.data?.subscription,
    config: query.data?.config,
    remaining: query.data?.subscription
      ? Math.max(query.data.subscription.run_limit - query.data.subscription.runs_used, 0)
      : null,
    refresh: () => queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] }),
  };
}