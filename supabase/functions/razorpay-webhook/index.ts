import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/admin.ts";
import { PAYMENT_GRACE_DAYS, PLAN_CONFIG, type PaidPlan } from "../_shared/plan-config.ts";
import { sha256, verifyWebhookSignature } from "../_shared/razorpay.ts";

type RazorpayEntity = Record<string, any>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
  });
}

function dateFromEpoch(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function resolvePlan(entity: RazorpayEntity): PaidPlan | null {
  const noted = entity?.notes?.plan;
  if (noted === "plus" || noted === "pro") return noted;
  if (entity?.plan_id === Deno.env.get("RAZORPAY_PLUS_PLAN_ID")) return "plus";
  if (entity?.plan_id === Deno.env.get("RAZORPAY_PRO_PLAN_ID")) return "pro";
  return null;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  if (!(await verifyWebhookSignature(rawBody, signature))) return json({ error: "Invalid webhook signature" }, 400);

  let payload: RazorpayEntity;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid webhook payload" }, 400);
  }

  const eventType = typeof payload.event === "string" ? payload.event : "unknown";
  const subscriptionEntity = payload?.payload?.subscription?.entity || null;
  const paymentEntity = payload?.payload?.payment?.entity || null;
  const subscriptionId = subscriptionEntity?.id || paymentEntity?.subscription_id || null;
  const payloadHash = await sha256(rawBody);
  const eventId = req.headers.get("x-razorpay-event-id") || `${eventType}:${subscriptionId || "none"}:${payload?.created_at || payloadHash}`;
  const admin = createAdminClient();

  const { error: claimError } = await admin.from("payment_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    payload_hash: payloadHash,
  });
  if (claimError?.code === "23505") return json({ received: true, duplicate: true });
  if (claimError) return json({ error: "Unable to record webhook" }, 500);

  try {
    if (!["subscription.activated", "subscription.charged", "subscription.cancelled", "subscription.halted", "payment.failed"].includes(eventType)) {
      return json({ received: true, ignored: true });
    }
    if (!subscriptionId) throw new Error("Webhook is missing a subscription reference");

    const { data: current, error: lookupError } = await admin.from("subscriptions").select("*").eq("razorpay_subscription_id", subscriptionId).maybeSingle();
    if (lookupError) throw lookupError;
    const notedUserId = subscriptionEntity?.notes?.user_id;
    const userId = current?.user_id || (typeof notedUserId === "string" ? notedUserId : null);
    if (!userId) throw new Error("Subscription owner could not be resolved");

    const plan = resolvePlan(subscriptionEntity || {}) || current?.pending_plan || current?.plan;
    const customerId = subscriptionEntity?.customer_id || paymentEntity?.customer_id || current?.razorpay_customer_id || null;
    const cycleStart = dateFromEpoch(subscriptionEntity?.current_start) || current?.cycle_start || null;
    const cycleEnd = dateFromEpoch(subscriptionEntity?.current_end) || current?.cycle_end || null;
    let nextPlan = plan;
    let nextStatus = current?.status || "none";
    let runLimit = plan && plan in PLAN_CONFIG ? PLAN_CONFIG[plan as PaidPlan].runLimit : current?.run_limit || 5;
    let graceEnd: string | null = null;
    let resetRuns = false;

    if (eventType === "subscription.activated") {
      nextStatus = "active";
      resetRuns = current?.plan !== plan || current?.status !== "active";
    } else if (eventType === "subscription.charged") {
      nextStatus = "active";
      resetRuns = Boolean(cycleStart && cycleStart !== current?.cycle_start);
    } else if (eventType === "payment.failed") {
      nextStatus = "past_due";
      graceEnd = new Date(Date.now() + PAYMENT_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    } else {
      nextPlan = "free";
      nextStatus = eventType === "subscription.cancelled" ? "cancelled" : "halted";
      runLimit = PLAN_CONFIG.free.runLimit;
    }

    const { error: applyError } = await admin.rpc("apply_subscription_state", {
      _user_id: userId,
      _plan: nextPlan,
      _status: nextStatus,
      _run_limit: runLimit,
      _cycle_start: nextPlan === "free" ? null : cycleStart,
      _cycle_end: nextPlan === "free" ? null : cycleEnd,
      _grace_period_end: graceEnd,
      _razorpay_customer_id: customerId,
      _razorpay_subscription_id: subscriptionId,
      _reset_runs: resetRuns,
      _source: "razorpay_webhook",
      _event_id: eventId,
    });
    if (applyError) throw applyError;
    console.info("subscription webhook applied", { eventType, userId, plan: nextPlan, status: nextStatus });
    return json({ received: true });
  } catch (error) {
    await admin.from("payment_webhook_events").delete().eq("event_id", eventId);
    console.error("razorpay webhook failed", { eventType, message: error instanceof Error ? error.message : "Unknown error" });
    return json({ error: "Webhook processing failed" }, 500);
  }
});