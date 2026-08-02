import {
  CleanverseConfigurationError,
  CleanverseError,
  CleanverseMalformedResponseError,
  type CleanverseClient,
} from "@cleangraph/cleanverse-client";
import type {
  TransactionEvidenceRequest,
  TransactionEvidenceResponse,
} from "@cleangraph/shared";

export type CleanverseEvidenceClient = Pick<
  CleanverseClient,
  "queryTransactions" | "downloadTravelRuleReport"
>;

export type EvidenceServiceResult = {
  response: TransactionEvidenceResponse;
  reportFailureCode?: string;
};

export type EvidenceService = {
  getEvidence(
    input: TransactionEvidenceRequest,
    requestId: string,
  ): Promise<EvidenceServiceResult>;
};

export class UnexpectedEvidenceReportError extends Error {
  constructor() {
    super("An unexpected report error occurred.");
    this.name = "UnexpectedEvidenceReportError";
  }
}

type EvidenceServiceOptions = {
  maxAttempts?: number;
  intervalMs?: number;
  delay?: (milliseconds: number) => Promise<void>;
};

export function createEvidenceService(
  client: CleanverseEvidenceClient,
  options: EvidenceServiceOptions = {},
): EvidenceService {
  const maxAttempts = options.maxAttempts ?? 3;
  const intervalMs = options.intervalMs ?? 1_000;
  const wait = options.delay ?? delay;

  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 10 ||
    !Number.isInteger(intervalMs) ||
    intervalMs < 0 ||
    intervalMs > 60_000
  ) {
    throw new CleanverseConfigurationError(
      "The evidence polling configuration is invalid.",
    );
  }

  return {
    async getEvidence(input, requestId) {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const indexed = await client.queryTransactions(
          {
            chain: input.chain,
            address: input.walletAddress,
            transactionHash: input.transactionHash,
            page: 1,
            pageSize: 1,
          },
          { requestId },
        );

        if (indexed.data.transactions.length === 0) {
          if (indexed.data.totalCount !== 0) {
            throw new CleanverseMalformedResponseError(requestId);
          }

          if (attempt < maxAttempts && intervalMs > 0) {
            await wait(intervalMs);
          }
          continue;
        }

        if (
          indexed.data.transactions.length !== 1 ||
          indexed.data.totalCount !== 1
        ) {
          throw new CleanverseMalformedResponseError(requestId);
        }

        const transaction = indexed.data.transactions[0]!;

        try {
          const report = await client.downloadTravelRuleReport(
            {
              transactionHash: input.transactionHash,
              wallet: {
                chain: input.chain,
                address: input.walletAddress,
              },
            },
            { requestId },
          );

          return {
            response: {
              requestId,
              index: { status: "INDEXED", attempts: attempt, transaction },
              report: { status: "AVAILABLE", ...report.data },
            },
          };
        } catch (error) {
          if (!(error instanceof CleanverseError)) {
            throw new UnexpectedEvidenceReportError();
          }

          return {
            response: {
              requestId,
              index: { status: "INDEXED", attempts: attempt, transaction },
              report: { status: "UNAVAILABLE" },
            },
            reportFailureCode: error.code,
          };
        }
      }

      return {
        response: {
          requestId,
          index: { status: "PENDING", attempts: maxAttempts },
          report: { status: "PENDING" },
        },
      };
    },
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
