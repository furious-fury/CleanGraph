import {
  CleanverseBusinessError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
} from "@cleangraph/cleanverse-client";
import { describe, expect, it, vi } from "vitest";

import {
  createEvidenceService,
  type CleanverseEvidenceClient,
} from "../src/services/evidence.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const transactionHash = `0x${"a".repeat(64)}`;
const walletAddress = "0x1111111111111111111111111111111111111111";
const input = { chain: "monad" as const, transactionHash, walletAddress };
const transaction = {
  chain: "monad" as const,
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

function createClient() {
  return {
    queryTransactions: vi.fn<CleanverseEvidenceClient["queryTransactions"]>(),
    downloadTravelRuleReport:
      vi.fn<CleanverseEvidenceClient["downloadTravelRuleReport"]>(),
  };
}

const emptyResult = {
  requestId,
  data: { totalCount: 0, page: 1, pageSize: 1, transactions: [] },
};
const indexedResult = {
  requestId,
  data: { totalCount: 1, page: 1, pageSize: 1, transactions: [transaction] },
};

describe("transaction evidence service", () => {
  it("returns indexed evidence and an available report on the first attempt", async () => {
    const client = createClient();
    client.queryTransactions.mockResolvedValue(indexedResult);
    client.downloadTravelRuleReport.mockResolvedValue({
      requestId,
      data: {
        fileName: "transaction-report.pdf",
        downloadUrl: "https://reports.example/download?token=sanitized",
      },
    });

    const result = await createEvidenceService(client).getEvidence(input, requestId);

    expect(result.response).toMatchObject({
      requestId,
      index: { status: "INDEXED", attempts: 1, transaction },
      report: { status: "AVAILABLE", fileName: "transaction-report.pdf" },
    });
    expect(client.queryTransactions).toHaveBeenCalledWith(
      {
        chain: "monad",
        address: walletAddress,
        transactionHash,
        page: 1,
        pageSize: 1,
      },
      { requestId },
    );
    expect(client.downloadTravelRuleReport).toHaveBeenCalledWith(
      {
        transactionHash,
        wallet: { chain: "monad", address: walletAddress },
      },
      { requestId },
    );
  });

  it("polls empty results and reports the attempt that found evidence", async () => {
    const client = createClient();
    client.queryTransactions
      .mockResolvedValueOnce(emptyResult)
      .mockResolvedValueOnce(indexedResult);
    client.downloadTravelRuleReport.mockResolvedValue({
      requestId,
      data: {
        fileName: "report.pdf",
        downloadUrl: "https://reports.example/report",
      },
    });
    const wait = vi.fn<(milliseconds: number) => Promise<void>>()
      .mockResolvedValue(undefined);

    const result = await createEvidenceService(client, { delay: wait }).getEvidence(input, requestId);

    expect(result.response.index).toMatchObject({ status: "INDEXED", attempts: 2 });
    expect(client.queryTransactions).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1_000);
  });

  it("returns pending after three empty results without requesting a report", async () => {
    const client = createClient();
    client.queryTransactions.mockResolvedValue(emptyResult);
    const wait = vi.fn<(milliseconds: number) => Promise<void>>()
      .mockResolvedValue(undefined);

    const result = await createEvidenceService(client, { delay: wait }).getEvidence(input, requestId);

    expect(result.response).toEqual({
      requestId,
      index: { status: "PENDING", attempts: 3 },
      report: { status: "PENDING" },
    });
    expect(client.queryTransactions).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(client.downloadTravelRuleReport).not.toHaveBeenCalled();
  });

  it.each([
    new CleanverseBusinessError(requestId, "0002"),
    new CleanverseNetworkError(requestId),
  ])("preserves indexed evidence when a known report failure occurs", async (error) => {
    const client = createClient();
    client.queryTransactions.mockResolvedValue(indexedResult);
    client.downloadTravelRuleReport.mockRejectedValue(error);

    const result = await createEvidenceService(client).getEvidence(input, requestId);

    expect(result.response).toMatchObject({
      index: { status: "INDEXED", transaction },
      report: { status: "UNAVAILABLE" },
    });
    expect(result.reportFailureCode).toBe(error.code);
  });

  it("does not retry an index failure", async () => {
    const client = createClient();
    client.queryTransactions.mockRejectedValue(new CleanverseNetworkError(requestId));

    await expect(
      createEvidenceService(client).getEvidence(input, requestId),
    ).rejects.toBeInstanceOf(CleanverseNetworkError);
    expect(client.queryTransactions).toHaveBeenCalledTimes(1);
    expect(client.downloadTravelRuleReport).not.toHaveBeenCalled();
  });

  it.each([
    { ...indexedResult, data: { ...indexedResult.data, totalCount: 2 } },
    { ...indexedResult, data: { ...indexedResult.data, transactions: [transaction, transaction] } },
    { ...emptyResult, data: { ...emptyResult.data, totalCount: 1 } },
  ])("rejects contradictory or duplicate exact-hash index results", async (result) => {
    const client = createClient();
    client.queryTransactions.mockResolvedValue(result);

    await expect(
      createEvidenceService(client).getEvidence(input, requestId),
    ).rejects.toBeInstanceOf(CleanverseMalformedResponseError);
    expect(client.queryTransactions).toHaveBeenCalledTimes(1);
  });

  it("does not convert unexpected report exceptions into availability state", async () => {
    const client = createClient();
    client.queryTransactions.mockResolvedValue(indexedResult);
    client.downloadTravelRuleReport.mockRejectedValue(new Error("unexpected secret"));

    await expect(
      createEvidenceService(client).getEvidence(input, requestId),
    ).rejects.toThrow("unexpected secret");
  });
});
