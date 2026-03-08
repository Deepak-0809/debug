import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert code reviewer specializing in competitive programming. Your task is to check the given "buggy" code for:

1. **Syntax Errors**: Missing semicolons, brackets, wrong keywords, typos in function names, etc.
2. **Runtime Errors**: Division by zero patterns, array out-of-bounds access, null/undefined dereference, stack overflow from infinite recursion, integer overflow in declarations, uninitialized variables used before assignment, etc.

You must compare the buggy code against the correct/reference code to identify these issues.

You MUST respond with ONLY valid JSON — no markdown, no explanation, no code fences.

The JSON must follow this exact structure:
{
  "has_errors": true/false,
  "error_type": "syntax" | "runtime" | "both" | "none",
  "errors": [
    {
      "type": "syntax" | "runtime",
      "line": number or null,
      "description": "string describing the error",
      "severity": "critical" | "warning",
      "fix_suggestion": "string suggesting the fix"
    }
  ],
  "summary": "string - brief summary of findings",
  "can_proceed_to_testing": true/false
}

Rules:
- If there are NO syntax or runtime errors, set has_errors to false, error_type to "none", errors to empty array, and can_proceed_to_testing to true.
- If errors are found, set can_proceed_to_testing to false.
- Be thorough — check for subtle issues like missing return statements, wrong loop bounds that always crash, type mismatches.
- Only flag DEFINITE errors, not style issues or potential logic bugs (those are for Branch 3).
- Line numbers should reference the buggy code.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { buggyCode, correctCode, language } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let userPrompt = `Check the following ${language || "code"} for syntax and runtime errors:\n\n`;
    userPrompt += `## Buggy Code:\n\`\`\`\n${buggyCode}\n\`\`\`\n\n`;
    userPrompt += `## Correct/Reference Code:\n\`\`\`\n${correctCode}\n\`\`\`\n\n`;
    userPrompt += "Analyze for syntax and runtime errors. Produce the JSON now.";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "No response from AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let jsonContent = content.trim();
    if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid JSON", raw: jsonContent }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ result: parsed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-syntax error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
