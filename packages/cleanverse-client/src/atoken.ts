import { cleanverseCountryCodeSchema } from "@cleangraph/shared";
import { z } from "zod";
import { CleanverseConfigurationError } from "./errors.js";

const evmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM address");
const transactionHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid EVM transaction hash");
const applicationRequestIdSchema = z
  .string()
  .regex(/^(?:IA|IAR|WA|WAR)\d+$/);
const nonBlankTrimmedStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value && value.length > 0);
const httpUrlSchema = z
  .string()
  .url()
  .refine(hasHttpProtocol);
const optionalEvmAddressSchema = z.preprocess(
  emptyValueToUndefined,
  evmAddressSchema.optional(),
);
const optionalTransactionHashSchema = z.preprocess(
  emptyValueToUndefined,
  transactionHashSchema.optional(),
);
const optionalIssuedAtSchema = z.preprocess(
  emptyValueToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    .optional(),
);

const atokenRuleInputSchema = z
  .object({
    allowedGroup: z
      .string()
      .refine((value) => value.length === 0 || value.length === 2),
    allowedSubGroup: z
      .string()
      .refine((value) => value.length === 0 || value.length === 2),
    minTier: z.number().int().min(0).max(99),
    minSubTier: z.number().int().min(0).max(99),
    isBlackList: z.boolean().default(false),
    countries: z
      .array(cleanverseCountryCodeSchema)
      .refine((countries) => new Set(countries).size === countries.length)
      .default([]),
  })
  .strict();

const launchATokenInputSchema = z
  .object({
    chain: z.literal("monad"),
    tokenName: nonBlankTrimmedStringSchema,
    tokenSymbol: nonBlankTrimmedStringSchema,
    decimals: z.number().int().min(0).max(255),
    adminAddress: evmAddressSchema,
    rule: atokenRuleInputSchema,
    icon: httpUrlSchema,
    callbackUrl: httpUrlSchema.max(512).optional(),
  })
  .strict();

const queryATokenApplicationInputSchema = z
  .object({
    applicationRequestId: applicationRequestIdSchema,
  })
  .strict();

const pollATokenApplicationOptionsSchema = z
  .object({
    requestId: z.string().uuid().optional(),
    maxAttempts: z.number().int().min(1).max(100).default(30),
    intervalMs: z.number().int().min(0).max(60_000).default(2_000),
  })
  .strict();

const launchATokenDataSchema = z.object({
  requestId: applicationRequestIdSchema,
  issueAssetId: z.number().int().positive(),
});

const atokenApplicationDataSchema = z.object({
  flowType: z.enum([
    "LAUNCH",
    "LAUNCH_WRAPPED",
    "REGISTER_WRAPPED",
    "REGISTER_ATOKEN",
  ]),
  requestId: applicationRequestIdSchema,
  applyStatus: z.enum([
    "PENDING",
    "APPROVED",
    "ISSUING",
    "ISSUED",
    "REJECTED",
    "ISSUE_FAILED",
  ]),
  rejectReason: z.string().optional(),
  issueErrorMsg: z.string().optional(),
  chain: z.literal("monad"),
  atokenAddress: optionalEvmAddressSchema,
  originTokenAddress: optionalEvmAddressSchema,
  tokenSymbol: nonBlankTrimmedStringSchema,
  txHash: optionalTransactionHashSchema,
  issuedAt: optionalIssuedAtSchema,
  callbackUrl: z.preprocess(
    emptyValueToUndefined,
    httpUrlSchema.max(512).optional(),
  ),
  callbackStatus: z
    .enum(["PENDING", "SUCCESS", "FAILED"])
    .optional(),
  callbackAttempts: z.number().int().nonnegative().optional(),
  callbackLastError: z.string().optional(),
});

export type ATokenRuleInput = z.input<typeof atokenRuleInputSchema>;
export type LaunchATokenInput = z.input<typeof launchATokenInputSchema>;
export type LaunchATokenResult = {
  applicationRequestId: string;
  issueAssetId: number;
};
export type QueryATokenApplicationInput = z.infer<
  typeof queryATokenApplicationInputSchema
>;
export type ATokenApplicationFlow =
  | "LAUNCH"
  | "LAUNCH_WRAPPED"
  | "REGISTER_WRAPPED"
  | "REGISTER_ATOKEN";
export type ATokenApplicationStatus =
  | "PENDING"
  | "APPROVED"
  | "ISSUING"
  | "ISSUED"
  | "REJECTED"
  | "ISSUE_FAILED";
export type ATokenApplicationFailureCode =
  | "APPLICATION_REJECTED"
  | "ISSUANCE_FAILED";
export type ATokenCallbackStatus = "PENDING" | "SUCCESS" | "FAILED";
export type QueryATokenApplicationResult = {
  applicationRequestId: string;
  flowType: ATokenApplicationFlow;
  status: ATokenApplicationStatus;
  terminal: boolean;
  successful: boolean;
  chain: "monad";
  atokenAddress?: string;
  originTokenAddress?: string;
  tokenSymbol: string;
  transactionHash?: string;
  issuedAt?: string;
  failure?: {
    code: ATokenApplicationFailureCode;
    message: string;
    upstreamReasonPresent: boolean;
  };
  callback?: {
    url?: string;
    status?: ATokenCallbackStatus;
    attempts?: number;
    lastErrorPresent: boolean;
  };
};
export type PollATokenApplicationOptions = {
  requestId?: string;
  maxAttempts?: number;
  intervalMs?: number;
};
export type PollATokenApplicationResult = {
  attempts: number;
  responseRequestId: string;
  application: QueryATokenApplicationResult;
};

export type ParsedLaunchATokenInput = z.output<
  typeof launchATokenInputSchema
>;
export type ParsedPollATokenApplicationOptions = z.output<
  typeof pollATokenApplicationOptionsSchema
>;

export function parseLaunchATokenInput(
  input: unknown,
): ParsedLaunchATokenInput {
  return parseInput(launchATokenInputSchema, input);
}

export function parseQueryATokenApplicationInput(
  input: unknown,
): QueryATokenApplicationInput {
  return parseInput(queryATokenApplicationInputSchema, input);
}

export function parsePollATokenApplicationOptions(
  input: unknown,
): ParsedPollATokenApplicationOptions {
  return parseInput(pollATokenApplicationOptionsSchema, input);
}

export function createLaunchATokenResultSchema(): z.ZodType<LaunchATokenResult> {
  return launchATokenDataSchema.transform((data) => ({
    applicationRequestId: data.requestId,
    issueAssetId: data.issueAssetId,
  }));
}

export function createQueryATokenApplicationResultSchema(
  input: QueryATokenApplicationInput,
): z.ZodType<QueryATokenApplicationResult> {
  return atokenApplicationDataSchema
    .superRefine((data, context) => {
      if (data.requestId !== input.applicationRequestId) {
        context.addIssue({
          code: "custom",
          message: "Application request identifier mismatch",
        });
      }

      if (
        data.applyStatus === "ISSUED" &&
        (data.atokenAddress === undefined ||
          data.tokenSymbol === undefined ||
          data.txHash === undefined ||
          data.issuedAt === undefined)
      ) {
        context.addIssue({
          code: "custom",
          message: "Issued application is missing issuance evidence",
        });
      }

      if (
        data.applyStatus === "REJECTED" &&
        !hasNonBlankValue(data.rejectReason)
      ) {
        context.addIssue({
          code: "custom",
          message: "Rejected application is missing a reason",
        });
      }

      if (
        data.applyStatus === "ISSUE_FAILED" &&
        !hasNonBlankValue(data.issueErrorMsg)
      ) {
        context.addIssue({
          code: "custom",
          message: "Failed issuance is missing a reason",
        });
      }
    })
    .transform((data) => normalizeApplicationResult(data));
}

function normalizeApplicationResult(
  data: z.infer<typeof atokenApplicationDataSchema>,
): QueryATokenApplicationResult {
  const terminal = [
    "ISSUED",
    "REJECTED",
    "ISSUE_FAILED",
  ].includes(data.applyStatus);
  const failure =
    data.applyStatus === "REJECTED"
      ? {
          code: "APPLICATION_REJECTED" as const,
          message: "Cleanverse rejected the A-Token application.",
          upstreamReasonPresent: hasNonBlankValue(data.rejectReason),
        }
      : data.applyStatus === "ISSUE_FAILED"
        ? {
            code: "ISSUANCE_FAILED" as const,
            message: "Cleanverse could not issue the A-Token on-chain.",
            upstreamReasonPresent: hasNonBlankValue(data.issueErrorMsg),
          }
        : undefined;
  const hasCallbackData =
    data.callbackUrl !== undefined ||
    data.callbackStatus !== undefined ||
    data.callbackAttempts !== undefined ||
    data.callbackLastError !== undefined;

  return {
    applicationRequestId: data.requestId,
    flowType: data.flowType,
    status: data.applyStatus,
    terminal,
    successful: data.applyStatus === "ISSUED",
    chain: data.chain,
    ...(data.atokenAddress === undefined
      ? {}
      : { atokenAddress: data.atokenAddress }),
    ...(data.originTokenAddress === undefined
      ? {}
      : { originTokenAddress: data.originTokenAddress }),
    tokenSymbol: data.tokenSymbol,
    ...(data.txHash === undefined
      ? {}
      : { transactionHash: data.txHash }),
    ...(data.issuedAt === undefined ? {} : { issuedAt: data.issuedAt }),
    ...(failure === undefined ? {} : { failure }),
    ...(hasCallbackData
      ? {
          callback: {
            ...(data.callbackUrl === undefined
              ? {}
              : { url: data.callbackUrl }),
            ...(data.callbackStatus === undefined
              ? {}
              : { status: data.callbackStatus }),
            ...(data.callbackAttempts === undefined
              ? {}
              : { attempts: data.callbackAttempts }),
            lastErrorPresent: hasNonBlankValue(data.callbackLastError),
          },
        }
      : {}),
  };
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new CleanverseConfigurationError(
      "The Cleanverse endpoint input is invalid.",
    );
  }

  return result.data;
}

function emptyValueToUndefined(value: unknown): unknown {
  return value === "" || value === null ? undefined : value;
}

function hasNonBlankValue(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

function hasHttpProtocol(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
