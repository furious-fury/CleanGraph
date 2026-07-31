import { z } from "zod";

import { CleanverseConfigurationError } from "./errors.js";

const evmAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid EVM address");
const transactionHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Invalid EVM transaction hash");
const filterValueSchema = z
  .string()
  .regex(/^[A-Za-z0-9._-]{1,64}$/);
const baseUnitAmountSchema = z.string().regex(/^\d+$/);
const unixSecondsSchema = z.number().int().safe().positive();
const pageSchema = z.number().int().safe().positive().default(1);
const pageSizeSchema = z
  .number()
  .int()
  .safe()
  .min(1)
  .max(100)
  .default(10);
const nonBlankTrimmedStringSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => value.trim() === value);

const queryTransactionsInputSchema = z
  .object({
    chain: z.literal("monad"),
    address: evmAddressSchema,
    symbol: filterValueSchema.optional(),
    startTime: unixSecondsSchema.optional(),
    endTime: unixSecondsSchema.optional(),
    transactionHash: transactionHashSchema.optional(),
    type: filterValueSchema.optional(),
    page: pageSchema,
    pageSize: pageSizeSchema,
  })
  .strict()
  .refine(
    (input) =>
      input.startTime === undefined ||
      input.endTime === undefined ||
      input.startTime <= input.endTime,
  );

const reportWalletSchema = z
  .object({
    chain: z.literal("monad"),
    address: evmAddressSchema,
  })
  .strict();

const downloadTravelRuleReportInputSchema = z
  .object({
    customerId: z.string().regex(/^[A-Za-z0-9]{12,}$/).optional(),
    cvRecordId: nonBlankTrimmedStringSchema.optional(),
    transactionHash: transactionHashSchema,
    wallet: reportWalletSchema,
  })
  .strict();

const transactionWireSchema = z.object({
  chain: z.literal("monad"),
  symbol: filterValueSchema,
  tx_hash: transactionHashSchema,
  from_address: evmAddressSchema,
  from_org_name: z.string().max(256),
  to_address: evmAddressSchema,
  amount: baseUnitAmountSchema,
  fee_amount: baseUnitAmountSchema,
  pay_fee_index: z.number().int().safe().nonnegative(),
  type: filterValueSchema,
  block_number: z.number().int().safe().nonnegative(),
  block_time: z.number().int().safe().nonnegative(),
  status: filterValueSchema,
});

const queryTransactionsDataSchema = z.object({
  total_count: z.number().int().safe().nonnegative(),
  txs: z.array(transactionWireSchema),
});

const downloadTravelRuleReportDataSchema = z.object({
  downloadUrl: z
    .string()
    .url()
    .refine(isSafeDownloadUrl),
  fileName: z
    .string()
    .min(1)
    .max(255)
    .refine(isSafeFileName),
});

export type QueryTransactionsInput = z.input<
  typeof queryTransactionsInputSchema
>;
export type ParsedQueryTransactionsInput = z.output<
  typeof queryTransactionsInputSchema
>;
export type CleanverseTransaction = {
  chain: "monad";
  symbol: string;
  transactionHash: string;
  fromAddress: string;
  fromOrganizationName?: string;
  toAddress: string;
  amount: string;
  feeAmount: string;
  feePayerIndex: number;
  type: string;
  blockNumber: number;
  blockTime: number;
  status: string;
};
export type QueryTransactionsResult = {
  totalCount: number;
  page: number;
  pageSize: number;
  transactions: CleanverseTransaction[];
};
export type DownloadTravelRuleReportWallet = z.infer<
  typeof reportWalletSchema
>;
export type DownloadTravelRuleReportInput = z.infer<
  typeof downloadTravelRuleReportInputSchema
>;
export type DownloadTravelRuleReportResult = {
  downloadUrl: string;
  fileName: string;
};

export function parseQueryTransactionsInput(
  input: unknown,
): ParsedQueryTransactionsInput {
  return parseInput(queryTransactionsInputSchema, input);
}

export function parseDownloadTravelRuleReportInput(
  input: unknown,
): DownloadTravelRuleReportInput {
  return parseInput(downloadTravelRuleReportInputSchema, input);
}

export function createQueryTransactionsResultSchema(
  input: ParsedQueryTransactionsInput,
): z.ZodType<QueryTransactionsResult> {
  return queryTransactionsDataSchema
    .superRefine((data, context) => {
      if (data.total_count < data.txs.length) {
        context.addIssue({
          code: "custom",
          message: "Transaction total is smaller than the returned page",
        });
      }

      data.txs.forEach((transaction, index) => {
        const transactionPath = ["txs", index];

        if (!involvesAddress(transaction, input.address)) {
          context.addIssue({
            code: "custom",
            path: transactionPath,
            message: "Transaction does not involve the queried wallet",
          });
        }

        if (
          input.transactionHash !== undefined &&
          !equalHex(transaction.tx_hash, input.transactionHash)
        ) {
          context.addIssue({
            code: "custom",
            path: transactionPath,
            message: "Transaction hash contradicts the query",
          });
        }

        if (
          input.symbol !== undefined &&
          !equalText(transaction.symbol, input.symbol)
        ) {
          context.addIssue({
            code: "custom",
            path: transactionPath,
            message: "Transaction symbol contradicts the query",
          });
        }

        if (
          input.type !== undefined &&
          !equalText(transaction.type, input.type)
        ) {
          context.addIssue({
            code: "custom",
            path: transactionPath,
            message: "Transaction type contradicts the query",
          });
        }

        if (
          input.startTime !== undefined &&
          transaction.block_time < input.startTime
        ) {
          context.addIssue({
            code: "custom",
            path: transactionPath,
            message: "Transaction predates the query range",
          });
        }

        if (
          input.endTime !== undefined &&
          transaction.block_time > input.endTime
        ) {
          context.addIssue({
            code: "custom",
            path: transactionPath,
            message: "Transaction exceeds the query range",
          });
        }
      });
    })
    .transform((data) => ({
      totalCount: data.total_count,
      page: input.page,
      pageSize: input.pageSize,
      transactions: data.txs.map((transaction) => ({
        chain: transaction.chain,
        symbol: transaction.symbol,
        transactionHash:
          input.transactionHash !== undefined &&
          equalHex(transaction.tx_hash, input.transactionHash)
            ? input.transactionHash
            : transaction.tx_hash,
        fromAddress: equalHex(transaction.from_address, input.address)
          ? input.address
          : transaction.from_address,
        ...(transaction.from_org_name.length === 0
          ? {}
          : { fromOrganizationName: transaction.from_org_name }),
        toAddress: equalHex(transaction.to_address, input.address)
          ? input.address
          : transaction.to_address,
        amount: transaction.amount,
        feeAmount: transaction.fee_amount,
        feePayerIndex: transaction.pay_fee_index,
        type: transaction.type,
        blockNumber: transaction.block_number,
        blockTime: transaction.block_time,
        status: transaction.status,
      })),
    }));
}

export function createDownloadTravelRuleReportResultSchema(): z.ZodType<DownloadTravelRuleReportResult> {
  return downloadTravelRuleReportDataSchema;
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

function equalHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function equalText(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function involvesAddress(
  transaction: z.infer<typeof transactionWireSchema>,
  address: string,
): boolean {
  return (
    equalHex(transaction.from_address, address) ||
    equalHex(transaction.to_address, address)
  );
}

function isSafeDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.hash.length === 0
    );
  } catch {
    return false;
  }
}

function isSafeFileName(value: string): boolean {
  return (
    value.trim() === value &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
    })
  );
}
