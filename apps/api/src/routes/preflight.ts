import { Hono } from "hono";
import { z } from "zod";

import type { AppVariables } from "../middleware/request-context.js";

const evmAddressPattern = /^0x[0-9a-fA-F]{40}$/;
const positiveDecimalPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export const transactionIntentSchema = z.object({
  chain: z.literal("monad"),
  sender: z.string().regex(evmAddressPattern, "Invalid sender address"),
  recipient: z.string().regex(evmAddressPattern, "Invalid recipient address"),
  atokenAddress: z
    .string()
    .regex(evmAddressPattern, "Invalid A-Token address"),
  amount: z
    .string()
    .regex(positiveDecimalPattern, "Amount must be a decimal string")
    .refine((amount) => Number(amount) > 0, "Amount must be greater than zero"),
});

export const preflightRoutes = new Hono<{
  Variables: AppVariables;
}>().post("/compliance/preflight", async (context) => {
  const payload = await context.req.json().catch(() => undefined);
  const result = transactionIntentSchema.safeParse(payload);

  if (!result.success) {
    return context.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The transaction intent is invalid.",
          fields: z.flattenError(result.error).fieldErrors,
        },
        requestId: context.get("requestId"),
      },
      422,
    );
  }

  return context.json(
    {
      approved: false,
      status: "not_implemented",
      error: {
        code: "PREFLIGHT_NOT_IMPLEMENTED",
        message:
          "Cleanverse compliance checks are not connected yet. No transaction was submitted.",
      },
      intent: result.data,
      checks: [],
      requestId: context.get("requestId"),
    },
    501,
  );
});
