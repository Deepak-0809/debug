import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PlanName = "free" | "plus" | "pro";
export type SubscriptionStatus = "none" | "pending" | "active" | "past_due" | "cancelled" | "halted";

export interface PlanDetails {
  name: string;
  interval: "lifetime" | "monthly";
  runLimit: number;
  singleTestLimit: number | null;
  priceInr: number;
}

export interface SubscriptionDetails {
  user_id: string;
  plan: PlanName;
  status: SubscriptionStatus;
  runs_used: number;
  run_limit: number;
  single_tests_used: number;
  single_tests_period_start: string;
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

function isUnauthorized(error: unknown) {
  const status = (error as { context?: { status?: number } })?.context?.status;
  return status === 401;
}

async function invokeStatus() {
  return supabase.functions.invoke("subscription-api", { body: { action: "status" } });
}

async function loadSubscription(): Promise<SubscriptionPayload> {
  let { data, error } = await invokeStatus();
  if (error && isUnauthorized(error)) {
    // Stale/revoked session: try refreshing once, otherwise sign out so the user re-logs in.
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      await supabase.auth.signOut();
      throw new Error("Your session expired. Please log in again.");
    }
    ({ data, error } = await invokeStatus());
    if (error && isUnauthorized(error)) {
      await supabase.auth.signOut();
      throw new Error("Your session expired. Please log in again.");
    }
  }
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
    retry: 1,
  });
  return {
    ...query,
    subscription: query.data?.subscription,
    config: query.data?.config,
    remaining: query.data?.subscription
      ? Math.max(query.data.subscription.run_limit - query.data.subscription.runs_used, 0)
      : null,
    singleLimit: query.data ? (query.data.config.plans[query.data.subscription.plan]?.singleTestLimit ?? null) : undefined,
    singleRemaining: (() => {
      const d = query.data;
      if (!d) return undefined;
      const lim = d.config.plans[d.subscription.plan]?.singleTestLimit ?? null;
      return lim === null ? null : Math.max(lim - (d.subscription.single_tests_used ?? 0), 0);
    })(),
    refresh: query.refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] }),
  };
}