import {
  CleanverseBusinessError,
  CleanverseConfigurationError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
  type CleanverseClient,
  type CleanverseRequestOptions,
  type VerifyAPassForTokenResult,
} from "@cleangraph/cleanverse-client";
import type {
  ComplianceCheck,
  DeniedDecisionCode,
  PreflightDecision,
  PreflightError,
  TransactionIntent,
} from "@cleangraph/shared";

export type CleanverseComplianceReader = Pick<
  CleanverseClient,
  "queryATokenRules" | "verifyAPassForToken"
>;

export type PreflightEvaluation =
  | {
      kind: "decision";
      decision: PreflightDecision;
    }
  | {
      kind: "failure";
      error: PreflightError;
      checks: ComplianceCheck[];
    };

export type PreflightService = {
  evaluate(
    intent: TransactionIntent,
    requestId: string,
  ): Promise<PreflightEvaluation>;
};

type PreflightServiceOptions = {
  clock?: () => Date;
};

type VerificationSubject = "sender" | "recipient";

type VerificationDenial = {
  decisionCode: DeniedDecisionCode;
  check: ComplianceCheck;
};

const publicFailureByKind = {
  notConfigured: {
    code: "SERVICE_NOT_CONFIGURED",
    message: "The compliance service is not configured.",
  },
  timeout: {
    code: "CLEANVERSE_TIMEOUT",
    message: "The compliance service timed out.",
  },
  unavailable: {
    code: "CLEANVERSE_UNAVAILABLE",
    message: "The compliance service is temporarily unavailable.",
  },
  internal: {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
  },
} as const satisfies Record<string, PreflightError>;

export function createPreflightService(
  reader: CleanverseComplianceReader,
  options: PreflightServiceOptions = {},
): PreflightService {
  const clock = options.clock ?? (() => new Date());

  return {
    async evaluate(intent, requestId) {
      const checks: ComplianceCheck[] = [];
      const requestOptions: CleanverseRequestOptions = { requestId };

      try {
        const senderResult = await reader.verifyAPassForToken(
          {
            chain: intent.chain,
            atokenAddress: intent.atokenAddress,
            address: intent.sender,
          },
          requestOptions,
        );
        const senderDenial = createVerificationDenial(
          "sender",
          senderResult.data,
          clock,
        );

        if (senderDenial) {
          return {
            kind: "decision",
            decision: {
              requestId,
              approved: false,
              decisionCode: senderDenial.decisionCode,
              checks: [...checks, senderDenial.check],
            },
          };
        }

        checks.push(createApprovedVerificationCheck("sender", clock));

        const recipientResult = await reader.verifyAPassForToken(
          {
            chain: intent.chain,
            atokenAddress: intent.atokenAddress,
            address: intent.recipient,
          },
          requestOptions,
        );
        const recipientDenial = createVerificationDenial(
          "recipient",
          recipientResult.data,
          clock,
        );

        if (recipientDenial) {
          return {
            kind: "decision",
            decision: {
              requestId,
              approved: false,
              decisionCode: recipientDenial.decisionCode,
              checks: [...checks, recipientDenial.check],
            },
          };
        }

        checks.push(createApprovedVerificationCheck("recipient", clock));

        await reader.queryATokenRules(
          {
            chain: intent.chain,
            atokenAddress: intent.atokenAddress,
          },
          requestOptions,
        );
        checks.push({
          id: "asset-rules",
          source: "cleanverse",
          status: "approved",
          code: "ATOKEN_RULES_LOADED",
          message: "A-Token compliance rules loaded successfully.",
          checkedAt: timestamp(clock),
        });

        return {
          kind: "decision",
          decision: {
            requestId,
            approved: true,
            decisionCode: "TRANSFER_APPROVED",
            checks,
          },
        };
      } catch (error) {
        return {
          kind: "failure",
          error: mapFailure(error),
          checks,
        };
      }
    },
  };
}

function createApprovedVerificationCheck(
  subject: VerificationSubject,
  clock: () => Date,
): ComplianceCheck {
  return {
    id:
      subject === "sender"
        ? "sender-eligibility"
        : "recipient-eligibility",
    source: "cleanverse",
    status: "approved",
    code: "ELIGIBLE",
    message:
      subject === "sender"
        ? "Sender has an eligible A-Pass for this A-Token."
        : "Recipient has an eligible A-Pass for this A-Token.",
    checkedAt: timestamp(clock),
  };
}

function createVerificationDenial(
  subject: VerificationSubject,
  result: VerifyAPassForTokenResult,
  clock: () => Date,
): VerificationDenial | undefined {
  const id =
    subject === "sender"
      ? "sender-eligibility"
      : "recipient-eligibility";

  switch (result.outcome) {
    case "ATOKEN_NOT_FOUND":
      return {
        decisionCode: "ATOKEN_NOT_FOUND",
        check: {
          id,
          source: "cleanverse",
          status: "denied",
          code: result.outcome,
          message: "The selected A-Token was not found.",
          checkedAt: timestamp(clock),
        },
      };
    case "APASS_MISSING":
      return {
        decisionCode:
          subject === "sender"
            ? "SENDER_APASS_MISSING"
            : "RECIPIENT_APASS_MISSING",
        check: {
          id,
          source: "cleanverse",
          status: "denied",
          code: result.outcome,
          message:
            subject === "sender"
              ? "Sender does not have an A-Pass."
              : "Recipient does not have an A-Pass.",
          checkedAt: timestamp(clock),
        },
      };
    case "APASS_NOT_ELIGIBLE":
      return {
        decisionCode:
          subject === "sender"
            ? "SENDER_NOT_ELIGIBLE"
            : "RECIPIENT_NOT_ELIGIBLE",
        check: {
          id,
          source: "cleanverse",
          status: "denied",
          code: result.outcome,
          message:
            subject === "sender"
              ? "Sender is not eligible to transfer this A-Token."
              : "Recipient is not eligible to receive this A-Token.",
          checkedAt: timestamp(clock),
        },
      };
    case "ELIGIBLE":
      return undefined;
  }
}

function mapFailure(error: unknown): PreflightError {
  if (error instanceof CleanverseConfigurationError) {
    return publicFailureByKind.notConfigured;
  }

  if (error instanceof CleanverseTimeoutError) {
    return publicFailureByKind.timeout;
  }

  if (
    error instanceof CleanverseNetworkError ||
    error instanceof CleanverseHttpError ||
    error instanceof CleanverseBusinessError ||
    error instanceof CleanverseMalformedResponseError
  ) {
    return publicFailureByKind.unavailable;
  }

  return publicFailureByKind.internal;
}

function timestamp(clock: () => Date): string {
  return clock().toISOString();
}
