import { Hono } from "hono";

import {
  getEnvironment,
  isCleanverseConfigured,
} from "../config/env.js";
import type { AppVariables } from "../middleware/request-context.js";

export const healthRoutes = new Hono<{
  Variables: AppVariables;
}>()
  .get("/health", (context) =>
    context.json({
      status: "ok",
      service: "cleangraph-api",
      requestId: context.get("requestId"),
    }),
  )
  .get("/ready", (context) => {
    const cleanverseConfigured = isCleanverseConfigured(getEnvironment());
    const body = {
      status: cleanverseConfigured ? "ready" : "degraded",
      checks: {
        cleanverseCredentials: cleanverseConfigured,
      },
      requestId: context.get("requestId"),
    } as const;

    return cleanverseConfigured
      ? context.json(body, 200)
      : context.json(body, 503);
  });
