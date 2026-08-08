import {
  CleanverseBusinessError,
  CleanverseConfigurationError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
} from "@cleangraph/cleanverse-client";
import {
  transactionEvidenceRequestSchema,
  type EvidenceErrorCode,
  type EvidenceErrorResponse,
} from "@cleangraph/shared";
import { Hono, type Context } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";

import { createOperatorAuth } from "../middleware/operator-auth.js";
import {
  createFixedWindowRateLimit,
  type FixedWindowRateLimitOptions,
} from "../middleware/rate-limit.js";
import type { AppVariables } from "../middleware/request-context.js";
import {
  UnexpectedEvidenceReportError,
  type EvidenceService,
} from "../services/evidence.js";

export type EvidenceFailureLog = {
  event: "evidence_index_failure" | "evidence_report_unavailable";
  operation: "index" | "report";
  code: string;
  requestId: string;
  status: number;
};

type EvidenceRouteOptions = {
  service?: EvidenceService;
  operatorToken?: string;
  rateLimit?: FixedWindowRateLimitOptions;
  onFailure?: (failure: EvidenceFailureLog) => void;
};

type AppContext = Context<{ Variables: AppVariables }>;

export function createEvidenceRoutes(options: EvidenceRouteOptions) {
  const routes = new Hono<{ Variables: AppVariables }>();
  const noStore = createMiddleware(async (context, next) => {
    context.header("Cache-Control", "no-store");
    await next();
  });
  const authenticate = createOperatorAuth(options.operatorToken, {
    notConfiguredMessage: "Transaction evidence authentication is not configured.",
  });
  const rateLimit = createFixedWindowRateLimit({
    limit: 20,
    windowMs: 60_000,
    message: "Too many transaction evidence requests.",
    ...options.rateLimit,
  });

  routes.post(
    "/transactions/evidence",
    noStore,
    authenticate,
    rateLimit,
    async (context) => {
      const requestId = context.get("requestId");
      const payload = await context.req.json().catch(() => undefined);
      const parsed = transactionEvidenceRequestSchema.safeParse(payload);

      if (!parsed.success) {
        const response: EvidenceErrorResponse = {
          requestId,
          error: {
            code: "VALIDATION_ERROR",
            message: "The transaction evidence request is invalid.",
            fields: z.flattenError(parsed.error).fieldErrors,
          },
        };
        return context.json(response, 422);
      }

      if (!options.service) {
        return failure(
          context,
          "index",
          "SERVICE_NOT_CONFIGURED",
          "The transaction evidence service is not configured.",
          503,
          options.onFailure,
        );
      }

      try {
        const result = await options.service.getEvidence(parsed.data, requestId);

        if (result.reportFailureCode !== undefined) {
          options.onFailure?.({
            event: "evidence_report_unavailable",
            operation: "report",
            code: result.reportFailureCode,
            requestId,
            status: 200,
          });
        }

        return context.json(result.response, 200);
      } catch (error) {
        return mappedFailure(context, error, options.onFailure);
      }
    },
  );

  return routes;
}

function mappedFailure(
  context: AppContext,
  error: unknown,
  onFailure?: (failure: EvidenceFailureLog) => void,
) {
  if (error instanceof CleanverseConfigurationError) {
    return failure(
      context,
      "index",
      "VALIDATION_ERROR",
      "The transaction evidence request is invalid.",
      422,
      onFailure,
    );
  }
  if (error instanceof CleanverseTimeoutError) {
    return failure(
      context,
      "index",
      "CLEANVERSE_TIMEOUT",
      "The transaction evidence service timed out.",
      504,
      onFailure,
    );
  }
  if (error instanceof CleanverseBusinessError) {
    return failure(
      context,
      "index",
      "CLEANVERSE_REJECTED",
      "Cleanverse rejected the transaction evidence request.",
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
      "index",
      "CLEANVERSE_UNAVAILABLE",
      "The transaction evidence service is temporarily unavailable.",
      502,
      onFailure,
    );
  }
  if (error instanceof UnexpectedEvidenceReportError) {
    return failure(
      context,
      "report",
      "INTERNAL_SERVER_ERROR",
      "An unexpected error occurred.",
      500,
      onFailure,
    );
  }
  return failure(
    context,
    "index",
    "INTERNAL_SERVER_ERROR",
    "An unexpected error occurred.",
    500,
    onFailure,
  );
}

function failure(
  context: AppContext,
  operation: "index" | "report",
  code: EvidenceErrorCode,
  message: string,
  status: 422 | 500 | 502 | 503 | 504,
  onFailure?: (failure: EvidenceFailureLog) => void,
) {
  const requestId = context.get("requestId");
  const response: EvidenceErrorResponse = {
    requestId,
    error: { code, message },
  };

  onFailure?.({
    event:
      operation === "report"
        ? "evidence_report_unavailable"
        : "evidence_index_failure",
    operation,
    code,
    requestId,
    status,
  });

  return context.json(response, status);
}
