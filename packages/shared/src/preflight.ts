import { z } from "zod";

const evmAddressPattern = /^0x[0-9a-fA-F]{40}$/;
const tokenAmountPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

export const evmAddressSchema = z
  .string()
  .regex(evmAddressPattern, "Invalid EVM address");

export const tokenAmountSchema = z
  .string()
  .regex(
    tokenAmountPattern,
    "Amount must be a positive decimal string with at most 18 decimal places",
  )
  .refine(
    (amount) => /[1-9]/.test(amount),
    "Amount must be greater than zero",
  );

export const transactionIntentSchema = z
  .object({
    chain: z.literal("monad"),
    sender: evmAddressSchema,
    recipient: evmAddressSchema,
    atokenAddress: evmAddressSchema,
    amount: tokenAmountSchema,
  })
  .strict();

export const complianceCheckIdSchema = z.enum([
  "sender-eligibility",
  "recipient-eligibility",
  "asset-rules",
]);

export const complianceCheckSourceSchema = z.enum([
  "cleanverse",
  "cleangraph",
]);

export const complianceCheckStatusSchema = z.enum(["approved", "denied"]);

export const complianceCheckSchema = z
  .object({
    id: complianceCheckIdSchema,
    source: complianceCheckSourceSchema,
    status: complianceCheckStatusSchema,
    code: z.string().min(1),
    message: z.string().min(1),
    checkedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const approvedDecisionCodeSchema = z.literal("TRANSFER_APPROVED");

export const deniedDecisionCodeSchema = z.enum([
  "ATOKEN_NOT_FOUND",
  "SENDER_APASS_MISSING",
  "RECIPIENT_APASS_MISSING",
  "SENDER_NOT_ELIGIBLE",
  "RECIPIENT_NOT_ELIGIBLE",
]);

export const preflightDecisionCodeSchema = z.union([
  approvedDecisionCodeSchema,
  deniedDecisionCodeSchema,
]);

const approvedPreflightDecisionSchema = z
  .object({
    requestId: z.string().uuid(),
    approved: z.literal(true),
    decisionCode: approvedDecisionCodeSchema,
    checks: z.array(complianceCheckSchema),
  })
  .strict();

const deniedPreflightDecisionSchema = z
  .object({
    requestId: z.string().uuid(),
    approved: z.literal(false),
    decisionCode: deniedDecisionCodeSchema,
    checks: z.array(complianceCheckSchema),
  })
  .strict();

export const preflightDecisionSchema = z.discriminatedUnion("approved", [
  approvedPreflightDecisionSchema,
  deniedPreflightDecisionSchema,
]);

export const preflightErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "PREFLIGHT_NOT_IMPLEMENTED",
  "SERVICE_NOT_CONFIGURED",
  "CLEANVERSE_UNAVAILABLE",
  "CLEANVERSE_TIMEOUT",
  "INTERNAL_SERVER_ERROR",
]);

export const validationFieldErrorsSchema = z.record(
  z.string(),
  z.array(z.string()),
);

export const preflightErrorSchema = z
  .object({
    code: preflightErrorCodeSchema,
    message: z.string().min(1),
    fields: validationFieldErrorsSchema.optional(),
  })
  .strict();

export const preflightErrorResponseSchema = z
  .object({
    requestId: z.string().uuid(),
    error: preflightErrorSchema,
    checks: z.array(complianceCheckSchema),
  })
  .strict();

export type EvmAddress = z.infer<typeof evmAddressSchema>;
export type TokenAmount = z.infer<typeof tokenAmountSchema>;
export type TransactionIntent = z.infer<typeof transactionIntentSchema>;
export type ComplianceCheckId = z.infer<typeof complianceCheckIdSchema>;
export type ComplianceCheckSource = z.infer<
  typeof complianceCheckSourceSchema
>;
export type ComplianceCheckStatus = z.infer<
  typeof complianceCheckStatusSchema
>;
export type ComplianceCheck = z.infer<typeof complianceCheckSchema>;
export type ApprovedDecisionCode = z.infer<
  typeof approvedDecisionCodeSchema
>;
export type DeniedDecisionCode = z.infer<typeof deniedDecisionCodeSchema>;
export type PreflightDecisionCode = z.infer<
  typeof preflightDecisionCodeSchema
>;
export type PreflightDecision = z.infer<typeof preflightDecisionSchema>;
export type PreflightErrorCode = z.infer<typeof preflightErrorCodeSchema>;
export type ValidationFieldErrors = z.infer<
  typeof validationFieldErrorsSchema
>;
export type PreflightError = z.infer<typeof preflightErrorSchema>;
export type PreflightErrorResponse = z.infer<
  typeof preflightErrorResponseSchema
>;
