import { useState } from "react";
import { AlertTriangle, CalendarDays, Gauge, Loader2 } from "lucide-react";
import { BillingHeader } from "@/components/BillingHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { callBilling } from "@/lib/billing";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Not applicable";
}

export default function Billing() {
  const navigate = useNavigate();
  const { subscription, config, remaining, isLoading, refresh } = useSubscription();
  const [cancelling, setCancelling] = useState(false);

  const cancel = async () => {
    if (!window.confirm("Cancel at the end of the current billing cycle?")) return;
    setCancelling(true);
    try {
      const result = await callBilling("cancel");
      toast.success(result.cycleEnd ? `Cancellation scheduled for ${formatDate(result.cycleEnd)}.` : "Cancellation scheduled.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BillingHeader title="Billing" />
      <main className="mx-auto max-w-3xl px-4 py-10">
        {isLoading || !subscription || !config || remaining === null ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <div className="space-y-8">
            {subscription.status === "past_due" && (
              <div className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <div><p className="font-semibold">Payment needs attention</p><p className="text-sm text-muted-foreground">Your access continues until {formatDate(subscription.grace_period_end)}. Update your payment method in Razorpay Checkout.</p></div>
              </div>
            )}
            <section className="rounded-md border border-border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-sm text-muted-foreground">Current plan</p><h2 className="mt-1 text-3xl font-bold capitalize">{subscription.plan}</h2><p className="mt-1 text-sm capitalize text-muted-foreground">{subscription.status.replace("_", " ")}</p></div>
                <Button onClick={() => navigate("/pricing")}>{subscription.plan === "free" ? "Upgrade" : "Change plan"}</Button>
              </div>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <div><div className="mb-2 flex items-center gap-2 text-sm font-medium"><Gauge className="h-4 w-4 text-primary" />Run allowance</div><p className="text-2xl font-bold">{remaining} remaining</p><Progress className="mt-3 h-2" value={(subscription.runs_used / Math.max(subscription.run_limit, 1)) * 100} /><p className="mt-2 text-xs text-muted-foreground">{subscription.runs_used} of {subscription.run_limit} used</p></div>
                <div><div className="mb-2 flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4 text-primary" />Next renewal</div><p className="text-2xl font-bold">{formatDate(subscription.cycle_end)}</p><p className="mt-2 text-xs text-muted-foreground">Free allowances do not renew.</p></div>
              </div>
            </section>
            {subscription.plan !== "free" && ["active", "past_due"].includes(subscription.status) && (
              <div className="flex items-center justify-between gap-4 border-t border-border pt-6"><div><p className="font-medium">Cancel subscription</p><p className="text-sm text-muted-foreground">Your paid access continues through the current cycle.</p></div><Button variant="outline" disabled={cancelling} onClick={cancel}>{cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cancel</Button></div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}