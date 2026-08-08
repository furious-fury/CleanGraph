import { z } from "zod";

import {
  evmAddressSchema,
  validationFieldErrorsSchema,
} from "./preflight.js";

const transactionHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid EVM transaction hash");
const filterValueSchema = z.string().regex(/^[A-Za-z0-9._-]{1,64}$/);
const baseUnitAmountSchema = z.string().regex(/^\d+$/);
const safeDownloadUrlSchema = z
  .string()
  .url()
  .refine(
    (value) =>
      /^https:\/\//i.test(value) &&
      !/^https:\/\/[^/?#]*@/i.test(value) &&
      !value.includes("#"),
    "Download URL must be a safe HTTPS URL",
  );
const safeFileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine(
    (value) =>
      value.trim() === value &&
      value !== "." &&
      value !== ".." &&
      !value.includes("/") &&
      !value.includes("\\") &&
      !Array.from(value).some((character) => {
        const codePoint = character.codePointAt(0);
        return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
      }),
    "Invalid report filename",
  );

export const transactionEvidenceRequestSchema = z
  .object({
    chain: z.literal("monad"),
    transactionHash: transactionHashSchema,
    walletAddress: evmAddressSchema,
  })
  .strict();

export const evidenceTransactionSchema = z
  .object({
    chain: z.literal("monad"),
    symbol: filterValueSchema,
    transactionHash: transactionHashSchema,
    fromAddress: evmAddressSchema,
    fromOrganizationName: z.string().min(1).max(256).optional(),
    toAddress: evmAddressSchema,
    amount: baseUnitAmountSchema,
    feeAmount: baseUnitAmountSchema,
    feePayerIndex: z.number().int().safe().nonnegative(),
    type: filterValueSchema,
    blockNumber: z.number().int().safe().nonnegative(),
    blockTime: z.number().int().safe().nonnegative(),
    status: filterValueSchema,
  })
  .strict();

const pendingEvidenceResponseSchema = z
  .object({
    requestId: z.uuid(),
    index: z
      .object({
        status: z.literal("PENDING"),
        attempts: z.number().int().positive(),
      })
      .strict(),
    report: z.object({ status: z.literal("PENDING") }).strict(),
  })
  .strict();

const evidenceReportSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("AVAILABLE"),
      fileName: safeFileNameSchema,
      downloadUrl: safeDownloadUrlSchema,
    })
    .strict(),
  z.object({ status: z.literal("UNAVAILABLE") }).strict(),
]);

const indexedEvidenceResponseSchema = z
  .object({
    requestId: z.uuid(),
    index: z
      .object({
        status: z.literal("INDEXED"),
        attempts: z.number().int().positive(),
        transaction: evidenceTransactionSchema,
      })
      .strict(),
    report: evidenceReportSchema,
  })
  .strict();

export const transactionEvidenceResponseSchema = z.union([
  pendingEvidenceResponseSchema,
  indexedEvidenceResponseSchema,
]);

export const evidenceErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "CLEANVERSE_REJECTED",
  "CLEANVERSE_UNAVAILABLE",
  "SERVICE_NOT_CONFIGURED",
  "CLEANVERSE_TIMEOUT",
  "INTERNAL_SERVER_ERROR",
]);

export const evidenceErrorResponseSchema = z
  .object({
    requestId: z.uuid(),
    error: z
      .object({
        code: evidenceErrorCodeSchema,
        message: z.string().min(1),
        fields: validationFieldErrorsSchema.optional(),
        retryAfterSeconds: z.number().int().positive().optional(),
      })
      .strict(),
  })
  .strict();

export type TransactionEvidenceRequest = z.infer<
  typeof transactionEvidenceRequestSchema
>;
export type EvidenceTransaction = z.infer<typeof evidenceTransactionSchema>;
export type TransactionEvidenceResponse = z.infer<
  typeof transactionEvidenceResponseSchema
>;
export type EvidenceErrorCode = z.infer<typeof evidenceErrorCodeSchema>;
export type EvidenceErrorResponse = z.infer<
  typeof evidenceErrorResponseSchema
>;
