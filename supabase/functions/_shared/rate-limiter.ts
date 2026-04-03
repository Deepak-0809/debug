import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Rate limits per endpoint (requests per window)
const RATE_LIMITS: Record<string, { maxRequests: number; windowMinutes: number }> = {
  "analyze-problem":     { maxRequests: 20, windowMinutes: 10 },
  "check-syntax":        { maxRequests: 25, windowMinutes: 10 },
  "generate-test-cases": { maxRequests: 30, windowMinutes: 10 },
  "execute-code":        { maxRequests: 40, windowMinutes: 10 },
  "diagnose-bug":        { maxRequests: 20, windowMinutes: 10 },
  "debug-chat":          { maxRequests: 60, windowMinutes: 10 },
  "wrap-class-code":     { maxRequests: 20, windowMinutes: 10 },
};

const DEFAULT_LIMIT = { maxRequests: 30, windowMinutes: 10 };

/**
 * Check if a user is within their rate limit for a given endpoint.
 * Uses service role to bypass RLS on rate_limits table.
 * Returns true if allowed, false if rate-limited.
 */
export async function checkRateLimit(userId: string, endpoint: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const adminClient = createClient(supabaseUrl, serviceKey);
  const limits = RATE_LIMITS[endpoint] || DEFAULT_LIMIT;

  const { data, error } = await adminClient.rpc("check_rate_limit", {
    _user_id: userId,
    _endpoint: endpoint,
    _max_requests: limits.maxRequests,
    _window_minutes: limits.windowMinutes,
  });

  if (error) {
    console.error(`[RateLimit] Error checking rate limit:`, error);
    return true; // Fail open — don't block on DB errors
  }

  return data === true;
}

export function rateLimitResponse(endpoint: string): Response {
  const limits = RATE_LIMITS[endpoint] || DEFAULT_LIMIT;
  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded. Maximum ${limits.maxRequests} requests per ${limits.windowMinutes} minutes for this endpoint.`,
      code: "RATE_LIMITED",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(limits.windowMinutes * 60),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
      },
    }
  );
}
