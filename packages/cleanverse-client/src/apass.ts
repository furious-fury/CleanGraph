import { z } from "zod";

import { cleanverseCountryCodeSchema } from "@cleangraph/shared";
import { CleanverseConfigurationError } from "./errors.js";

const evmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM address");
const transactionHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid EVM transaction hash");
const nonBlankStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
const documentDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealCalendarDate)
  .refine((value) => value >= currentUtcDate());

const identityDocumentSchema = z
  .object({
    idType: z.enum([
      "ID_CARD",
      "PASSPORT",
      "DRIVER_LICENSE",
      "HK_MACAO_TAIWAN_PASS",
      "RESIDENCE_PERMIT",
    ]),
    fullName: nonBlankStringSchema,
    idNumber: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
    validUntil: documentDateSchema.optional(),
    issuingCountryISO2: cleanverseCountryCodeSchema,
  })
  .strict();

const walletInputSchema = z
  .object({
    chain: z.literal("monad"),
    address: evmAddressSchema,
  })
  .strict();

const generateAPassInputSchema = z
  .object({
    customerId: z.string().regex(/^[A-Za-z0-9]{12,}$/),
    kycSource: nonBlankStringSchema.optional(),
    kycId: nonBlankStringSchema.optional(),
    subTier: z.number().int().min(1).max(99).optional(),
    subGroup: z.string().regex(/^[A-Za-z]{2}$/).optional(),
    override: z.boolean().default(false),
    expirationTime: z
      .number()
      .int()
      .safe()
      .positive()
      .refine((value) => value > currentUnixSeconds()),
    wallet: walletInputSchema,
    identityDataList: z.tuple(
      [identityDocumentSchema],
      identityDocumentSchema,
    ),
  })
  .strict();

const optionalEvmAddressSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  evmAddressSchema.optional(),
);

const generateAPassDataSchema = z.object({
  customerId: z.string().regex(/^[A-Za-z0-9]{12,}$/),
  cvRecordId: z.string().min(1),
  tier: z.string().regex(/^\d+$/),
  wallet: z.object({
    operate: nonBlankStringSchema,
    address: evmAddressSchema,
    chain: z.literal("monad"),
    txHash: transactionHashSchema,
    depositUSDCWallet: optionalEvmAddressSchema,
    depositUSDTWallet: optionalEvmAddressSchema,
  }),
});

export type APassIdentityDocument = z.infer<
  typeof identityDocumentSchema
>;
export type GenerateAPassWallet = z.infer<typeof walletInputSchema>;
export type GenerateAPassInput = z.input<
  typeof generateAPassInputSchema
>;
export type GenerateAPassResult = {
  customerId: string;
  cvRecordId: string;
  tier: string;
  wallet: {
    operation: string;
    address: string;
    chain: "monad";
    transactionHash: string;
    depositUsdcWallet?: string;
    depositUsdtWallet?: string;
  };
};

export type ParsedGenerateAPassInput = z.output<
  typeof generateAPassInputSchema
>;

export function parseGenerateAPassInput(
  input: unknown,
): ParsedGenerateAPassInput {
  const result = generateAPassInputSchema.safeParse(input);

  if (!result.success) {
    throw new CleanverseConfigurationError(
      "The Cleanverse endpoint input is invalid.",
    );
  }

  return result.data;
}

export function createGenerateAPassResultSchema(
  input: ParsedGenerateAPassInput,
): z.ZodType<GenerateAPassResult> {
  return generateAPassDataSchema
    .refine(
      (data) =>
        data.customerId === input.customerId &&
        data.wallet.address.toLowerCase() ===
          input.wallet.address.toLowerCase(),
    )
    .transform((data) => ({
      customerId: data.customerId,
      cvRecordId: data.cvRecordId,
      tier: data.tier,
      wallet: {
        operation: data.wallet.operate,
        address: input.wallet.address,
        chain: data.wallet.chain,
        transactionHash: data.wallet.txHash,
        ...(data.wallet.depositUSDCWallet === undefined
          ? {}
          : { depositUsdcWallet: data.wallet.depositUSDCWallet }),
        ...(data.wallet.depositUSDTWallet === undefined
          ? {}
          : { depositUsdtWallet: data.wallet.depositUSDTWallet }),
      },
    }));
}

function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1_000);
}

function currentUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
