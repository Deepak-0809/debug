import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, unauthorizedResponse, validateAuth } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/admin.ts";
import { isPaidPlan, PLAN_CONFIG, publicPlanConfig } from "../_shared/plan-config.ts";
import { getPublicRazorpayKey, razorpayRequest, verifyPaymentSignature } from "../_shared/razorpay.ts";

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
      // One-time order checkout (works with any card; no recurring mandate needed).
      // An unpaid pending checkout is simply replaced by the new one.
      const order = await razorpayRequest("/orders", "POST", {
        amount: PLAN_CONFIG[body.plan].priceInr * 100,
        currency: "INR",
        notes: { user_id: auth.userId, plan: body.plan },
      });
      const { error } = await admin.rpc("set_subscription_pending", {
        _user_id: auth.userId,
        _plan: body.plan,
        _subscription_id: order.id,
      });
      if (error) throw error;
      console.info("order checkout created", { userId: auth.userId, plan: body.plan });
      return json(req, {
        keyId: getPublicRazorpayKey(),
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        plan: body.plan,
        name: PLAN_CONFIG[body.plan].name,
      });
    }

    if (action === "verify") {
      const orderId = typeof body?.orderId === "string" ? body.orderId : "";
      const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
      const signature = typeof body?.signature === "string" ? body.signature : "";
      if (!/^order_[A-Za-z0-9]+$/.test(orderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !/^[a-f0-9]{64}$/.test(signature)) {
        return json(req, { error: "Invalid payment details." }, 400);
      }
      if (!(await verifyPaymentSignature(orderId, paymentId, signature))) {
        return json(req, { error: "Payment could not be verified." }, 400);
      }
      if (initialized?.status === "active" && initialized?.razorpay_subscription_id === orderId) {
        return json(req, { subscription: initialized });
      }
      const order = await razorpayRequest(`/orders/${encodeURIComponent(orderId)}`);
      const plan = order?.notes?.plan;
      if (order?.notes?.user_id !== auth.userId || !isPaidPlan(plan)) {
        return json(req, { error: "This payment does not belong to your account." }, 403);
      }
      if (order?.status !== "paid" && Number(order?.amount_paid || 0) < Number(order?.amount || 1)) {
        const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
        if (payment?.order_id !== orderId || !["captured", "authorized"].includes(payment?.status)) {
          return json(req, { error: "Payment is not complete yet." }, 409);
        }
      }
      const { data: updated, error } = await admin.rpc("apply_subscription_state", {
        _user_id: auth.userId,
        _plan: plan,
        _status: "active",
        _run_limit: PLAN_CONFIG[plan].runLimit,
        _cycle_start: new Date().toISOString(),
        _cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        _grace_period_end: null,
        _razorpay_customer_id: null,
        _razorpay_subscription_id: orderId,
        _reset_runs: true,
        _source: "checkout_verify",
        _event_id: `verify:${paymentId}`,
      });
      if (error) throw error;
      console.info("order payment verified", { userId: auth.userId, plan });
      return json(req, { subscription: updated });
    }

    if (action === "change") {
      if (!isPaidPlan(body?.plan)) return json(req, { error: "Choose Plus or Pro." }, 400);
      if (!initialized?.razorpay_subscription_id || initialized?.status !== "active") {
        return json(req, { error: "No active subscription is available to change." }, 409);
      }
      if (initialized.plan === body.plan) return json(req, { subscription: initialized });
      const changed = await razorpayRequest(`/subscriptions/${encodeURIComponent(initialized.razorpay_subscription_id)}`, "PATCH", {
        plan_id: getRazorpayPlanId(body.plan),
        quantity: 1,
        schedule_change_at: "now",
        customer_notify: 1,
        notes: { user_id: auth.userId, plan: body.plan },
      });
      const isUpgrade = body.plan === "pro" && initialized.plan === "plus";
      const { data: updated, error } = await admin.rpc("apply_subscription_state", {
        _user_id: auth.userId,
        _plan: body.plan,
        _status: "active",
        _run_limit: PLAN_CONFIG[body.plan].runLimit,
        _cycle_start: changed?.current_start ? new Date(changed.current_start * 1000).toISOString() : initialized.cycle_start,
        _cycle_end: changed?.current_end ? new Date(changed.current_end * 1000).toISOString() : initialized.cycle_end,
        _grace_period_end: null,
        _razorpay_customer_id: changed?.customer_id || null,
        _razorpay_subscription_id: initialized.razorpay_subscription_id,
        _reset_runs: isUpgrade,
        _source: "subscription_change",
        _event_id: null,
      });
      if (error) throw error;
      console.info("subscription change requested", { userId: auth.userId, plan: body.plan });
      return json(req, { subscription: updated });
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