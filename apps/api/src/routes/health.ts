import { Hono } from "hono";

import type { AppVariables } from "../middleware/request-context.js";

type HealthRouteOptions = {
  preflightReady: boolean;
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
        status: options.preflightReady ? "ready" : "degraded",
        checks: {
          preflightService: options.preflightReady,
        },
        requestId: context.get("requestId"),
      } as const;

      return options.preflightReady
        ? context.json(body, 200)
        : context.json(body, 503);
    });
}
