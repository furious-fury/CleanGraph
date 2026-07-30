import { z } from "zod";

import { CleanverseConfigurationError } from "./errors.js";

const evmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM address");
const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
const countriesSchema = z.array(countryCodeSchema);
const monadSchema = z.literal("monad");

const queryAPassInputSchema = z
  .object({
    chain: monadSchema,
    address: evmAddressSchema,
  })
  .strict();

const queryATokenRulesInputSchema = z
  .object({
    chain: monadSchema,
    atokenAddress: evmAddressSchema,
  })
  .strict();

const verifyAPassForTokenInputSchema = z
  .object({
    chain: monadSchema,
    atokenAddress: evmAddressSchema,
    address: evmAddressSchema,
  })
  .strict();

const queryAPassDataSchema = z.object({
  cvRecordId: z.string().min(1),
  subTier: z.number().int(),
  tier: z.string().min(1),
  status: z.union([z.literal(1), z.literal(2)]),
  expirationTime: z.number().int().nonnegative(),
  subGroup: z.string(),
  currentKycHash: z.string().min(1),
  group: z.string(),
  countries: countriesSchema,
});

const atokenRuleWireSchema = z.object({
  allowed_group: z.string(),
  allowed_sub_group: z.string(),
  min_tier: z.number().int().min(0).max(99),
  min_sub_tier: z.number().int().min(0).max(99),
  is_black_list: z.boolean(),
  countries: countriesSchema,
});

const queryATokenRulesDataSchema = z.object({
  chain: monadSchema,
  rules: z.array(atokenRuleWireSchema),
  atoken_address: evmAddressSchema,
});

const verifyAPassDataSchema = z.object({
  chain: monadSchema,
  atoken: evmAddressSchema,
  address: evmAddressSchema,
  code: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
  ]),
  message: z.string(),
  magickLink: z.string().url(),
});

export type CleanverseRequestOptions = {
  requestId?: string;
};

export type QueryAPassInput = z.infer<typeof queryAPassInputSchema>;
export type QueryATokenRulesInput = z.infer<
  typeof queryATokenRulesInputSchema
>;
export type VerifyAPassForTokenInput = z.infer<
  typeof verifyAPassForTokenInputSchema
>;

export type APassStatus = "ACTIVE" | "FROZEN";

export type QueryAPassResult = {
  cvRecordId: string;
  tier: string;
  subTier: number;
  statusCode: 1 | 2;
  status: APassStatus;
  expirationTime: number;
  group: string;
  subGroup: string;
  currentKycHash: string;
  countries: string[];
};

export type ATokenRule = {
  allowedGroup: string;
  allowedSubGroup: string;
  minTier: number;
  minSubTier: number;
  isBlackList: boolean;
  countries: string[];
};

export type QueryATokenRulesResult = {
  chain: "monad";
  atokenAddress: string;
  rules: ATokenRule[];
};

export type APassVerificationCode = 1 | 2 | 3 | 4;

export type APassVerificationOutcome =
  | "ATOKEN_NOT_FOUND"
  | "APASS_MISSING"
  | "APASS_NOT_ELIGIBLE"
  | "ELIGIBLE";

export type VerifyAPassForTokenResult = {
  chain: "monad";
  atokenAddress: string;
  address: string;
  verificationCode: APassVerificationCode;
  outcome: APassVerificationOutcome;
  message: string;
  registrationUrl: string;
};

export function parseQueryAPassInput(input: unknown): QueryAPassInput {
  return parseInput(queryAPassInputSchema, input);
}

export function parseQueryATokenRulesInput(
  input: unknown,
): QueryATokenRulesInput {
  return parseInput(queryATokenRulesInputSchema, input);
}

export function parseVerifyAPassForTokenInput(
  input: unknown,
): VerifyAPassForTokenInput {
  return parseInput(verifyAPassForTokenInputSchema, input);
}

export function createQueryAPassResultSchema(
  _input: QueryAPassInput,
): z.ZodType<QueryAPassResult> {
  return queryAPassDataSchema.transform((data) => ({
    cvRecordId: data.cvRecordId,
    tier: data.tier,
    subTier: data.subTier,
    statusCode: data.status,
    status: data.status === 1 ? "ACTIVE" : "FROZEN",
    expirationTime: data.expirationTime,
    group: data.group,
    subGroup: data.subGroup,
    currentKycHash: data.currentKycHash,
    countries: data.countries,
  }));
}

export function createQueryATokenRulesResultSchema(
  input: QueryATokenRulesInput,
): z.ZodType<QueryATokenRulesResult> {
  return queryATokenRulesDataSchema
    .refine(
      (data) =>
        data.atoken_address.toLowerCase() ===
        input.atokenAddress.toLowerCase(),
    )
    .transform((data) => ({
      chain: data.chain,
      atokenAddress: input.atokenAddress,
      rules: data.rules.map((rule) => ({
        allowedGroup: rule.allowed_group,
        allowedSubGroup: rule.allowed_sub_group,
        minTier: rule.min_tier,
        minSubTier: rule.min_sub_tier,
        isBlackList: rule.is_black_list,
        countries: rule.countries,
      })),
    }));
}

export function createVerifyAPassForTokenResultSchema(
  input: VerifyAPassForTokenInput,
): z.ZodType<VerifyAPassForTokenResult> {
  return verifyAPassDataSchema
    .refine(
      (data) =>
        data.atoken.toLowerCase() === input.atokenAddress.toLowerCase() &&
        data.address.toLowerCase() === input.address.toLowerCase(),
    )
    .transform((data) => ({
      chain: data.chain,
      atokenAddress: input.atokenAddress,
      address: input.address,
      verificationCode: data.code,
      outcome: verificationOutcomeByCode[data.code],
      message: data.message,
      registrationUrl: data.magickLink,
    }));
}

const verificationOutcomeByCode: Record<
  APassVerificationCode,
  APassVerificationOutcome
> = {
  1: "ATOKEN_NOT_FOUND",
  2: "APASS_MISSING",
  3: "APASS_NOT_ELIGIBLE",
  4: "ELIGIBLE",
};

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new CleanverseConfigurationError(
      "The Cleanverse endpoint input is invalid.",
    );
  }

  return result.data;
}
