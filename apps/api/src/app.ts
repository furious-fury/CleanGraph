import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import { getEnvironment } from "./config/env.js";
import {
  requestContext,
  type AppVariables,
} from "./middleware/request-context.js";
import { healthRoutes } from "./routes/health.js";
import { preflightRoutes } from "./routes/preflight.js";

const environment = getEnvironment();

const app = new Hono<{
  Variables: AppVariables;
}>();

app.use("*", requestContext);
app.use("*", secureHeaders());

if (environment.NODE_ENV !== "test") {
  app.use("*", logger());
}

app.use(
  "/api/*",
  cors({
    origin: environment.API_CORS_ORIGIN,
    allowHeaders: ["Content-Type", "X-Request-ID"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["X-Request-ID"],
    maxAge: 600,
  }),
);

const routes = app.route("/", healthRoutes).route("/api/v1", preflightRoutes);

app.notFound((context) =>
  context.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
      requestId: context.get("requestId"),
    },
    404,
  ),
);

app.onError((error, context) => {
  console.error(
    JSON.stringify({
      level: "error",
      name: error.name,
      message: error.message,
      requestId: context.get("requestId"),
    }),
  );

  return context.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
      requestId: context.get("requestId"),
    },
    500,
  );
});

export type AppType = typeof routes;
export { app };
