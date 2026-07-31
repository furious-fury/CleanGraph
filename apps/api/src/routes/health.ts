import { Hono } from "hono";

import type { AppVariables } from "../middleware/request-context.js";

type HealthRouteOptions = {
  cleanverseReady: boolean;
};

export function createHealthRoutes(options: HealthRouteOptions) {
  return new Hono<{
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
      const body = {
        status: options.cleanverseReady ? "ready" : "degraded",
        checks: {
          cleanverseCredentials: options.cleanverseReady,
        },
        requestId: context.get("requestId"),
      } as const;

      return options.cleanverseReady
        ? context.json(body, 200)
        : context.json(body, 503);
    });
}
