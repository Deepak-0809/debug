import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, unauthorizedResponse, validateAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/admin.ts";
import { getRazorpayPlanId, isPaidPlan, PLAN_CONFIG, publicPlanConfig } from "../_shared/plan-config.ts";
import { getPublicRazorpayKey, razorpayRequest } from "../_shared/razorpay.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const auth = await validateAuth(req);
  if (!auth) return unauthorizedResponse(req);

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "status";
    const admin = createAdminClient();

    if (action === "config") {
      return json(req, publicPlanConfig());
    }

    const { data: initialized, error: initializeError } = await admin.rpc("initialize_subscription", {
      _user_id: auth.userId,
    });
    if (initializeError) throw initializeError;

    if (action === "status") {
      return json(req, { subscription: initialized, config: publicPlanConfig() });
    }

    if (action === "create") {
      if (!isPaidPlan(body?.plan)) return json(req, { error: "Choose Plus or Pro." }, 400);
      if (initialized?.status === "pending") {
        return json(req, { error: "A subscription is already awaiting confirmation." }, 409);
      }
      const planId = getRazorpayPlanId(body.plan);
      const subscription = await razorpayRequest("/subscriptions", "POST", {
        plan_id: planId,
        total_count: 120,
        quantity: 1,
        customer_notify: 1,
        notes: { user_id: auth.userId, plan: body.plan },
      });
      const { error } = await admin.rpc("set_subscription_pending", {
        _user_id: auth.userId,
        _plan: body.plan,
        _subscription_id: subscription.id,
      });
      if (error) throw error;
      console.info("subscription checkout created", { userId: auth.userId, plan: body.plan });
      return json(req, {
        keyId: getPublicRazorpayKey(),
        subscriptionId: subscription.id,
        plan: body.plan,
        name: PLAN_CONFIG[body.plan].name,
      });
    }

    if (action === "change") {
      if (!isPaidPlan(body?.plan)) return json(req, { error: "Choose Plus or Pro." }, 400);
      if (!initialized?.razorpay_subscription_id || initialized?.status !== "active") {
        return json(req, { error: "No active subscription is available to change." }, 409);
      }
      if (initialized.plan === body.plan) return json(req, { subscription: initialized });
      await razorpayRequest(`/subscriptions/${encodeURIComponent(initialized.razorpay_subscription_id)}`, "PATCH", {
        plan_id: getRazorpayPlanId(body.plan),
        quantity: 1,
        schedule_change_at: "now",
        customer_notify: 1,
        notes: { user_id: auth.userId, plan: body.plan },
      });
      const { error } = await admin.from("subscriptions").update({ pending_plan: body.plan, updated_at: new Date().toISOString() }).eq("user_id", auth.userId);
      if (error) throw error;
      console.info("subscription change requested", { userId: auth.userId, plan: body.plan });
      return json(req, { confirming: true });
    }

    if (action === "cancel") {
      if (!initialized?.razorpay_subscription_id || !["active", "past_due"].includes(initialized?.status)) {
        return json(req, { error: "No active subscription is available to cancel." }, 409);
      }
      await razorpayRequest(`/subscriptions/${encodeURIComponent(initialized.razorpay_subscription_id)}/cancel`, "POST", {
        cancel_at_cycle_end: 1,
      });
      console.info("subscription cancellation requested", { userId: auth.userId });
      return json(req, { cancellationScheduled: true, cycleEnd: initialized.cycle_end });
    }

    return json(req, { error: "Unknown billing action." }, 400);
  } catch (error) {
    console.error("subscription-api error", error instanceof Error ? error.message : "Unknown error");
    return json(req, { error: error instanceof Error ? error.message : "Billing request failed" }, 500);
  }
});