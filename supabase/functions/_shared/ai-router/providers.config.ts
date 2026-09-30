/**
 * AI provider configuration — edit models / order here, no logic changes needed.
 *
 * FREE users  → Lovable AI only.
 * PAID users  → PAID_PROVIDER_ORDER, skipping any provider whose secret is not set,
 *               with Lovable AI always as the final fallback.
 */
export type ProviderId = "anthropic" | "gemini" | "openai" | "lovable";

export const PROVIDERS: Record<ProviderId, { secret: string; model: string; timeoutMs: number | null }> = {
  anthropic: { secret: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-20250514", timeoutMs: 10_000 },
  gemini: { secret: "GEMINI_API_KEY", model: "gemini-2.5-flash", timeoutMs: 10_000 },
  openai: { secret: "OPENAI_API_KEY", model: "gpt-4o-mini", timeoutMs: 10_000 },
  // Final fallback: no artificial timeout (long generations must not be cut off).
  lovable: { secret: "LOVABLE_API_KEY", model: "google/gemini-2.5-flash", timeoutMs: null },
};

// Anthropic removed: its account rejects every request (HTTP 400, no credit). Re-add once the key has credit.
export const PAID_PROVIDER_ORDER: ProviderId[] = ["gemini", "openai"];
export const FREE_PROVIDER_ORDER: ProviderId[] = [];
export const PAID_PLANS = ["plus", "pro", "paid"];
