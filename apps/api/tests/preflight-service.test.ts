import {
  CleanverseBusinessError,
  CleanverseConfigurationError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
  type CleanverseResponse,
  type QueryAPassResult,
} from "@cleangraph/cleanverse-client";
import { preflightDecisionSchema, preflightErrorSchema, type TransactionIntent } from "@cleangraph/shared";
import { describe, expect, it, vi } from "vitest";

import type { TrwaPolicy } from "../src/config/env.js";
import {
  createPreflightService,
  type CleanverseComplianceReader,
} from "../src/services/preflight.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const sender = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const recipient = "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb";
const tokenAddress = "0xCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc";
const fixedTime = new Date("2026-07-31T12:00:00.000Z");
const nowSeconds = Math.floor(fixedTime.getTime() / 1_000);

const policy: TrwaPolicy = {
  tokenAddress,
  allowedGroup: "AB",
  allowedSubgroup: "CD",
  allowedCountries: ["US", "GB", "DE", "SG"],
};

const intent: TransactionIntent = {
  chain: "monad",
  sender,
  recipient,
  tokenAddress,
  amount: "10.5",
};

function pass(overrides: Partial<QueryAPassResult> = {}): QueryAPassResult {
  return {
    cvRecordId: "sensitive-cv-record-id",
    tier: "sensitive-tier",
    subTier: 99,
    statusCode: 1,
    status: "ACTIVE",
    expirationTime: nowSeconds + 3_600,
    group: policy.allowedGroup!,
    subGroup: policy.allowedSubgroup!,
    currentKycHash: "sensitive-kyc-hash",
    countries: ["GB"],
    ...overrides,
  };
}

function response(data: QueryAPassResult): CleanverseResponse<QueryAPassResult> {
  return { requestId, data };
}

function readerWith(...records: QueryAPassResult[]) {
  const queryAPass = vi.fn<CleanverseComplianceReader["queryAPass"]>();
  for (const record of records) queryAPass.mockResolvedValueOnce(response(record));
  return { reader: { queryAPass }, queryAPass };
}

function service(reader: CleanverseComplianceReader) {
  return createPreflightService(reader, policy, { clock: () => fixedTime });
}

describe("self-deployed TRWA preflight", () => {
  it("rejects an unsupported token locally before any Cleanverse call", async () => {
    const { reader, queryAPass } = readerWith(pass(), pass());
    const result = await service(reader).evaluate(
      { ...intent, tokenAddress: "0x1111111111111111111111111111111111111111" },
      requestId,
    );

    expect(result).toMatchObject({
      kind: "decision",
      decision: {
        approved: false,
        decisionCode: "TOKEN_NOT_SUPPORTED",
        checks: [{ id: "asset-policy", source: "cleangraph", code: "TOKEN_NOT_SUPPORTED" }],
      },
    });
    expect(queryAPass).not.toHaveBeenCalled();
  });

  it("approves active, unexpired, matching sender and recipient A-Passes", async () => {
    const { reader, queryAPass } = readerWith(pass(), pass({ countries: ["DE", "BR"] }));
    const result = await service(reader).evaluate(intent, requestId);

    expect(result.kind).toBe("decision");
    if (result.kind !== "decision") throw new Error("Expected a decision");
    expect(preflightDecisionSchema.safeParse(result.decision).success).toBe(true);
    expect(result.decision).toMatchObject({
      approved: true,
      decisionCode: "TRANSFER_APPROVED",
      checks: [
        { id: "sender-eligibility", source: "cleangraph", code: "APASS_POLICY_MATCH" },
        { id: "recipient-eligibility", source: "cleangraph", code: "APASS_POLICY_MATCH" },
        { id: "asset-policy", source: "cleangraph", code: "LOCAL_ASSET_POLICY_PASSED" },
      ],
    });
    expect(queryAPass).toHaveBeenNthCalledWith(
      1,
      { chain: "monad", address: sender },
      { requestId },
    );
    expect(queryAPass).toHaveBeenNthCalledWith(
      2,
      { chain: "monad", address: recipient },
      { requestId },
    );
    expect(JSON.stringify(result)).not.toMatch(/sensitive-cv|sensitive-kyc|sensitive-tier/);
  });


  it("approves active country-matching passes when group and subgroup are not configured", async () => {
    const countryOnlyPolicy: TrwaPolicy = {
      tokenAddress,
      allowedCountries: ["GB", "DE"],
    };
    const { reader } = readerWith(
      pass({ group: "", subGroup: "", countries: ["GB"] }),
      pass({ group: "", subGroup: "", countries: ["DE"] }),
    );

    const result = await createPreflightService(reader, countryOnlyPolicy, { clock: () => fixedTime })
      .evaluate(intent, requestId);

    expect(result).toMatchObject({
      kind: "decision",
      decision: { approved: true, decisionCode: "TRANSFER_APPROVED" },
    });
  });
  it.each([
    ["inactive", { status: "FROZEN", statusCode: 2 }, "APASS_INACTIVE", "APASS_INACTIVE"],
    ["expired", { expirationTime: nowSeconds }, "APASS_EXPIRED", "APASS_EXPIRED"],
    ["group", { group: "Wrong" }, "POLICY_MISMATCH", "APASS_POLICY_MISMATCH"],
    ["subgroup", { subGroup: "Wrong" }, "POLICY_MISMATCH", "APASS_POLICY_MISMATCH"],
    ["country", { countries: ["BR"] }, "POLICY_MISMATCH", "APASS_POLICY_MISMATCH"],
  ] as const)(
    "denies and fails fast for a sender %s mismatch",
    async (_name, overrides, decisionSuffix, checkCode) => {
      const { reader, queryAPass } = readerWith(pass(overrides), pass());
      const result = await service(reader).evaluate(intent, requestId);
      expect(result).toMatchObject({
        kind: "decision",
        decision: {
          approved: false,
          decisionCode: `SENDER_${decisionSuffix}`,
          checks: [{ id: "sender-eligibility", code: checkCode }],
        },
      });
      expect(queryAPass).toHaveBeenCalledTimes(1);
    },
  );


  it.each([
    ["inactive", { status: "FROZEN", statusCode: 2 }, "APASS_INACTIVE", "APASS_INACTIVE"],
    ["expired", { expirationTime: nowSeconds - 1 }, "APASS_EXPIRED", "APASS_EXPIRED"],
    ["group", { group: "Wrong" }, "POLICY_MISMATCH", "APASS_POLICY_MISMATCH"],
    ["subgroup", { subGroup: "Wrong" }, "POLICY_MISMATCH", "APASS_POLICY_MISMATCH"],
    ["country", { countries: [] }, "POLICY_MISMATCH", "APASS_POLICY_MISMATCH"],
  ] as const)(
    "denies for a recipient %s mismatch after preserving the sender check",
    async (_name, overrides, decisionSuffix, checkCode) => {
      const { reader, queryAPass } = readerWith(pass(), pass(overrides));
      const result = await service(reader).evaluate(intent, requestId);
      expect(result).toMatchObject({
        kind: "decision",
        decision: {
          approved: false,
          decisionCode: `RECIPIENT_${decisionSuffix}`,
          checks: [
            { id: "sender-eligibility", status: "approved" },
            { id: "recipient-eligibility", status: "denied", code: checkCode },
          ],
        },
      });
      expect(queryAPass).toHaveBeenCalledTimes(2);
    },
  );
});

describe("preflight failure mapping", () => {
  it.each([
    [new CleanverseConfigurationError("secret"), "SERVICE_NOT_CONFIGURED"],
    [new CleanverseTimeoutError(requestId), "CLEANVERSE_TIMEOUT"],
    [new CleanverseNetworkError(requestId), "CLEANVERSE_UNAVAILABLE"],
    [new CleanverseHttpError(requestId, 503), "CLEANVERSE_UNAVAILABLE"],
    [new CleanverseBusinessError(requestId, "secret-code"), "CLEANVERSE_UNAVAILABLE"],
    [new CleanverseMalformedResponseError(requestId), "CLEANVERSE_UNAVAILABLE"],
    [new Error("secret-programming-error"), "INTERNAL_SERVER_ERROR"],
  ] as const)("maps errors to sanitized %s", async (error, expectedCode) => {
    const queryAPass = vi.fn<CleanverseComplianceReader["queryAPass"]>().mockRejectedValue(error);
    const result = await service({ queryAPass }).evaluate(intent, requestId);

    expect(result).toMatchObject({ kind: "failure", error: { code: expectedCode }, checks: [] });
    if (result.kind === "failure") expect(preflightErrorSchema.safeParse(result.error).success).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/secret|programming/);
  });

  it("preserves only the sanitized sender check when the recipient query fails", async () => {
    const queryAPass = vi
      .fn<CleanverseComplianceReader["queryAPass"]>()
      .mockResolvedValueOnce(response(pass()))
      .mockRejectedValueOnce(new CleanverseTimeoutError(requestId));
    const result = await service({ queryAPass }).evaluate(intent, requestId);

    expect(result).toMatchObject({
      kind: "failure",
      error: { code: "CLEANVERSE_TIMEOUT" },
      checks: [{ id: "sender-eligibility", code: "APASS_POLICY_MATCH" }],
    });
  });
});
