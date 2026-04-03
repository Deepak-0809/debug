import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, validateAuth, unauthorizedResponse } from "../_shared/auth.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";
import { validateChatMessages, validationErrorResponse } from "../_shared/validation.ts";
import { callAIWithFailover } from "../_shared/ai-failover.ts";

serve(async (req) => {
  const headers = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const auth = await validateAuth(req);
  if (!auth) return unauthorizedResponse(req);

  const allowed = await checkRateLimit(auth.userId, "debug-chat");
  if (!allowed) return rateLimitResponse("debug-chat");

  try {
    const { messages, runContext } = await req.json();

    // Validate chat messages
    const msgError = validateChatMessages(messages);
    if (msgError) return validationErrorResponse([msgError]);

    let systemPrompt = `You are a sharp competitive programming debugging assistant. You help users understand bugs in their code and suggest fixes.

CRITICAL RESPONSE RULES:
- Keep EVERY response to 1-3 lines MAX. No exceptions.
- Be extremely concise — one short sentence per point.
- Reference specific line numbers directly (e.g. "Line 21: use <= instead of <").
- No long explanations, no paragraphs, no bullet lists longer than 3 items.
- If the user asks for more detail, give slightly more but still stay under 5 lines.`;

    if (runContext) {
      systemPrompt += `\n\n## Current Debugging Context\n`;
      if (runContext.language) systemPrompt += `**Language:** ${runContext.language}\n`;
      if (runContext.buggyCode) systemPrompt += `\n**User's Buggy Code:**\n\`\`\`${runContext.language || "cpp"}\n${String(runContext.buggyCode).substring(0, 50000)}\n\`\`\`\n`;
      if (runContext.correctCode) systemPrompt += `\n**Correct Reference Code:**\n\`\`\`${runContext.language || "cpp"}\n${String(runContext.correctCode).substring(0, 50000)}\n\`\`\`\n`;
      if (runContext.diagnosis) systemPrompt += `\n**AI Diagnosis:**\n${JSON.stringify(runContext.diagnosis, null, 2).substring(0, 10000)}\n`;
      if (runContext.failingInput) systemPrompt += `\n**Failing Input:**\n\`\`\`\n${String(runContext.failingInput).substring(0, 10000)}\n\`\`\`\n`;
      if (runContext.outputBuggy) systemPrompt += `**Buggy Output:** \`${String(runContext.outputBuggy).substring(0, 5000)}\`\n`;
      if (runContext.outputCorrect) systemPrompt += `**Correct Output:** \`${String(runContext.outputCorrect).substring(0, 5000)}\`\n`;
      systemPrompt += `\nUse this context to answer the user's questions. Reference specific lines, variables, and logic from the code above.`;
    }

    const { response, provider, model } = await callAIWithFailover({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      model: "google/gemini-3-flash-preview",
      stream: true,
    });

    const responseHeaders = new Headers({
      ...headers,
      "Content-Type": "text/event-stream",
      "X-AI-Provider": provider,
      "X-AI-Model": model,
    });

    return new Response(response.body, { headers: responseHeaders });
  } catch (e) {
    console.error("debug-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
