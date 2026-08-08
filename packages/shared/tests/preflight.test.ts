import { describe, expect, it } from "vitest";

import {
  complianceCheckSchema,
  preflightDecisionSchema,
  preflightErrorResponseSchema,
  transactionIntentSchema,
} from "../src/index.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

const validIntent = {
  chain: "monad",
  sender: "0x1111111111111111111111111111111111111111",
  recipient: "0x2222222222222222222222222222222222222222",
  tokenAddress: "0x3333333333333333333333333333333333333333",
  amount: "100.5",
};

const completedCheck = {
  id: "sender-eligibility",
  source: "cleangraph",
  status: "approved",
  code: "4",
  message: "Sender A-Pass satisfies the local asset policy",
  checkedAt: "2026-07-30T12:00:00.000Z",
};

describe("transactionIntentSchema", () => {
  it("accepts a valid Monad transaction intent without changing address casing", () => {
    const sender = "0xAa11111111111111111111111111111111111111";
    const result = transactionIntentSchema.parse({
      ...validIntent,
      sender,
    });

    expect(result.sender).toBe(sender);
  });

  it("rejects unsupported chains", () => {
    const result = transactionIntentSchema.safeParse({
      ...validIntent,
      chain: "ethereum",
    });

    expect(result.success).toBe(false);
  });

  it.each([
    "0x1234",
    "1111111111111111111111111111111111111111",
    "0xZZ11111111111111111111111111111111111111",
    "0x11111111111111111111111111111111111111111",
  ])("rejects malformed EVM address %s", (sender) => {
    const result = transactionIntentSchema.safeParse({
      ...validIntent,
      sender,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    1,
    "0",
    "0.000000000000000000",
    "-1",
    "1e3",
    ".5",
    "1.",
    "01",
    "1.1234567890123456789",
  ])("rejects invalid token amount %s", (amount) => {
    const result = transactionIntentSchema.safeParse({
      ...validIntent,
      amount,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown request properties", () => {
    const result = transactionIntentSchema.safeParse({
      ...validIntent,
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });

  it("rejects the obsolete atokenAddress request property", () => {
    const { tokenAddress, ...intent } = validIntent;
    const result = transactionIntentSchema.safeParse({
      ...intent,
      atokenAddress: tokenAddress,
    });

    expect(result.success).toBe(false);
  });
});

describe("preflightDecisionSchema", () => {
  it("accepts a matching approved decision", () => {
    const result = preflightDecisionSchema.safeParse({
      requestId,
      approved: true,
      decisionCode: "TRANSFER_APPROVED",
      checks: [completedCheck],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an approved decision paired with a denial code", () => {
    const result = preflightDecisionSchema.safeParse({
      requestId,
      approved: true,
      decisionCode: "RECIPIENT_POLICY_MISMATCH",
      checks: [completedCheck],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a matching denied decision", () => {
    const result = preflightDecisionSchema.safeParse({
      requestId,
      approved: false,
      decisionCode: "RECIPIENT_POLICY_MISMATCH",
      checks: [
        {
          ...completedCheck,
          id: "recipient-eligibility",
          status: "denied",
          code: "APASS_POLICY_MISMATCH",
          message: "Recipient A-Pass does not satisfy the local asset policy",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a denied decision without a supported denial code", () => {
    const result = preflightDecisionSchema.safeParse({
      requestId,
      approved: false,
      decisionCode: "TRANSFER_DENIED",
      checks: [completedCheck],
    });

    expect(result.success).toBe(false);
  });
});

describe("preflight error and check schemas", () => {
  it("accepts an infrastructure error with completed checks", () => {
    const result = preflightErrorResponseSchema.safeParse({
      requestId,
      error: {
        code: "CLEANVERSE_TIMEOUT",
        message: "Cleanverse did not respond before the request deadline.",
      },
      checks: [completedCheck],
    });

    expect(result.success).toBe(true);
  });

  it("accepts validation field errors", () => {
    const result = preflightErrorResponseSchema.safeParse({
      requestId,
      error: {
        code: "VALIDATION_ERROR",
        message: "The transaction intent is invalid.",
        fields: {
          amount: ["Amount must be greater than zero"],
        },
      },
      checks: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid request IDs", () => {
    const result = preflightErrorResponseSchema.safeParse({
      requestId: "not-a-uuid",
      error: {
        code: "CLEANVERSE_UNAVAILABLE",
        message: "Cleanverse is unavailable.",
      },
      checks: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid check timestamps", () => {
    const result = complianceCheckSchema.safeParse({
      ...completedCheck,
      checkedAt: "not-a-timestamp",
    });

    expect(result.success).toBe(false);
  });
});
