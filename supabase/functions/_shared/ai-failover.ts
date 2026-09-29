// Compatibility entry point — every AI call goes through the plan-aware router.
export { routeAI as callAIWithFailover, aiErrorResponse } from "./ai-router/router.ts";
export type { AIMessage, AIRequestOptions, AIFailoverResult } from "./ai-router/types.ts";
export { AIRouterError } from "./ai-router/types.ts";
