import { AlertTriangle, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubscriptionDetails } from "@/hooks/useSubscription";

interface SubscriptionStatusProps {
  subscription?: SubscriptionDetails;
  remaining: number | null;
  onPricing: () => void;
  onBilling: () => void;
}

export function SubscriptionStatus({ subscription, remaining, onPricing, onBilling }: SubscriptionStatusProps) {
  if (!subscription || remaining === null) return null;
  const limitReached = remaining === 0;
  const pastDue = subscription.status === "past_due";

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4 ${pastDue || limitReached ? "bg-destructive/10" : "bg-secondary/20"}`}>
      <div className="flex min-w-0 items-center gap-2 text-xs">
        {pastDue || limitReached ? <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" /> : <Gauge className="h-4 w-4 shrink-0 text-primary" />}
        <span className="font-semibold text-foreground">
          {pastDue ? "Payment needs attention" : `${remaining} of ${subscription.run_limit} runs remaining`}
        </span>
        <span className="hidden text-muted-foreground sm:inline">{subscription.plan.toUpperCase()} plan</span>
      </div>
      {(pastDue || limitReached) && (
        <Button size="sm" variant={pastDue ? "destructive" : "outline"} className="h-7 text-xs" onClick={pastDue ? onBilling : onPricing}>
          {pastDue ? "Update billing" : "View plans"}
        </Button>
      )}
    </div>
  );
}