export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIRequestOptions {
  messages: AIMessage[];
  model?: string; // Lovable model override only
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: string };
  /** Authenticated user id (from the verified JWT). Plan is looked up server-side. */
  userId?: string;
  /** Feature name for usage logs. */
  feature?: string;
}

export interface AIFailoverResult {
  response: Response;
  provider: string;
  model: string;
}

/** Terminal AI error with a status the caller should return as-is. */
export class AIRouterError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}
