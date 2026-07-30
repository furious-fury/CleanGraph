import {
  transactionIntentSchema,
  type PreflightErrorResponse,
} from "@cleangraph/shared";
import { Hono } from "hono";
import { z } from "zod";

import type { AppVariables } from "../middleware/request-context.js";

export const preflightRoutes = new Hono<{
  Variables: AppVariables;
}>().post("/compliance/preflight", async (context) => {
  const payload = await context.req.json().catch(() => undefined);
  const result = transactionIntentSchema.safeParse(payload);

  if (!result.success) {
    const response = {
      requestId: context.get("requestId"),
      error: {
        code: "VALIDATION_ERROR",
        message: "The transaction intent is invalid.",
        fields: z.flattenError(result.error).fieldErrors,
      },
      checks: [],
    } satisfies PreflightErrorResponse;

    return context.json(response, 422);
  }

  const response = {
    requestId: context.get("requestId"),
    error: {
      code: "PREFLIGHT_NOT_IMPLEMENTED",
      message:
        "Cleanverse compliance checks are not connected yet. No transaction was submitted.",
    },
    checks: [],
  } satisfies PreflightErrorResponse;

  return context.json(response, 501);
});
