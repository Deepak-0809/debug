import { createAdminClient } from "./admin.ts";
import { getCorsHeaders } from "./auth.ts";

export type RunActionType = "full_pipeline" | "single_test";

function parseActionKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

// Hold a run at the start of an action. Does not count against the allowance yet.
export async function reserveQuota(userId: string, actionKeyValue: unknown, actionType: RunActionType) {
  const actionKey = parseActionKey(actionKeyValue);
  if (!actionKey) return { ok: false as const, reason: "INVALID_ACTION_KEY" as const };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reserve_run_quota", {
    _user_id: userId, _action_key: actionKey, _action_type: actionType,
  });
  if (error) {
    console.error("quota reserve failed", { userId, actionType, message: error.message });
    throw new Error("Unable to verify run allowance");
  }
  console.info("quota reserve", { userId, actionType, allowed: data?.allowed === true, remaining: data?.remaining });
  return { ok: data?.allowed === true, reason: data?.code || null, usage: data } as const;
}

// Count the run: called only when the run completes end to end (step 3 / single test result).
export async function chargeQuota(userId: string, actionKeyValue: unknown, runId?: string | null) {
  const actionKey = parseActionKey(actionKeyValue);
  if (!actionKey) return null;
  const admin = createAdminClient();
  const validRunId = typeof runId === "string" && /^[0-9a-f-]{36}$/i.test(runId) ? runId : null;
  const { data, error } = await admin.rpc("charge_run_quota", {
    _user_id: userId, _action_key: actionKey, _run_id: validRunId,
  });
  if (error) {
    console.error("quota charge failed", { userId, message: error.message });
    return null;
  }
  console.info("quota charge", { userId, charged: data?.charged, remaining: data?.remaining, already: data?.already_charged });
  return data;
}

// Backwards-compatible alias: reserve only.
export const consumeQuota = reserveQuota;

export async function verifyQuotaAction(userId: string, actionKeyValue: unknown) {
  const actionKey = parseActionKey(actionKeyValue);
  if (!actionKey) return false;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_run_action", {
    _user_id: userId,
    _action_key: actionKey,
  });
  if (error) {
    console.error("quota verify failed", { userId, message: error.message });
    return false;
  }
  return data === true;
}

export function quotaResponse(req: Request, result: { reason: string | null; usage?: unknown }) {
  const headers = getCorsHeaders(req);
  const invalid = result.reason === "INVALID_ACTION_KEY";
  return new Response(JSON.stringify({
    error: invalid ? "This run could not be verified. Please try again." : "You have used all runs available on your plan.",
    code: invalid ? "INVALID_ACTION_KEY" : "RUN_LIMIT_REACHED",
    usage: result.usage || null,
  }), {
    status: invalid ? 400 : 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function unmeteredResponse(req: Request) {
  const headers = getCorsHeaders(req);
  return new Response(JSON.stringify({
    error: "This processing request is not connected to a valid run.",
    code: "INVALID_ACTION_KEY",
  }), { status: 403, headers: { ...headers, "Content-Type": "application/json" } });
}
// Give a counted run back when the AI fails after the run was counted.
export async function refundQuota(userId: string, actionKeyValue: unknown) {
  const actionKey = parseActionKey(actionKeyValue);
  if (!actionKey) return false;
  const { data, error } = await createAdminClient().rpc("refund_run_quota", { _user_id: userId, _action_key: actionKey });
  if (error) { console.error("quota refund failed", { userId, message: error.message }); return false; }
  console.info("quota refund", { userId, refunded: data });
  return data === true;
}
