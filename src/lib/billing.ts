import { supabase } from "@/integrations/supabase/client";
import type { PlanName } from "@/hooks/useSubscription";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export async function callBilling(action: string, plan?: PlanName, extra: Record<string, string> = {}) {
  const { data, error } = await supabase.functions.invoke("subscription-api", { body: { action, plan, ...extra } });
  if (error) {
    let message = "Billing request failed. Please try again.";
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) message = body.error;
    } catch { /* keep default */ }
    throw new Error(message);
  }
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

export async function openSubscriptionCheckout(plan: "plus" | "pro", onSubmitted: (result: Promise<any>) => void) {
  const checkout = await callBilling("create", plan);
  await loadCheckout();
  if (!window.Razorpay) throw new Error("Secure checkout is unavailable");
  new window.Razorpay({
    key: checkout.keyId,
    order_id: checkout.orderId,
    amount: checkout.amount,
    currency: checkout.currency,
    name: "DebugCP",
    description: `${checkout.name} plan — 1 month`,
    theme: { color: "hsl(var(--primary))" },
    handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
      onSubmitted(callBilling("verify", plan, {
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature,
      })),
    modal: { ondismiss: () => undefined },
  }).open();
}