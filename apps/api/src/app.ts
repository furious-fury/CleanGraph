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
import type { FixedWindowRateLimitOptions } from "./middleware/rate-limit.js";
import {
  createAssetRoutes,
  type AssetFailureLog,
} from "./routes/assets.js";
import { createHealthRoutes } from "./routes/health.js";
import {
  createPreflightRoutes,
  type PreflightFailureLog,
} from "./routes/preflight.js";
import {
  createAssetLifecycleService,
  type AssetLifecycleService,
} from "./services/assets.js";
import {
  createPreflightService,
  type PreflightService,
} from "./services/preflight.js";

type AppOptions = {
  environment?: Environment;
  preflightService?: PreflightService | null;
  assetLifecycleService?: AssetLifecycleService | null;
  assetOperatorToken?: string;
  launchRateLimit?: FixedWindowRateLimitOptions;
  statusRateLimit?: FixedWindowRateLimitOptions;
  logFailure?: (failure: PreflightFailureLog) => void;
  logAssetFailure?: (failure: AssetFailureLog) => void;
};

export function createApp(options: AppOptions = {}) {
  const environment = options.environment ?? getEnvironment();
  const runtime = resolveRuntime(environment, options);
  const assetOperatorToken =
    options.assetOperatorToken ?? environment.ASSET_OPERATOR_TOKEN;
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
      allowHeaders: ["Authorization", "Content-Type", "X-Request-ID"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      exposeHeaders: ["Retry-After", "X-Request-ID"],
      maxAge: 600,
    }),
  );

  const routes = app
    .route(
      "/",
      createHealthRoutes({
        cleanverseReady: runtime.preflightService !== undefined,
      }),
    )
    .route(
      "/api/v1",
      createPreflightRoutes({
        ...(runtime.preflightService === undefined
          ? {}
          : { service: runtime.preflightService }),
        onFailure: options.logFailure ?? logPreflightFailure,
      }),
    )
    .route(
      "/api/v1",
      createAssetRoutes({
        ...(runtime.assetLifecycleService === undefined
          ? {}
          : { service: runtime.assetLifecycleService }),
        ...(assetOperatorToken === undefined
          ? {}
          : { operatorToken: assetOperatorToken }),
        ...(options.launchRateLimit === undefined
          ? {}
          : { launchRateLimit: options.launchRateLimit }),
        ...(options.statusRateLimit === undefined
          ? {}
          : { statusRateLimit: options.statusRateLimit }),
        onFailure: options.logAssetFailure ?? logAssetFailure,
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

function resolveRuntime(
  environment: Environment,
  options: AppOptions,
): {
  preflightService?: PreflightService;
  assetLifecycleService?: AssetLifecycleService;
} {
  let client: CleanverseClient | undefined;

  if (isCleanverseConfigured(environment)) {
    try {
      const baseUrl = getCleanverseBaseUrl(environment);
      client = new CleanverseClient({
        apiId: environment.CLEANVERSE_API_ID!,
        apiKey: environment.CLEANVERSE_API_KEY!,
        timeoutMs: getCleanverseTimeoutMs(environment),
        ...(baseUrl === undefined ? {} : { baseUrl }),
      });
    } catch (error) {
      if (!(error instanceof CleanverseConfigurationError)) throw error;
    }
  }

  const preflightService = "preflightService" in options
    ? options.preflightService ?? undefined
    : client === undefined
      ? undefined
      : createPreflightService(client);
  const assetLifecycleService = "assetLifecycleService" in options
    ? options.assetLifecycleService ?? undefined
    : client === undefined
      ? undefined
      : createAssetLifecycleService(client);

  return {
    ...(preflightService === undefined ? {} : { preflightService }),
    ...(assetLifecycleService === undefined ? {} : { assetLifecycleService }),
  };
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

function logAssetFailure(failure: AssetFailureLog): void {
  console.error(
    JSON.stringify({
      level: "error",
      event: failure.event,
      operation: failure.operation,
      code: failure.code,
      requestId: failure.requestId,
      status: failure.status,
    }),
  );
}

const app = createApp();

export type AppType = typeof app;
export { app };
