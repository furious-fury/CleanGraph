import {
  CleanverseBusinessError,
  CleanverseConfigurationError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
  type APassVerificationOutcome,
  type CleanverseResponse,
  type QueryATokenRulesResult,
  type VerifyAPassForTokenResult,
} from "@cleangraph/cleanverse-client";
import {
  preflightDecisionSchema,
  preflightErrorSchema,
  type TransactionIntent,
} from "@cleangraph/shared";
import { describe, expect, it, vi } from "vitest";

import {
  createPreflightService,
  type CleanverseComplianceReader,
} from "../src/services/preflight.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const sender = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const recipient = "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb";
const atokenAddress =
  "0xCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCcCc";
const intent: TransactionIntent = {
  chain: "monad",
  sender,
  recipient,
  atokenAddress,
  amount: "10.5",
};
const fixedTime = new Date("2026-07-31T12:00:00.000Z");

function verificationResponse(
  address: string,
  outcome: APassVerificationOutcome,
): CleanverseResponse<VerifyAPassForTokenResult> {
  const verificationCodeByOutcome = {
    ATOKEN_NOT_FOUND: 1,
    APASS_MISSING: 2,
    APASS_NOT_ELIGIBLE: 3,
    ELIGIBLE: 4,
  } as const;

  return {
    requestId,
    data: {
      chain: "monad",
      atokenAddress,
      address,
      verificationCode: verificationCodeByOutcome[outcome],
      outcome,
      message: "untrusted-upstream-message",
      registrationUrl:
        "https://register.cleanverse.example/sensitive-registration-token",
    },
  };
}

function rulesResponse(
  rules: QueryATokenRulesResult["rules"] = [],
): CleanverseResponse<QueryATokenRulesResult> {
  return {
    requestId,
    data: {
      chain: "monad",
      atokenAddress,
      rules,
    },
  };
}

function createReader(
  senderOutcome: APassVerificationOutcome = "ELIGIBLE",
  recipientOutcome: APassVerificationOutcome = "ELIGIBLE",
): {
  reader: CleanverseComplianceReader;
  verifyAPassForToken: ReturnType<
    typeof vi.fn<CleanverseComplianceReader["verifyAPassForToken"]>
  >;
  queryATokenRules: ReturnType<
    typeof vi.fn<CleanverseComplianceReader["queryATokenRules"]>
  >;
} {
  const verifyAPassForToken =
    vi.fn<CleanverseComplianceReader["verifyAPassForToken"]>();
  verifyAPassForToken
    .mockResolvedValueOnce(verificationResponse(sender, senderOutcome))
    .mockResolvedValueOnce(
      verificationResponse(recipient, recipientOutcome),
    );
  const queryATokenRules =
    vi.fn<CleanverseComplianceReader["queryATokenRules"]>();
  queryATokenRules.mockResolvedValue(rulesResponse());

  return {
    reader: {
      verifyAPassForToken,
      queryATokenRules,
    },
    verifyAPassForToken,
    queryATokenRules,
  };
}

describe("preflight orchestration", () => {
  it("approves only after sender, recipient, and rules checks succeed", async () => {
    const { reader, verifyAPassForToken, queryATokenRules } =
      createReader();
    const service = createPreflightService(reader, {
      clock: () => fixedTime,
    });

    const result = await service.evaluate(intent, requestId);

    expect(result.kind).toBe("decision");
    if (result.kind !== "decision") {
      throw new Error("Expected a decision.");
    }

    expect(preflightDecisionSchema.safeParse(result.decision).success).toBe(
      true,
    );
    expect(result.decision).toEqual({
      requestId,
      approved: true,
      decisionCode: "TRANSFER_APPROVED",
      checks: [
        {
          id: "sender-eligibility",
          source: "cleanverse",
          status: "approved",
          code: "ELIGIBLE",
          message: "Sender has an eligible A-Pass for this A-Token.",
          checkedAt: fixedTime.toISOString(),
        },
        {
          id: "recipient-eligibility",
          source: "cleanverse",
          status: "approved",
          code: "ELIGIBLE",
          message: "Recipient has an eligible A-Pass for this A-Token.",
          checkedAt: fixedTime.toISOString(),
        },
        {
          id: "asset-rules",
          source: "cleanverse",
          status: "approved",
          code: "ATOKEN_RULES_LOADED",
          message: "A-Token compliance rules loaded successfully.",
          checkedAt: fixedTime.toISOString(),
        },
      ],
    });
    expect(verifyAPassForToken).toHaveBeenNthCalledWith(
      1,
      {
        chain: "monad",
        atokenAddress,
        address: sender,
      },
      { requestId },
    );
    expect(verifyAPassForToken).toHaveBeenNthCalledWith(
      2,
      {
        chain: "monad",
        atokenAddress,
        address: recipient,
      },
      { requestId },
    );
    expect(queryATokenRules).toHaveBeenCalledWith(
      {
        chain: "monad",
        atokenAddress,
      },
      { requestId },
    );
  });

  it("accepts an empty rule list after both authoritative verifications", async () => {
    const { reader } = createReader();
    const result = await createPreflightService(reader).evaluate(
      intent,
      requestId,
    );

    expect(result).toMatchObject({
      kind: "decision",
      decision: {
        approved: true,
        decisionCode: "TRANSFER_APPROVED",
      },
    });
  });

  it.each([
    ["ATOKEN_NOT_FOUND", "ATOKEN_NOT_FOUND", "ATOKEN_NOT_FOUND"],
    ["APASS_MISSING", "SENDER_APASS_MISSING", "APASS_MISSING"],
    [
      "APASS_NOT_ELIGIBLE",
      "SENDER_NOT_ELIGIBLE",
      "APASS_NOT_ELIGIBLE",
    ],
  ] as const)(
    "denies and stops when sender result is %s",
    async (outcome, decisionCode, checkCode) => {
      const { reader, verifyAPassForToken, queryATokenRules } =
        createReader(outcome);
      const result = await createPreflightService(reader, {
        clock: () => fixedTime,
      }).evaluate(intent, requestId);

      expect(result).toMatchObject({
        kind: "decision",
        decision: {
          approved: false,
          decisionCode,
          checks: [
            {
              id: "sender-eligibility",
              status: "denied",
              code: checkCode,
            },
          ],
        },
      });
      expect(verifyAPassForToken).toHaveBeenCalledTimes(1);
      expect(queryATokenRules).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["ATOKEN_NOT_FOUND", "ATOKEN_NOT_FOUND", "ATOKEN_NOT_FOUND"],
    ["APASS_MISSING", "RECIPIENT_APASS_MISSING", "APASS_MISSING"],
    [
      "APASS_NOT_ELIGIBLE",
      "RECIPIENT_NOT_ELIGIBLE",
      "APASS_NOT_ELIGIBLE",
    ],
  ] as const)(
    "denies and stops when recipient result is %s",
    async (outcome, decisionCode, checkCode) => {
      const { reader, verifyAPassForToken, queryATokenRules } =
        createReader("ELIGIBLE", outcome);
      const result = await createPreflightService(reader, {
        clock: () => fixedTime,
      }).evaluate(intent, requestId);

      expect(result).toMatchObject({
        kind: "decision",
        decision: {
          approved: false,
          decisionCode,
          checks: [
            {
              id: "sender-eligibility",
              status: "approved",
            },
            {
              id: "recipient-eligibility",
              status: "denied",
              code: checkCode,
            },
          ],
        },
      });
      expect(verifyAPassForToken).toHaveBeenCalledTimes(2);
      expect(queryATokenRules).not.toHaveBeenCalled();
    },
  );

  it("runs checks sequentially in sender, recipient, rules order", async () => {
    const callOrder: string[] = [];
    const verifyAPassForToken =
      vi.fn<CleanverseComplianceReader["verifyAPassForToken"]>(
        async (input) => {
          callOrder.push(
            input.address === sender ? "sender" : "recipient",
          );
          return verificationResponse(input.address, "ELIGIBLE");
        },
      );
    const queryATokenRules =
      vi.fn<CleanverseComplianceReader["queryATokenRules"]>(async () => {
        callOrder.push("rules");
        return rulesResponse();
      });

    await createPreflightService({
      verifyAPassForToken,
      queryATokenRules,
    }).evaluate(intent, requestId);

    expect(callOrder).toEqual(["sender", "recipient", "rules"]);
  });

  it("uses a fresh clock value for each completed check", async () => {
    const { reader } = createReader();
    const times = [
      new Date("2026-07-31T12:00:01.000Z"),
      new Date("2026-07-31T12:00:02.000Z"),
      new Date("2026-07-31T12:00:03.000Z"),
    ];
    const clock = vi
      .fn<() => Date>()
      .mockReturnValueOnce(times[0]!)
      .mockReturnValueOnce(times[1]!)
      .mockReturnValueOnce(times[2]!);
    const result = await createPreflightService(reader, {
      clock,
    }).evaluate(intent, requestId);

    expect(result).toMatchObject({
      kind: "decision",
      decision: {
        checks: [
          { checkedAt: times[0]!.toISOString() },
          { checkedAt: times[1]!.toISOString() },
          { checkedAt: times[2]!.toISOString() },
        ],
      },
    });
  });

  it("never exposes upstream messages or registration URLs", async () => {
    const { reader } = createReader("APASS_NOT_ELIGIBLE");
    const result = await createPreflightService(reader).evaluate(
      intent,
      requestId,
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("untrusted-upstream-message");
    expect(serialized).not.toContain("sensitive-registration-token");
  });
});

describe("preflight failure mapping", () => {
  it.each([
    [
      new CleanverseConfigurationError("sensitive-config-marker"),
      "SERVICE_NOT_CONFIGURED",
    ],
    [new CleanverseTimeoutError(requestId), "CLEANVERSE_TIMEOUT"],
    [new CleanverseNetworkError(requestId), "CLEANVERSE_UNAVAILABLE"],
    [new CleanverseHttpError(requestId, 503), "CLEANVERSE_UNAVAILABLE"],
    [
      new CleanverseBusinessError(requestId, "3001"),
      "CLEANVERSE_UNAVAILABLE",
    ],
    [
      new CleanverseMalformedResponseError(requestId),
      "CLEANVERSE_UNAVAILABLE",
    ],
    [new Error("sensitive-unexpected-marker"), "INTERNAL_SERVER_ERROR"],
  ] as const)(
    "maps %s to %s without leaking error details",
    async (error, expectedCode) => {
      const { reader, verifyAPassForToken } = createReader();
      verifyAPassForToken.mockReset();
      verifyAPassForToken.mockRejectedValue(error);

      const result = await createPreflightService(reader).evaluate(
        intent,
        requestId,
      );
      const serialized = JSON.stringify(result);

      expect(result).toMatchObject({
        kind: "failure",
        error: {
          code: expectedCode,
        },
        checks: [],
      });
      if (result.kind === "failure") {
        expect(preflightErrorSchema.safeParse(result.error).success).toBe(
          true,
        );
      }
      expect(serialized).not.toContain("sensitive-config-marker");
      expect(serialized).not.toContain("sensitive-unexpected-marker");
      expect(serialized).not.toContain("3001");
    },
  );

  it("preserves only completed checks when recipient verification fails", async () => {
    const { reader, verifyAPassForToken } = createReader();
    verifyAPassForToken.mockReset();
    verifyAPassForToken
      .mockResolvedValueOnce(verificationResponse(sender, "ELIGIBLE"))
      .mockRejectedValueOnce(new CleanverseTimeoutError(requestId));

    const result = await createPreflightService(reader, {
      clock: () => fixedTime,
    }).evaluate(intent, requestId);

    expect(result).toMatchObject({
      kind: "failure",
      error: { code: "CLEANVERSE_TIMEOUT" },
      checks: [{ id: "sender-eligibility", status: "approved" }],
    });
  });

  it("preserves both eligibility checks when rule loading fails", async () => {
    const { reader, queryATokenRules } = createReader();
    queryATokenRules.mockRejectedValue(
      new CleanverseNetworkError(requestId),
    );

    const result = await createPreflightService(reader, {
      clock: () => fixedTime,
    }).evaluate(intent, requestId);

    expect(result).toMatchObject({
      kind: "failure",
      error: { code: "CLEANVERSE_UNAVAILABLE" },
      checks: [
        { id: "sender-eligibility", status: "approved" },
        { id: "recipient-eligibility", status: "approved" },
      ],
    });
  });
});
