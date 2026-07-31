import {
  transactionIntentSchema,
  type PreflightDecision,
  type PreflightErrorResponse,
} from "@cleangraph/shared";
import { Hono, type Context } from "hono";
import { z } from "zod";

import type { AppVariables } from "../middleware/request-context.js";
import type {
  PreflightEvaluation,
  PreflightService,
} from "../services/preflight.js";

export type PreflightFailureLog = {
  code: string;
  requestId: string;
  completedChecks: number;
};

type PreflightRouteOptions = {
  service?: PreflightService;
  onFailure?: (failure: PreflightFailureLog) => void;
};

type AppContext = Context<{
  Variables: AppVariables;
}>;

export function createPreflightRoutes(options: PreflightRouteOptions) {
  return new Hono<{
    Variables: AppVariables;
  }>().post("/compliance/preflight", async (context) => {
    const requestId = context.get("requestId");
    const payload = await context.req.json().catch(() => undefined);
    const result = transactionIntentSchema.safeParse(payload);

    if (!result.success) {
      const response = {
        requestId,
        error: {
          code: "VALIDATION_ERROR",
          message: "The transaction intent is invalid.",
          fields: z.flattenError(result.error).fieldErrors,
        },
        checks: [],
      } satisfies PreflightErrorResponse;

      return context.json(response, 422);
    }

    if (!options.service) {
      return failureResponse(
        context,
        {
          kind: "failure",
          error: {
            code: "SERVICE_NOT_CONFIGURED",
            message: "The compliance service is not configured.",
          },
          checks: [],
        },
        options.onFailure,
      );
    }

    let evaluation: PreflightEvaluation;

    try {
      evaluation = await options.service.evaluate(result.data, requestId);
    } catch {
      evaluation = {
        kind: "failure",
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred.",
        },
        checks: [],
      };
    }

    if (evaluation.kind === "failure") {
      return failureResponse(context, evaluation, options.onFailure);
    }

    const decision = {
      ...evaluation.decision,
      requestId,
    } satisfies PreflightDecision;

    return context.json(decision, 200);
  });
}

function failureResponse(
  context: AppContext,
  evaluation: Extract<PreflightEvaluation, { kind: "failure" }>,
  onFailure?: (failure: PreflightFailureLog) => void,
) {
  const requestId = context.get("requestId");
  const response = {
    requestId,
    error: evaluation.error,
    checks: evaluation.checks,
  } satisfies PreflightErrorResponse;

  onFailure?.({
    code: evaluation.error.code,
    requestId,
    completedChecks: evaluation.checks.length,
  });

  switch (evaluation.error.code) {
    case "SERVICE_NOT_CONFIGURED":
      return context.json(response, 503);
    case "CLEANVERSE_TIMEOUT":
      return context.json(response, 504);
    case "CLEANVERSE_UNAVAILABLE":
      return context.json(response, 502);
    default:
      return context.json(response, 500);
  }
}
