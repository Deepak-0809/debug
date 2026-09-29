import { createAdminClient } from "../admin.ts";
import { callAnthropic, callGemini, callLovable, callOpenAI } from "./adapters.ts";
import { FREE_PROVIDER_ORDER, PAID_PLANS, PAID_PROVIDER_ORDER, PROVIDERS, type ProviderId } from "./providers.config.ts";
import { AIRouterError, type AIFailoverResult, type AIRequestOptions } from "./types.ts";

const ADAPTERS: Record<ProviderId, typeof callLovable> = {
  anthropic: callAnthropic, gemini: callGemini, openai: callOpenAI, lovable: callLovable,
};

async function loadPlan(userId?: string): Promise<string> {
  if (!userId) return "free";
  try {
    const { data } = await createAdminClient().from("subscriptions").select("plan").eq("user_id", userId).maybeSingle();
    return (data?.plan as string) || "free";
  } catch {
    return "free";
  }
}

async function logUsage(row: Record<string, unknown>) {
  try {
    await createAdminClient().from("ai_usage_log").insert(row);
  } catch (e) {
    console.warn("[ai-router] usage log failed:", e instanceof Error ? e.message : "unknown");
  }
}

export async function routeAI(options: AIRequestOptions): Promise<AIFailoverResult> {
  const plan = await loadPlan(options.userId);
  const isPaid = PAID_PLANS.includes(plan);
  const order: ProviderId[] = [...(isPaid ? PAID_PROVIDER_ORDER : FREE_PROVIDER_ORDER), "lovable"];
  const chain = order.filter((id) => !!Deno.env.get(PROVIDERS[id].secret));
  console.log(`[ai-router] plan=${plan} feature=${options.feature ?? "-"} chain=${chain.join(" → ") || "(none)"}`);

  let failovers = 0;
  let lastCode = "no_provider";
  const base = { user_id: options.userId ?? null, plan, feature: options.feature ?? null };

  for (const id of chain) {
    const cfg = PROVIDERS[id];
    const model = id === "lovable" ? (options.model || cfg.model) : cfg.model;
    const ctrl = new AbortController();
    const timer = cfg.timeoutMs ? setTimeout(() => ctrl.abort(), cfg.timeoutMs) : null;
    try {
      const resp = await ADAPTERS[id](options, Deno.env.get(cfg.secret)!, model, ctrl.signal);
      if (timer) clearTimeout(timer);

      if (resp.ok) {
        console.log(`[ai-router] ✓ ${id} (${model})`);
        logUsage({ ...base, provider_used: id, model, success: true, failover_count: failovers });
        return { response: resp, provider: id, model };
      }

      const status = resp.status;
      await resp.text().catch(() => "");
      lastCode = `http_${status}`;

      if (id === "lovable") {
        logUsage({ ...base, provider_used: id, model, success: false, failover_count: failovers, error_code: lastCode });
        if (status === 429) throw new AIRouterError("AI is busy, try again shortly", 429, "rate_limited");
        if (status === 402) throw new AIRouterError("AI credits exhausted", 402, "credits_exhausted");
        if (status === 400) throw new AIRouterError("Invalid AI request", 400, "bad_request");
        throw new AIRouterError("AI service is temporarily unavailable", 502, lastCode);
      }
      if (status === 400) {
        // Invalid request — failing over won't help.
        logUsage({ ...base, provider_used: id, model, success: false, failover_count: failovers, error_code: lastCode });
        throw new AIRouterError("Invalid AI request", 400, "bad_request");
      }
      console.warn(`[ai-router] ✗ ${id} returned ${status}, failing over`);
    } catch (e) {
      if (timer) clearTimeout(timer);
      if (e instanceof AIRouterError) throw e;
      lastCode = ctrl.signal.aborted ? "timeout" : "network_error";
      console.warn(`[ai-router] ✗ ${id} ${lastCode}, failing over`);
      if (id === "lovable") {
        logUsage({ ...base, provider_used: id, model, success: false, failover_count: failovers, error_code: lastCode });
        throw new AIRouterError("AI service is temporarily unavailable", 502, lastCode);
      }
    }
    failovers++;
  }

  logUsage({ ...base, provider_used: null, model: null, success: false, failover_count: failovers, error_code: lastCode });
  throw new AIRouterError("AI service is not configured", 500, lastCode);
}

/** Standard JSON error response for AI router failures. */
export function aiErrorResponse(e: unknown, headers: Record<string, string>): Response | null {
  if (!(e instanceof AIRouterError)) return null;
  return new Response(JSON.stringify({ error: e.message, code: e.code }), {
    status: e.status, headers: { ...headers, "Content-Type": "application/json" },
  });
}
