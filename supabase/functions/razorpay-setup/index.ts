// Temporary one-off setup: creates the TEST-MODE Razorpay plans (Plus ₹299, Pro ₹799)
// so test-mode checkout can be verified before going live. Idempotent and removed after use.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/auth.ts";
import { razorpayRequest } from "../_shared/razorpay.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

const PLANS = [
  { key: "plus", name: "Debug Plus Monthly", amount: 29900 },
  { key: "pro", name: "Debug Pro Monthly", amount: 79900 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "create-test-plans") return json(req, { error: "Missing confirmation" }, 403);

  const keyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
  if (!keyId.startsWith("rzp_test_")) {
    return json(req, { error: "Refusing to run: the configured Razorpay key is not a test key" }, 409);
  }

  try {
    const existing = await razorpayRequest("/plans?count=100", "GET");
    const items = Array.isArray(existing?.items) ? existing.items : [];
    const result: Record<string, string | null> = {};

    for (const plan of PLANS) {
      const match = items.find((item: any) =>
        item?.item?.name === plan.name &&
        item?.item?.amount === plan.amount &&
        item?.period === "monthly"
      );
      if (match) {
        result[plan.key] = match.id;
        continue;
      }
      const created = await razorpayRequest("/plans", "POST", {
        period: "monthly",
        interval: 1,
        item: { name: plan.name, amount: plan.amount, currency: "INR" },
        notes: { app: "debug", plan: plan.key, mode: "test" },
      });
      result[plan.key] = created?.id ?? null;
    }

    return json(req, { keyIdPrefix: keyId.slice(0, 9), plans: result });
  } catch (error) {
    return json(req, { error: error instanceof Error ? error.message : "Setup failed" }, 500);
  }
});
