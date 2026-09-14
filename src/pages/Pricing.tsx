import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { BillingHeader } from "@/components/BillingHeader";
import { Button } from "@/components/ui/button";
import { useSubscription, type PlanName } from "@/hooks/useSubscription";
import { callBilling, openSubscriptionCheckout } from "@/lib/billing";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Pricing() {
  const navigate = useNavigate();
  const { subscription, config, isLoading, refresh } = useSubscription();
  const [workingPlan, setWorkingPlan] = useState<PlanName | null>(null);
  const [confirming, setConfirming] = useState(false);

  const choosePlan = async (plan: PlanName) => {
    if (plan === "free") return;
    setWorkingPlan(plan);
    try {
      if (subscription?.status === "active" && subscription.plan !== "free") {
        await callBilling("change", plan);
        setConfirming(true);
        toast.info(`Confirming your ${plan === "pro" ? "Pro" : "Plus"} plan change…`);
        return;
      }
      await openSubscriptionCheckout(plan, () => {
        setConfirming(true);
        toast.info("Payment received. Confirming your subscription…");
        let attempts = 0;
        const timer = window.setInterval(async () => {
          attempts += 1;
          const result = await refresh();
          const state = result[0]?.data?.subscription;
          if (state?.status === "active") {
            window.clearInterval(timer);
            setConfirming(false);
            toast.success(`${state.plan === "pro" ? "Pro" : "Plus"} is active.`);
            navigate("/billing");
          } else if (attempts >= 20) {
            window.clearInterval(timer);
            setConfirming(false);
            toast.info("Confirmation is taking longer than usual. Check Billing shortly.");
          }
        }, 3000);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout could not start");
    } finally { setWorkingPlan(null); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BillingHeader title="Plans" />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-bold">Choose your debugging allowance</h2>
          <p className="mt-2 text-sm text-muted-foreground">Every full debug or single test uses one run. Retries inside that run are included.</p>
        </div>
        {isLoading || !config ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(config.plans) as PlanName[]).map((plan) => {
              const details = config.plans[plan];
              const current = subscription?.plan === plan;
              return (
                <section key={plan} className={`flex min-h-[330px] flex-col rounded-md border p-6 ${plan === "plus" ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                  <div className="text-sm font-semibold uppercase text-muted-foreground">{details.name}</div>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-bold">₹{details.priceInr}</span>
                    <span className="pb-1 text-sm text-muted-foreground">{details.interval === "monthly" ? "/ month" : "once"}</span>
                  </div>
                  <div className="mt-6 flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" />{details.runLimit} {details.interval === "monthly" ? "runs each billing cycle" : "lifetime runs"}</div>
                  <div className="mt-2 flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" />Full pipeline retries included</div>
                  <div className="mt-auto pt-8">
                    <Button className="w-full" variant={current ? "outline" : plan === "plus" ? "default" : "secondary"} disabled={current || plan === "free" || Boolean(workingPlan) || confirming} onClick={() => choosePlan(plan)}>
                      {workingPlan === plan || confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {current ? "Current plan" : plan === "free" ? "Included" : confirming ? "Confirming…" : `Choose ${details.name}`}
                    </Button>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}