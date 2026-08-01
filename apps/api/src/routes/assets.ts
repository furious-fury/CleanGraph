import {
  CleanverseBusinessError,
  CleanverseConfigurationError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
} from "@cleangraph/cleanverse-client";
import {
  assetLaunchRequestSchema,
  type AssetApplicationResponse,
  type AssetErrorCode,
  type AssetErrorResponse,
  type AssetLaunchResponse,
} from "@cleangraph/shared";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { createOperatorAuth } from "../middleware/operator-auth.js";
import {
  createFixedWindowRateLimit,
  type FixedWindowRateLimitOptions,
} from "../middleware/rate-limit.js";
import type { AppVariables } from "../middleware/request-context.js";
import type { AssetLifecycleService } from "../services/assets.js";

export type AssetFailureLog = {
  event: "asset_launch_failure" | "asset_status_failure";
  operation: "launch" | "status";
  code: string;
  requestId: string;
  status: number;
};

type AssetRouteOptions = {
  service?: AssetLifecycleService;
  operatorToken?: string;
  launchRateLimit?: FixedWindowRateLimitOptions;
  statusRateLimit?: FixedWindowRateLimitOptions;
  onFailure?: (failure: AssetFailureLog) => void;
};

type AppContext = Context<{ Variables: AppVariables }>;
const applicationRequestIdSchema = z.string().regex(/^IA\d+$/);

export function createAssetRoutes(options: AssetRouteOptions) {
  const routes = new Hono<{ Variables: AppVariables }>();
  const authenticate = createOperatorAuth(options.operatorToken);
  const launchLimit = createFixedWindowRateLimit(
    options.launchRateLimit ?? { limit: 5, windowMs: 60_000 },
  );
  const statusLimit = createFixedWindowRateLimit(
    options.statusRateLimit ?? { limit: 120, windowMs: 60_000 },
  );

  routes.post("/assets/launch", authenticate, launchLimit, async (context) => {
    const requestId = context.get("requestId");
    const payload = await context.req.json().catch(() => undefined);
    const parsed = assetLaunchRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return context.json(
        validationError(
          requestId,
          "The A-Token launch request is invalid.",
          z.flattenError(parsed.error).fieldErrors,
        ),
        422,
      );
    }
    if (!options.service) {
      return failure(
        context,
        "launch",
        "SERVICE_NOT_CONFIGURED",
        "The asset lifecycle service is not configured.",
        503,
        options.onFailure,
      );
    }
    try {
      const application = await options.service.launch(parsed.data, requestId);
      const response: AssetLaunchResponse = { requestId, application };
      return context.json(response, 202);
    } catch (error) {
      return mappedFailure(context, "launch", error, options.onFailure);
    }
  });

  routes.get(
    "/assets/applications/:applicationRequestId",
    authenticate,
    statusLimit,
    async (context) => {
      const requestId = context.get("requestId");
      const parsed = applicationRequestIdSchema.safeParse(
        context.req.param("applicationRequestId"),
      );
      if (!parsed.success) {
        return context.json(
          validationError(
            requestId,
            "The application request identifier is invalid.",
            {
              applicationRequestId: [
                "Must be a standard launch identifier such as IA123.",
              ],
            },
          ),
          422,
        );
      }
      if (!options.service) {
        return failure(
          context,
          "status",
          "SERVICE_NOT_CONFIGURED",
          "The asset lifecycle service is not configured.",
          503,
          options.onFailure,
        );
      }
      try {
        const application = await options.service.getApplication(
          parsed.data,
          requestId,
        );
        const response: AssetApplicationResponse = {
          requestId,
          application: { ...application, flowType: "LAUNCH" },
        };
        return context.json(response, 200);
      } catch (error) {
        return mappedFailure(context, "status", error, options.onFailure);
      }
    },
  );

  return routes;
}

function validationError(
  requestId: string,
  message: string,
  fields: Record<string, string[] | undefined>,
): AssetErrorResponse {
  return {
    requestId,
    error: {
      code: "VALIDATION_ERROR",
      message,
      fields: Object.fromEntries(
        Object.entries(fields).filter(
          (entry): entry is [string, string[]] => entry[1] !== undefined,
        ),
      ),
    },
  };
}

function mappedFailure(
  context: AppContext,
  operation: "launch" | "status",
  error: unknown,
  onFailure?: (failure: AssetFailureLog) => void,
) {
  if (error instanceof CleanverseConfigurationError) {
    return failure(
      context,
      operation,
      "VALIDATION_ERROR",
      "The asset lifecycle request is invalid.",
      422,
      onFailure,
    );
  }
  if (error instanceof CleanverseTimeoutError) {
    return failure(
      context,
      operation,
      "CLEANVERSE_TIMEOUT",
      "The asset lifecycle service timed out.",
      504,
      onFailure,
    );
  }
  if (error instanceof CleanverseBusinessError) {
    return operation === "status" && error.cleanverseCode === "12015"
      ? failure(
          context,
          operation,
          "APPLICATION_NOT_FOUND",
          "The A-Token application was not found.",
          404,
          onFailure,
        )
      : failure(
          context,
          operation,
          "CLEANVERSE_REJECTED",
          "Cleanverse rejected the asset lifecycle request.",
          502,
          onFailure,
        );
  }
  if (
    error instanceof CleanverseNetworkError ||
    error instanceof CleanverseHttpError ||
    error instanceof CleanverseMalformedResponseError
  ) {
    return failure(
      context,
      operation,
      "CLEANVERSE_UNAVAILABLE",
      "The asset lifecycle service is temporarily unavailable.",
      502,
      onFailure,
    );
  }
  return failure(
    context,
    operation,
    "INTERNAL_SERVER_ERROR",
    "An unexpected error occurred.",
    500,
    onFailure,
  );
}

function failure(
  context: AppContext,
  operation: "launch" | "status",
  code: AssetErrorCode,
  message: string,
  status: 404 | 422 | 500 | 502 | 503 | 504,
  onFailure?: (failure: AssetFailureLog) => void,
) {
  const requestId = context.get("requestId");
  const response: AssetErrorResponse = { requestId, error: { code, message } };
  onFailure?.({
    event:
      operation === "launch"
        ? "asset_launch_failure"
        : "asset_status_failure",
    operation,
    code,
    requestId,
    status,
  });
  return context.json(response, status);
}
