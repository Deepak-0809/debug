import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, validateAuth, unauthorizedResponse } from "../_shared/auth.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";
import { validateCode, validateLanguage, validationErrorResponse } from "../_shared/validation.ts";

// Syntax checking must be deterministic. AI is useful for diagnosis, but it can
// incorrectly reject valid competitive-programming templates. Judge0 compiles
// both programs here with empty stdin; input-dependent behavior is checked later.
const RAPIDAPI_URL = "https://judge0-ce.p.rapidapi.com";
const FREE_CE_URL = "https://ce.judge0.com";
const RAPIDAPI_KEY = Deno.env.get("JUDGE0_RAPIDAPI_KEY") || "";

let rapidApiFailedAt: number | null = null;
const QUOTA_RESET_MS = 60 * 60 * 1000;

const LANGUAGE_MAP: Record<string, number> = {
  cpp: 54,
  "c++": 54,
  c: 50,
  python: 71,
  py: 71,
  python3: 71,
  java: 62,
  javascript: 63,
  js: 63,
};

type CompilerEndpoint = {
  url: string;
  headers: Record<string, string>;
  label: string;
};

function shouldUseRapidApi(): boolean {
  if (!RAPIDAPI_KEY) return false;
  if (!rapidApiFailedAt) return true;
  if (Date.now() - rapidApiFailedAt > QUOTA_RESET_MS) {
    rapidApiFailedAt = null;
    return true;
  }
  return false;
}

function getEndpoint(): CompilerEndpoint {
  if (shouldUseRapidApi()) {
    return {
      url: RAPIDAPI_URL,
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      },
      label: "RapidAPI",
    };
  }

  return {
    url: FREE_CE_URL,
    headers: { "Content-Type": "application/json" },
    label: "FreeCE",
  };
}

function toBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function fromBase64(value: string): string {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return atob(value);
  }
}

async function submitCompilationBatch(
  endpoint: CompilerEndpoint,
  submissions: { language_id: number; source_code: string }[],
): Promise<{ tokens: string[]; endpoint: CompilerEndpoint }> {
  const encoded = submissions.map((submission) => ({
    language_id: submission.language_id,
    source_code: toBase64(submission.source_code),
    stdin: toBase64(""),
    cpu_time_limit: 5,
    memory_limit: 256000,
  }));

  let response = await fetch(`${endpoint.url}/submissions/batch?base64_encoded=true`, {
    method: "POST",
    headers: endpoint.headers,
    body: JSON.stringify({ submissions: encoded }),
  });

  if (!response.ok && endpoint.label === "RapidAPI" && (response.status === 403 || response.status === 429)) {
    rapidApiFailedAt = Date.now();
    endpoint = getEndpoint();
    response = await fetch(`${endpoint.url}/submissions/batch?base64_encoded=true`, {
      method: "POST",
      headers: endpoint.headers,
      body: JSON.stringify({ submissions: encoded }),
    });
  }

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Compiler submission failed [${response.status}]: ${details}`);
  }

  const data = await response.json();
  return { tokens: (data as { token: string }[]).map((item) => item.token), endpoint };
}

async function pollCompilationResults(endpoint: CompilerEndpoint, tokens: string[]) {
  const pollHeaders = { ...endpoint.headers };
  delete pollHeaders["Content-Type"];

  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const response = await fetch(
      `${endpoint.url}/submissions/batch?tokens=${tokens.join(",")}&base64_encoded=true&fields=token,stderr,status,compile_output`,
      { method: "GET", headers: pollHeaders },
    );

    if (response.status === 429 || response.status >= 500) {
      await response.text();
      continue;
    }
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Compiler poll failed [${response.status}]: ${details}`);
    }

    const data = await response.json();
    const submissions = (data.submissions || data) as Array<Record<string, any>>;
    if (submissions.every((submission) => submission.status?.id >= 3)) {
      return submissions.map((submission) => ({
        status: submission.status,
        stderr: submission.stderr ? fromBase64(submission.stderr) : "",
        compile_output: submission.compile_output ? fromBase64(submission.compile_output) : "",
      }));
    }
  }

  throw new Error("Compiler check timed out");
}

function getCompilerMessage(result: { compile_output?: string; stderr?: string; status?: { description?: string } }): string {
  return result.compile_output?.trim() || result.stderr?.trim() || result.status?.description || "Compilation failed.";
}

serve(async (req) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });

  const auth = await validateAuth(req);
  if (!auth) return unauthorizedResponse(req);

  const allowed = await checkRateLimit(auth.userId, "check-syntax");
  if (!allowed) return rateLimitResponse("check-syntax");

  try {
    const body = await req.json();
    const { buggyCode, correctCode, language } = body;
    const errors = [
      validateCode(buggyCode, "buggyCode"),
      validateCode(correctCode, "correctCode"),
    ].filter(Boolean);
    if (errors.length > 0) return validationErrorResponse(errors as any);

    const safeLanguage = validateLanguage(language);
    const languageId = LANGUAGE_MAP[safeLanguage] || LANGUAGE_MAP.cpp;
    const endpoint = getEndpoint();
    const { tokens, endpoint: submissionEndpoint } = await submitCompilationBatch(endpoint, [
      { language_id: languageId, source_code: buggyCode },
      { language_id: languageId, source_code: correctCode },
    ]);
    const results = await pollCompilationResults(submissionEndpoint, tokens);

    const compilerErrors = results.flatMap((result, index) => {
      if (result.status?.id !== 6) return [];
      const label = index === 0 ? "Buggy code" : "Correct code";
      return [{
        type: "syntax",
        line: null,
        description: `${label}: ${getCompilerMessage(result)}`,
        severity: "critical",
        fix_suggestion: "Use the compiler message to correct the reported syntax or type error.",
      }];
    });

    const result = {
      has_errors: compilerErrors.length > 0,
      error_type: compilerErrors.length > 0 ? "syntax" : "none",
      errors: compilerErrors,
      summary: compilerErrors.length > 0
        ? "The compiler found an error. Input-dependent runtime behavior is checked in the execution step."
        : "Both programs compiled successfully. Input-dependent behavior will be checked with test cases.",
      can_proceed_to_testing: compilerErrors.length === 0,
      compiler_checked: true,
      checked_without_input: true,
    };

    return new Response(JSON.stringify({ result, compiler: submissionEndpoint.label }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("check-syntax error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Compiler check failed",
    }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});