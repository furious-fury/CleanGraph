import { createMiddleware } from "hono/factory";

import type { AppVariables } from "./request-context.js";

export type FixedWindowRateLimitOptions = {
  limit: number;
  windowMs: number;
  clock?: () => number;
  message?: string;
};

type RateLimitErrorResponse = {
  requestId: string;
  error: {
    code: "RATE_LIMITED";
    message: string;
    retryAfterSeconds: number;
  };
};

export function createFixedWindowRateLimit(options: FixedWindowRateLimitOptions) {
  const clock = options.clock ?? Date.now;
  let windowStartedAt = clock();
  let count = 0;

  return createMiddleware<{ Variables: AppVariables }>(async (context, next) => {
    const now = clock();
    if (now >= windowStartedAt + options.windowMs) {
      windowStartedAt = now;
      count = 0;
    }

    count += 1;
    if (count > options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStartedAt + options.windowMs - now) / 1_000));
      const response: RateLimitErrorResponse = {
        requestId: context.get("requestId"),
        error: {
          code: "RATE_LIMITED",
          message:
            options.message ?? "Too many operator requests.",
          retryAfterSeconds,
        },
      };
      context.header("Retry-After", String(retryAfterSeconds));
      return context.json(response, 429);
    }

    await next();
  });
}
