/**
 * Input validation utilities for edge functions.
 * Prevents oversized payloads and malformed input.
 */

const MAX_CODE_LENGTH = 50_000;   // 50KB per code field
const MAX_MESSAGE_LENGTH = 10_000; // 10KB per chat message
const MAX_ADDITIONAL_INFO = 5_000; // 5KB for additional info
const MAX_TEST_CASES = 100;        // Max test cases per request
const MAX_TEST_INPUT = 50_000;     // 50KB per test input

export interface ValidationError {
  field: string;
  message: string;
}

export function validateCode(code: unknown, fieldName: string): ValidationError | null {
  if (typeof code !== "string") {
    return { field: fieldName, message: `${fieldName} must be a string` };
  }
  if (code.length > MAX_CODE_LENGTH) {
    return { field: fieldName, message: `${fieldName} exceeds maximum length of ${MAX_CODE_LENGTH} characters` };
  }
  return null;
}

export function validateLanguage(language: unknown): string {
  const allowed = ["cpp", "c++", "c", "python", "py", "python3", "java", "javascript", "js"];
  if (typeof language !== "string" || !allowed.includes(language.toLowerCase())) {
    return "cpp"; // Default safe value
  }
  return language.toLowerCase();
}

export function validateTestCases(testCases: unknown): ValidationError | null {
  if (!Array.isArray(testCases)) {
    return { field: "testCases", message: "testCases must be an array" };
  }
  if (testCases.length > MAX_TEST_CASES) {
    return { field: "testCases", message: `Maximum ${MAX_TEST_CASES} test cases allowed per request` };
  }
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    if (typeof tc?.input !== "string") {
      return { field: `testCases[${i}].input`, message: "Each test case must have a string input" };
    }
    if (tc.input.length > MAX_TEST_INPUT) {
      return { field: `testCases[${i}].input`, message: `Test case input exceeds ${MAX_TEST_INPUT} characters` };
    }
  }
  return null;
}

export function validateChatMessages(messages: unknown): ValidationError | null {
  if (!Array.isArray(messages)) {
    return { field: "messages", message: "messages must be an array" };
  }
  if (messages.length > 50) {
    return { field: "messages", message: "Maximum 50 messages per request" };
  }
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg.role !== "string" || typeof msg.content !== "string") {
      return { field: `messages[${i}]`, message: "Each message must have role and content strings" };
    }
    if (!["user", "assistant", "system"].includes(msg.role)) {
      return { field: `messages[${i}].role`, message: "Role must be user, assistant, or system" };
    }
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return { field: `messages[${i}].content`, message: `Message content exceeds ${MAX_MESSAGE_LENGTH} characters` };
    }
  }
  return null;
}

export function validateAdditionalInfo(info: unknown): string {
  if (typeof info !== "string") return "";
  return info.substring(0, MAX_ADDITIONAL_INFO);
}

export function validationErrorResponse(errors: ValidationError[]): Response {
  return new Response(
    JSON.stringify({ error: "Validation failed", details: errors }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
      },
    }
  );
}
