import {
  CleanverseBusinessError,
  CleanverseConfigurationError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
  type CleanverseClient,
  type CleanverseRequestOptions,
  type QueryAPassResult,
} from "@cleangraph/cleanverse-client";
import type {
  ComplianceCheck,
  DeniedDecisionCode,
  PreflightDecision,
  PreflightError,
  TransactionIntent,
} from "@cleangraph/shared";

import type { TrwaPolicy } from "../config/env.js";

export type CleanverseComplianceReader = Pick<CleanverseClient, "queryAPass">;

export type PreflightEvaluation =
  | { kind: "decision"; decision: PreflightDecision }
  | { kind: "failure"; error: PreflightError; checks: ComplianceCheck[] };

export type PreflightService = {
  evaluate(intent: TransactionIntent, requestId: string): Promise<PreflightEvaluation>;
};

type PreflightServiceOptions = { clock?: () => Date };
type VerificationSubject = "sender" | "recipient";
type PolicyDenial = { decisionCode: DeniedDecisionCode; check: ComplianceCheck };

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
  policy: TrwaPolicy,
  options: PreflightServiceOptions = {},
): PreflightService {
  const clock = options.clock ?? (() => new Date());

  return {
    async evaluate(intent, requestId) {
      const checks: ComplianceCheck[] = [];

      if (intent.tokenAddress.toLowerCase() !== policy.tokenAddress.toLowerCase()) {
        return {
          kind: "decision",
          decision: {
            requestId,
            approved: false,
            decisionCode: "TOKEN_NOT_SUPPORTED",
            checks: [
              {
                id: "asset-policy",
                source: "cleangraph",
                status: "denied",
                code: "TOKEN_NOT_SUPPORTED",
                message: "The selected token is not supported by this application.",
                checkedAt: timestamp(clock()),
              },
            ],
          },
        };
      }

      const requestOptions: CleanverseRequestOptions = { requestId };

      try {
        const sender = await reader.queryAPass(
          { chain: intent.chain, address: intent.sender },
          requestOptions,
        );
        const senderCheck = evaluateAPass("sender", sender.data, policy, clock());
        if (senderCheck.denial) {
          return deniedDecision(requestId, checks, senderCheck.denial);
        }
        checks.push(senderCheck.approved);

        const recipient = await reader.queryAPass(
          { chain: intent.chain, address: intent.recipient },
          requestOptions,
        );
        const recipientCheck = evaluateAPass("recipient", recipient.data, policy, clock());
        if (recipientCheck.denial) {
          return deniedDecision(requestId, checks, recipientCheck.denial);
        }
        checks.push(recipientCheck.approved);

        checks.push({
          id: "asset-policy",
          source: "cleangraph",
          status: "approved",
          code: "LOCAL_ASSET_POLICY_PASSED",
          message: "CleanGraph's local TRWA policy passed for both wallets.",
          checkedAt: timestamp(clock()),
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
        return { kind: "failure", error: mapFailure(error), checks };
      }
    },
  };
}

function evaluateAPass(
  subject: VerificationSubject,
  result: QueryAPassResult,
  policy: TrwaPolicy,
  checkedAt: Date,
): { approved: ComplianceCheck; denial?: never } | { approved?: never; denial: PolicyDenial } {
  const id = subject === "sender" ? "sender-eligibility" : "recipient-eligibility";
  const subjectLabel = subject === "sender" ? "Sender" : "Recipient";
  const suffix = subject === "sender" ? "SENDER" : "RECIPIENT";

  if (result.status !== "ACTIVE") {
    return {
      denial: {
        decisionCode: `${suffix}_APASS_INACTIVE`,
        check: deniedCheck(id, "APASS_INACTIVE", `${subjectLabel} A-Pass is not active.`, checkedAt),
      },
    };
  }

  if (result.expirationTime <= Math.floor(checkedAt.getTime() / 1_000)) {
    return {
      denial: {
        decisionCode: `${suffix}_APASS_EXPIRED`,
        check: deniedCheck(id, "APASS_EXPIRED", `${subjectLabel} A-Pass has expired.`, checkedAt),
      },
    };
  }

  const countryMatches = result.countries.some((country) =>
    policy.allowedCountries.includes(country),
  );
  if (
    (policy.allowedGroup !== undefined && result.group !== policy.allowedGroup) ||
    (policy.allowedSubgroup !== undefined && result.subGroup !== policy.allowedSubgroup) ||
    !countryMatches
  ) {
    return {
      denial: {
        decisionCode: `${suffix}_POLICY_MISMATCH`,
        check: deniedCheck(
          id,
          "APASS_POLICY_MISMATCH",
          `${subjectLabel} A-Pass does not satisfy the local asset policy.`,
          checkedAt,
        ),
      },
    };
  }

  return {
    approved: {
      id,
      source: "cleangraph",
      status: "approved",
      code: "APASS_POLICY_MATCH",
      message: `${subjectLabel} A-Pass satisfies the local asset policy.`,
      checkedAt: timestamp(checkedAt),
    },
  };
}

function deniedCheck(
  id: "sender-eligibility" | "recipient-eligibility",
  code: string,
  message: string,
  checkedAt: Date,
): ComplianceCheck {
  return {
    id,
    source: "cleangraph",
    status: "denied",
    code,
    message,
    checkedAt: timestamp(checkedAt),
  };
}

function deniedDecision(
  requestId: string,
  checks: ComplianceCheck[],
  denial: PolicyDenial,
): PreflightEvaluation {
  return {
    kind: "decision",
    decision: {
      requestId,
      approved: false,
      decisionCode: denial.decisionCode,
      checks: [...checks, denial.check],
    },
  };
}

function mapFailure(error: unknown): PreflightError {
  if (error instanceof CleanverseConfigurationError) return publicFailureByKind.notConfigured;
  if (error instanceof CleanverseTimeoutError) return publicFailureByKind.timeout;
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

function timestamp(date: Date): string {
  return date.toISOString();
}
