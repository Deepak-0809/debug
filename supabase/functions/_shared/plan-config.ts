export type PaidPlan = "plus" | "pro";

export const PLAN_CONFIG = {
  free: {
    name: "Free",
    interval: "lifetime",
    runLimit: 5,
    priceInr: 0,
  },
  plus: {
    name: "Plus",
    interval: "monthly",
    runLimit: 20,
    priceInr: 299,
  },
  pro: {
    name: "Pro",
    interval: "monthly",
    runLimit: 100,
    priceInr: 799,
  },
} as const;

export const PAYMENT_GRACE_DAYS = 3;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "plus" || value === "pro";
}

export function getRazorpayPlanId(plan: PaidPlan): string {
  const name = plan === "plus" ? "RAZORPAY_PLUS_PLAN_ID" : "RAZORPAY_PRO_PLAN_ID";
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function publicPlanConfig() {
  return {
    currency: "INR",
    graceDays: PAYMENT_GRACE_DAYS,
    plans: PLAN_CONFIG,
  };
}