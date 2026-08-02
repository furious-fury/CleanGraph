import { describe, expect, it } from "vitest";

import {
  evidenceErrorResponseSchema,
  transactionEvidenceRequestSchema,
  transactionEvidenceResponseSchema,
} from "../src/index.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const transactionHash = `0x${"a".repeat(64)}`;
const walletAddress = "0x1111111111111111111111111111111111111111";
const transaction = {
  chain: "monad",
  symbol: "TRWA",
  transactionHash,
  fromAddress: walletAddress,
  toAddress: "0x2222222222222222222222222222222222222222",
  amount: "1000000000000000000",
  feeAmount: "0",
  feePayerIndex: 0,
  type: "transfer",
  blockNumber: 123,
  blockTime: 1_786_120_100,
  status: "success",
};

describe("transaction evidence contracts", () => {
  it("accepts the strict Monad evidence request", () => {
    expect(
      transactionEvidenceRequestSchema.parse({
        chain: "monad",
        transactionHash,
        walletAddress,
      }),
    ).toEqual({ chain: "monad", transactionHash, walletAddress });

    expect(
      transactionEvidenceRequestSchema.safeParse({
        chain: "monad",
        transactionHash,
        walletAddress,
        reportType: "transaction",
      }).success,
    ).toBe(false);
  });

  it.each([
    { chain: "base", transactionHash, walletAddress },
    { chain: "monad", transactionHash: "0x1", walletAddress },
    { chain: "monad", transactionHash, walletAddress: "0x1" },
  ])("rejects an invalid evidence request %#", (input) => {
    expect(transactionEvidenceRequestSchema.safeParse(input).success).toBe(false);
  });

  it("accepts a pending index snapshot", () => {
    expect(
      transactionEvidenceResponseSchema.safeParse({
        requestId,
        index: { status: "PENDING", attempts: 3 },
        report: { status: "PENDING" },
      }).success,
    ).toBe(true);
  });

  it.each([
    {
      requestId,
      index: { status: "INDEXED", attempts: 1, transaction },
      report: {
        status: "AVAILABLE",
        fileName: "transaction-report.pdf",
        downloadUrl: "https://reports.example/download?token=sanitized",
      },
    },
    {
      requestId,
      index: { status: "INDEXED", attempts: 2, transaction },
      report: { status: "UNAVAILABLE" },
    },
  ])("accepts an indexed evidence snapshot %#", (response) => {
    expect(transactionEvidenceResponseSchema.safeParse(response).success).toBe(true);
  });

  it.each([
    {
      requestId,
      index: { status: "PENDING", attempts: 3 },
      report: { status: "AVAILABLE", fileName: "report.pdf", downloadUrl: "https://reports.example/report" },
    },
    {
      requestId,
      index: { status: "INDEXED", attempts: 1, transaction },
      report: { status: "PENDING" },
    },
    {
      requestId,
      index: { status: "INDEXED", attempts: 1, transaction: { ...transaction, amount: "1.5" } },
      report: { status: "UNAVAILABLE" },
    },
    {
      requestId,
      index: { status: "INDEXED", attempts: 1, transaction },
      report: { status: "AVAILABLE", fileName: "../report.pdf", downloadUrl: "http://reports.example/report" },
    },
  ])("rejects an inconsistent or unsafe response %#", (response) => {
    expect(transactionEvidenceResponseSchema.safeParse(response).success).toBe(false);
  });

  it("accepts a sanitized rate-limit error", () => {
    expect(
      evidenceErrorResponseSchema.safeParse({
        requestId,
        error: {
          code: "RATE_LIMITED",
          message: "Try again later.",
          retryAfterSeconds: 30,
        },
      }).success,
    ).toBe(true);
  });
});
