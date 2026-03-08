import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert test case generator for competitive programming problems. Given a JSON schema describing a problem's input structure, constraints, and test case generation strategy, you must generate a comprehensive set of test cases.

You MUST respond with ONLY valid JSON — no markdown, no explanation, no code fences.

The JSON must follow this exact structure:
{
  "test_cases": [
    {
      "category": "string - which category this test case belongs to (e.g., small, edge_case, stress, etc.)",
      "description": "string - brief description of what this test case covers",
      "input": "string - the exact input that would be fed to stdin, with newlines as \\n"
    }
  ],
  "total_count": number,
  "generation_notes": "string - any notes about the generation process"
}

Rules:
- Generate between 10-25 test cases covering ALL categories from the schema's test_case_generation_strategy.
- Each test case's input MUST strictly follow the input_structure format from the schema.
- Respect ALL constraints (min/max values, array lengths, data types).
- Include at minimum: 
  * 2-3 trivial/small cases (n=1, n=2)
  * 2-3 edge cases (all same elements, sorted, reverse sorted, etc.)
  * 2-3 boundary cases (min constraints, max constraints)
  * 3-5 medium random cases
  * 2-3 large stress test cases (near max constraints)
- For multi_test_case format, each test case input should include the "t" (number of test cases) line.
- Ensure inputs are valid — no constraint violations, correct separators, correct number of elements.
- The input string should use actual newline characters (\\n) between lines.
- Make stress test cases with values near the maximum constraints to catch TLE/MLE issues.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { schema, runId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get auth header for DB operations
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });

    const userPrompt = `Generate test cases based on this problem schema:\n\n${JSON.stringify(schema, null, 2)}\n\nGenerate comprehensive test cases now. Make sure each input strictly follows the input_structure format.`;

    if (schema?.ai_generation_prompt_hint) {
      // Use the hint from Branch 1 to guide generation
    }

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
        temperature: 0.5,
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

    // Store test cases in database if runId is provided
    if (runId && parsed.test_cases?.length > 0) {
      const testCaseRows = parsed.test_cases.map((tc: { input: string }) => ({
        run_id: runId,
        input_data: tc.input,
        is_failing: false,
      }));

      const { error: insertError } = await supabase
        .from("test_cases")
        .insert(testCaseRows);

      if (insertError) {
        console.error("Failed to store test cases:", insertError);
        // Continue — return the test cases even if DB insert fails
      }

      // Update run status
      await supabase
        .from("runs")
        .update({ status: "tests_generated" })
        .eq("id", runId);
    }

    return new Response(JSON.stringify({ result: parsed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-test-cases error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
