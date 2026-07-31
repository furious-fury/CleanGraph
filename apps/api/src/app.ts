import {
  CleanverseClient,
  CleanverseConfigurationError,
} from "@cleangraph/cleanverse-client";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

import {
  getCleanverseBaseUrl,
  getCleanverseTimeoutMs,
  getEnvironment,
  isCleanverseConfigured,
  type Environment,
} from "./config/env.js";
import {
  requestContext,
  type AppVariables,
} from "./middleware/request-context.js";
import { createHealthRoutes } from "./routes/health.js";
import {
  createPreflightRoutes,
  type PreflightFailureLog,
} from "./routes/preflight.js";
import {
  createPreflightService,
  type PreflightService,
} from "./services/preflight.js";

type AppOptions = {
  environment?: Environment;
  preflightService?: PreflightService | null;
  logFailure?: (failure: PreflightFailureLog) => void;
};

export function createApp(options: AppOptions = {}) {
  const environment = options.environment ?? getEnvironment();
  const runtime = resolvePreflightRuntime(environment, options);
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

  const routes = app
    .route(
      "/",
      createHealthRoutes({
        cleanverseReady: runtime.service !== undefined,
      }),
    )
    .route(
      "/api/v1",
      createPreflightRoutes({
        ...(runtime.service === undefined
          ? {}
          : { service: runtime.service }),
        onFailure: options.logFailure ?? logPreflightFailure,
      }),
    );

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

  app.onError((_error, context) => {
    logPreflightFailure({
      code: "INTERNAL_SERVER_ERROR",
      requestId: context.get("requestId"),
      completedChecks: 0,
    });

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

  return routes;
}

function resolvePreflightRuntime(
  environment: Environment,
  options: AppOptions,
): { service?: PreflightService } {
  if ("preflightService" in options) {
    return options.preflightService
      ? { service: options.preflightService }
      : {};
  }

  if (!isCleanverseConfigured(environment)) {
    return {};
  }

  try {
    const baseUrl = getCleanverseBaseUrl(environment);
    const client = new CleanverseClient({
      apiId: environment.CLEANVERSE_API_ID!,
      apiKey: environment.CLEANVERSE_API_KEY!,
      timeoutMs: getCleanverseTimeoutMs(environment),
      ...(baseUrl === undefined ? {} : { baseUrl }),
    });

    return { service: createPreflightService(client) };
  } catch (error) {
    if (error instanceof CleanverseConfigurationError) {
      return {};
    }

    throw error;
  }
}

function logPreflightFailure(failure: PreflightFailureLog): void {
  console.error(
    JSON.stringify({
      level: "error",
      event: "preflight_failure",
      code: failure.code,
      requestId: failure.requestId,
      completedChecks: failure.completedChecks,
    }),
  );
}

const app = createApp();

export type AppType = typeof app;
export { app };
