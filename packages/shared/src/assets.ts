import { z } from "zod";

import { cleanverseCountryCodeSchema } from "./countries.js";
import { evmAddressSchema, validationFieldErrorsSchema } from "./preflight.js";

const applicationRequestIdSchema = z.string().regex(/^IA\d+$/);
const transactionHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const nonBlankTrimmedStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value);
const httpUrlSchema = z
  .string()
  .url()
  .regex(/^https?:\/\//i, "URL must use HTTP or HTTPS");

export const assetRuleSchema = z
  .object({
    allowedGroup: z
      .string()
      .refine((value) => value === "" || value.length === 2),
    allowedSubGroup: z
      .string()
      .refine((value) => value === "" || value.length === 2),
    minTier: z.number().int().min(0).max(99),
    minSubTier: z.number().int().min(0).max(99),
    isBlackList: z.boolean().default(false),
    countries: z
      .array(cleanverseCountryCodeSchema)
      .refine(
        (values) => new Set(values).size === values.length,
        "Countries must be unique",
      )
      .default([]),
  })
  .strict();

export const assetLaunchRequestSchema = z
  .object({
    chain: z.literal("monad"),
    tokenName: nonBlankTrimmedStringSchema,
    tokenSymbol: nonBlankTrimmedStringSchema,
    decimals: z.number().int().min(0).max(255),
    adminAddress: evmAddressSchema,
    rule: assetRuleSchema,
    icon: httpUrlSchema,
    callbackUrl: httpUrlSchema.max(512).optional(),
  })
  .strict();

export const assetLaunchResponseSchema = z
  .object({
    requestId: z.uuid(),
    application: z
      .object({
        applicationRequestId: applicationRequestIdSchema,
        issueAssetId: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

export const assetApplicationStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "ISSUING",
  "ISSUED",
  "REJECTED",
  "ISSUE_FAILED",
]);

export const assetApplicationSchema = z
  .object({
    applicationRequestId: applicationRequestIdSchema,
    flowType: z.literal("LAUNCH"),
    status: assetApplicationStatusSchema,
    terminal: z.boolean(),
    successful: z.boolean(),
    chain: z.literal("monad"),
    atokenAddress: evmAddressSchema.optional(),
    originTokenAddress: evmAddressSchema.optional(),
    tokenSymbol: nonBlankTrimmedStringSchema,
    transactionHash: transactionHashSchema.optional(),
    issuedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      .optional(),
    failure: z
      .object({
        code: z.enum(["APPLICATION_REJECTED", "ISSUANCE_FAILED"]),
        message: z.string().min(1),
        upstreamReasonPresent: z.boolean(),
      })
      .strict()
      .optional(),
    callback: z
      .object({
        url: httpUrlSchema.max(512).optional(),
        status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
        attempts: z.number().int().nonnegative().optional(),
        lastErrorPresent: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((application, context) => {
    const terminal = ["ISSUED", "REJECTED", "ISSUE_FAILED"].includes(
      application.status,
    );
    if (application.terminal !== terminal) {
      context.addIssue({
        code: "custom",
        message: "Terminal flag does not match status",
      });
    }
    if (application.successful !== (application.status === "ISSUED")) {
      context.addIssue({
        code: "custom",
        message: "Successful flag does not match status",
      });
    }
    if (
      application.status === "ISSUED" &&
      (!application.atokenAddress ||
        !application.transactionHash ||
        !application.issuedAt)
    ) {
      context.addIssue({
        code: "custom",
        message: "Issued application requires issuance evidence",
      });
    }
    const expectedFailure = application.status === "REJECTED"
      ? "APPLICATION_REJECTED"
      : application.status === "ISSUE_FAILED"
        ? "ISSUANCE_FAILED"
        : undefined;
    if (
      expectedFailure === undefined
        ? application.failure !== undefined
        : application.failure?.code !== expectedFailure
    ) {
      context.addIssue({
        code: "custom",
        message: "Failure evidence does not match status",
      });
    }
  });

export const assetApplicationResponseSchema = z
  .object({ requestId: z.uuid(), application: assetApplicationSchema })
  .strict();

export const assetErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "APPLICATION_NOT_FOUND",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "CLEANVERSE_REJECTED",
  "CLEANVERSE_UNAVAILABLE",
  "SERVICE_NOT_CONFIGURED",
  "CLEANVERSE_TIMEOUT",
  "INTERNAL_SERVER_ERROR",
]);

export const assetErrorResponseSchema = z
  .object({
    requestId: z.uuid(),
    error: z
      .object({
        code: assetErrorCodeSchema,
        message: z.string().min(1),
        fields: validationFieldErrorsSchema.optional(),
        retryAfterSeconds: z.number().int().positive().optional(),
      })
      .strict(),
  })
  .strict();

export type AssetRule = z.infer<typeof assetRuleSchema>;
export type AssetLaunchRequest = z.infer<typeof assetLaunchRequestSchema>;
export type AssetLaunchResponse = z.infer<typeof assetLaunchResponseSchema>;
export type AssetApplicationStatus = z.infer<
  typeof assetApplicationStatusSchema
>;
export type AssetApplication = z.infer<typeof assetApplicationSchema>;
export type AssetApplicationResponse = z.infer<
  typeof assetApplicationResponseSchema
>;
export type AssetErrorCode = z.infer<typeof assetErrorCodeSchema>;
export type AssetErrorResponse = z.infer<typeof assetErrorResponseSchema>;
