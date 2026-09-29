import { AlertTriangle, Gauge, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubscriptionDetails } from "@/hooks/useSubscription";

interface SubscriptionStatusProps {
  subscription?: SubscriptionDetails;
  remaining: number | null;
  onPricing: () => void;
  onBilling: () => void;
}

function suggestion(sub: SubscriptionDetails, remaining: number): string | null {
  if (sub.status === "past_due") return "Payment failed — update billing to keep your plan.";
  if (sub.status === "pending") return "Your upgrade is waiting for payment confirmation.";
  const low = remaining <= Math.max(1, Math.ceil(sub.run_limit * 0.2));
  if (sub.plan === "free") {
    if (remaining === 0) return "Free runs used up. Plus gives you 20 runs every month.";
    if (low) return "Running low — Plus gives you 20 runs every month.";
    return null;
  }
  if (sub.plan === "plus") {
    if (remaining === 0) return "This month's runs are used. Upgrade to Pro for 100 runs now.";
    if (low) return "Running low — Pro gives you 100 runs a month.";
    return null;
  }
  if (remaining === 0) return "This month's runs are used. They renew on your next billing date.";
  return null;
}

export function SubscriptionStatus({ subscription, remaining, onPricing, onBilling }: SubscriptionStatusProps) {
  if (!subscription || remaining === null) return null;
  const limitReached = remaining === 0;
  const pastDue = subscription.status === "past_due";
  const tip = suggestion(subscription, remaining);
  const canUpgrade = subscription.plan !== "pro" && subscription.status !== "pending";
  const warn = pastDue || limitReached;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4 ${warn ? "bg-destructive/10" : "bg-secondary/20"}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
        {warn ? <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" /> : <Gauge className="h-4 w-4 shrink-0 text-primary" />}
        <span className="font-semibold text-foreground">
          {remaining} of {subscription.run_limit} runs left
        </span>
        <span className="text-muted-foreground">· {subscription.plan.toUpperCase()} plan</span>
        {tip && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />{tip}
          </span>
        )}
      </div>
      {(pastDue || (tip && canUpgrade)) && (
        <Button size="sm" variant={pastDue ? "destructive" : limitReached ? "default" : "outline"} className="h-7 text-xs" onClick={pastDue ? onBilling : onPricing}>
          {pastDue ? "Update billing" : subscription.plan === "free" ? "See Plus" : "See Pro"}
        </Button>
      )}
    </div>
  );
}
