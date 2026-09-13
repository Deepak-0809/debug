import { supabase } from "@/integrations/supabase/client";
import type { PlanName } from "@/hooks/useSubscription";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export async function callBilling(action: string, plan?: PlanName) {
  const { data, error } = await supabase.functions.invoke("subscription-api", { body: { action, plan } });
  if (error) throw new Error(error.message || "Billing request failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

async function loadCheckout() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load secure checkout"));
    document.body.appendChild(script);
  });
}

export async function openSubscriptionCheckout(plan: "plus" | "pro", onSubmitted: () => void) {
  const checkout = await callBilling("create", plan);
  await loadCheckout();
  if (!window.Razorpay) throw new Error("Secure checkout is unavailable");
  new window.Razorpay({
    key: checkout.keyId,
    subscription_id: checkout.subscriptionId,
    name: "DebugCP",
    description: `${checkout.name} monthly subscription`,
    theme: { color: "hsl(var(--primary))" },
    handler: onSubmitted,
    modal: { ondismiss: () => undefined },
  }).open();
}