// Provider adapters. Every adapter returns an OpenAI-compatible Response
// (JSON `choices[0].message.content` or SSE `choices[0].delta.content`) so callers never change.
import type { AIRequestOptions } from "./types.ts";

const JSON_HINT = "\n\nCRITICAL: You MUST respond with ONLY valid JSON. No markdown, no code fences, no explanations outside the JSON.";

function openAiBody(o: AIRequestOptions, model: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    model,
    messages: o.messages,
    ...(o.temperature !== undefined ? { temperature: o.temperature } : { temperature: 0.3 }),
    ...(o.max_tokens ? { max_tokens: o.max_tokens } : {}),
    ...(o.stream ? { stream: true } : {}),
    ...(o.response_format ? { response_format: o.response_format } : {}),
    ...extra,
  });
}

export function callLovable(o: AIRequestOptions, key: string, model: string, signal?: AbortSignal) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: openAiBody(o, o.model || model),
  });
}

export function callOpenAI(o: AIRequestOptions, key: string, model: string, signal?: AbortSignal) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: openAiBody(o, model),
  });
}

export function callGemini(o: AIRequestOptions, key: string, model: string, signal?: AbortSignal) {
  return fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: openAiBody(o, model),
  });
}

export async function callAnthropic(o: AIRequestOptions, key: string, model: string, signal?: AbortSignal) {
  let system = o.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  if (o.response_format?.type === "json_object") system += JSON_HINT;
  const messages = o.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model, system, messages,
      max_tokens: o.max_tokens || 4096,
      temperature: o.temperature ?? 0.3,
      ...(o.stream ? { stream: true } : {}),
    }),
  });
  if (!resp.ok) return resp;

  if (!o.stream) {
    const data = await resp.json();
    const text = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
    return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // Anthropic SSE → OpenAI-compatible SSE
  const reader = resp.body!.getReader();
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const ev = JSON.parse(line.slice(6).trim());
              if (ev.type === "content_block_delta" && ev.delta?.text) {
                controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: ev.delta.text }, index: 0 }] })}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
        controller.enqueue(enc.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (e) { controller.error(e); }
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
