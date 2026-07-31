import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import {
  CLEANVERSE_SANDBOX_BASE_URL,
  CleanverseBusinessError,
  CleanverseClient,
  CleanverseConfigurationError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  type CleanverseClientConfig,
} from "../src/index.js";
import {
  emptyTransactionsData,
  evidenceCounterpartyAddress,
  evidenceTransactionHash,
  evidenceWalletAddress,
  populatedTransactionsData,
  transactionReportData,
  transactionWireData,
  travelRuleReportData,
} from "./fixtures/evidence.js";

const requestIdA = "123e4567-e89b-42d3-a456-426614174000";
const requestIdB = "223e4567-e89b-42d3-a456-426614174000";
const apiKey = Buffer.alloc(32, 7).toString("base64");

function successResponse(data: unknown): Response {
  return new Response(
    JSON.stringify({
      code: "0000",
      message: "success",
      data,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function createClient(
  fetchImplementation: typeof fetch,
  overrides: Partial<CleanverseClientConfig> = {},
): CleanverseClient {
  return new CleanverseClient({
    apiId: "test-api-id",
    apiKey,
    fetch: fetchImplementation,
    requestIdFactory: () => requestIdA,
    ...overrides,
  });
}

function expectPlainPost(
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
  path: string,
  body: unknown,
  requestId = requestIdA,
): void {
  const [input, init] = fetchMock.mock.calls[0]!;
  const headers = new Headers(init?.headers);

  expect(input).toBe(`${CLEANVERSE_SANDBOX_BASE_URL}/${path}`);
  expect(init?.method).toBe("POST");
  expect(init?.body).toBe(JSON.stringify(body));
  expect(headers.get("api-id")).toBe("test-api-id");
  expect(headers.get("X-Request-ID")).toBe(requestId);
  expect(headers.get("Accept")).toBe("application/json");
  expect(headers.get("Content-Type")).toBe("application/json");
}

describe("CleanverseClient.queryTransactions", () => {
  it("queries a Monad wallet with deterministic pagination defaults", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successResponse(populatedTransactionsData()),
    );
    const client = createClient(fetchMock);

    const result = await client.queryTransactions({
      chain: "monad",
      address: evidenceWalletAddress,
    });

    expect(result).toEqual({
      requestId: requestIdA,
      data: {
        totalCount: 1,
        page: 1,
        pageSize: 10,
        transactions: [
          {
            chain: "monad",
            symbol: "TRWA",
            transactionHash: evidenceTransactionHash.toLowerCase(),
            fromAddress: evidenceWalletAddress,
            toAddress: evidenceCounterpartyAddress,
            amount: "100000000000000000000",
            feeAmount: "0",
            feePayerIndex: 0,
            type: "transfer",
            blockNumber: 12_345_678,
            blockTime: 1_786_120_100,
            status: "success",
          },
        ],
      },
    });
    expect(result.data).not.toHaveProperty("ignoredUpstreamField");
    expect(result.data.transactions[0]).not.toHaveProperty(
      "ignoredTransactionField",
    );
    expectPlainPost(fetchMock, "query_txs", {
      chain: "monad",
      address: evidenceWalletAddress,
      page: 1,
      pageSize: 10,
    });
  });

  it("maps every documented filter and preserves caller identifiers", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successResponse(populatedTransactionsData()),
    );
    const client = createClient(fetchMock);
    const input = {
      chain: "monad" as const,
      address: evidenceWalletAddress,
      symbol: "TRWA",
      startTime: 1_786_120_000,
      endTime: 1_786_120_200,
      transactionHash: evidenceTransactionHash,
      type: "transfer",
      page: 2,
      pageSize: 20,
    };

    const result = await client.queryTransactions(input, {
      requestId: requestIdB,
    });

    expect(result.requestId).toBe(requestIdB);
    expect(result.data).toMatchObject({ page: 2, pageSize: 20 });
    expect(result.data.transactions[0]).toMatchObject({
      transactionHash: evidenceTransactionHash,
      fromAddress: evidenceWalletAddress,
    });
    expectPlainPost(
      fetchMock,
      "query_txs",
      {
        chain: "monad",
        address: evidenceWalletAddress,
        symbol: "TRWA",
        startTime: 1_786_120_000,
        endTime: 1_786_120_200,
        txHash: evidenceTransactionHash,
        type: "transfer",
        page: 2,
        pageSize: 20,
      },
      requestIdB,
    );
  });

  it("accepts an empty indexed result without inventing a failure", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(emptyTransactionsData));
    const client = createClient(fetchMock);

    const result = await client.queryTransactions({
      chain: "monad",
      address: evidenceWalletAddress,
      transactionHash: evidenceTransactionHash,
    });

    expect(result.data).toEqual({
      totalCount: 0,
      page: 1,
      pageSize: 10,
      transactions: [],
    });
  });

  it("retains a non-empty organization name", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successResponse({
        total_count: 1,
        txs: [
          {
            ...transactionWireData(),
            from_org_name: "Fictional Treasury Operator",
          },
        ],
      }),
    );
    const client = createClient(fetchMock);

    const result = await client.queryTransactions({
      chain: "monad",
      address: evidenceWalletAddress,
    });

    expect(result.data.transactions[0]?.fromOrganizationName).toBe(
      "Fictional Treasury Operator",
    );
  });

  it.each([
    ["wrong chain", { chain: "base", address: evidenceWalletAddress }],
    ["malformed address", { chain: "monad", address: "0x1234" }],
    [
      "unsafe symbol",
      { chain: "monad", address: evidenceWalletAddress, symbol: " TRWA" },
    ],
    [
      "unsafe type",
      { chain: "monad", address: evidenceWalletAddress, type: "transfer now" },
    ],
    [
      "zero timestamp",
      { chain: "monad", address: evidenceWalletAddress, startTime: 0 },
    ],
    [
      "fractional timestamp",
      { chain: "monad", address: evidenceWalletAddress, endTime: 1.5 },
    ],
    [
      "reversed range",
      {
        chain: "monad",
        address: evidenceWalletAddress,
        startTime: 200,
        endTime: 100,
      },
    ],
    [
      "malformed hash",
      { chain: "monad", address: evidenceWalletAddress, transactionHash: "0x1" },
    ],
    ["zero page", { chain: "monad", address: evidenceWalletAddress, page: 0 }],
    [
      "fractional page",
      { chain: "monad", address: evidenceWalletAddress, page: 1.5 },
    ],
    [
      "oversized page",
      { chain: "monad", address: evidenceWalletAddress, pageSize: 101 },
    ],
    [
      "unknown property",
      { chain: "monad", address: evidenceWalletAddress, unexpected: true },
    ],
  ])("rejects %s before fetch", async (_label, input) => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createClient(fetchMock);
    const operation = client.queryTransactions.bind(client) as (
      value: unknown,
    ) => Promise<unknown>;

    await expect(operation(input)).rejects.toBeInstanceOf(
      CleanverseConfigurationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong chain", { ...transactionWireData(), chain: "base" }, {}],
    [
      "unrelated wallet",
      {
        ...transactionWireData(),
        from_address: "0x1111111111111111111111111111111111111111",
        to_address: "0x2222222222222222222222222222222222222222",
      },
      {},
    ],
    [
      "contradictory hash",
      { ...transactionWireData(), tx_hash: `0x${"2".repeat(64)}` },
      { transactionHash: evidenceTransactionHash },
    ],
    [
      "contradictory symbol",
      { ...transactionWireData(), symbol: "OTHER" },
      { symbol: "TRWA" },
    ],
    [
      "contradictory type",
      { ...transactionWireData(), type: "mint" },
      { type: "transfer" },
    ],
    [
      "before time range",
      { ...transactionWireData(), block_time: 100 },
      { startTime: 101 },
    ],
    [
      "after time range",
      { ...transactionWireData(), block_time: 101 },
      { endTime: 100 },
    ],
    ["malformed amount", { ...transactionWireData(), amount: "1.5" }, {}],
    ["malformed fee", { ...transactionWireData(), fee_amount: -1 }, {}],
    ["malformed block", { ...transactionWireData(), block_number: -1 }, {}],
  ])("rejects %s response data", async (_label, transaction, filters) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successResponse({ total_count: 1, txs: [transaction] }),
    );
    const client = createClient(fetchMock);

    await expect(
      client.queryTransactions({
        chain: "monad",
        address: evidenceWalletAddress,
        ...filters,
      }),
    ).rejects.toBeInstanceOf(CleanverseMalformedResponseError);
  });

  it("rejects a total smaller than the returned page", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successResponse({
        total_count: 0,
        txs: [transactionWireData()],
      }),
    );
    const client = createClient(fetchMock);

    await expect(
      client.queryTransactions({
        chain: "monad",
        address: evidenceWalletAddress,
      }),
    ).rejects.toBeInstanceOf(CleanverseMalformedResponseError);
  });

  it("keeps transaction-query failures free of request and upstream record data", async () => {
    const businessFetch = vi.fn<typeof fetch>();
    businessFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "0002",
          message: "sensitive-transaction-business-message",
          data: {
            txs: [
              {
                from_org_name: "sensitive-organization-marker",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const malformedFetch = vi.fn<typeof fetch>();
    malformedFetch.mockResolvedValue(
      successResponse({
        total_count: 1,
        txs: [
          {
            ...transactionWireData(),
            from_org_name: "sensitive-organization-marker",
            amount: "sensitive-amount-marker",
          },
        ],
      }),
    );
    const input = {
      chain: "monad" as const,
      address: evidenceWalletAddress,
      transactionHash: evidenceTransactionHash,
    };

    const businessError = await createClient(businessFetch)
      .queryTransactions(input)
      .catch((caught: unknown) => caught);
    const malformedError = await createClient(malformedFetch)
      .queryTransactions(input)
      .catch((caught: unknown) => caught);
    const serialized = JSON.stringify([businessError, malformedError]);

    expect(businessError).toBeInstanceOf(CleanverseBusinessError);
    expect(malformedError).toBeInstanceOf(
      CleanverseMalformedResponseError,
    );
    expect(serialized).not.toContain(
      "sensitive-transaction-business-message",
    );
    expect(serialized).not.toContain("sensitive-organization-marker");
    expect(serialized).not.toContain("sensitive-amount-marker");
    expect(serialized).not.toContain(evidenceWalletAddress);
    expect(serialized).not.toContain(evidenceTransactionHash);
  });
});

describe("CleanverseClient.downloadTravelRuleReport", () => {
  it("downloads a transaction report with the minimal documented request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(transactionReportData));
    const client = createClient(fetchMock);

    const result = await client.downloadTravelRuleReport({
      transactionHash: evidenceTransactionHash,
      wallet: {
        chain: "monad",
        address: evidenceWalletAddress,
      },
    });

    expect(result).toEqual({
      requestId: requestIdA,
      data: {
        downloadUrl: transactionReportData.downloadUrl,
        fileName: transactionReportData.fileName,
      },
    });
    expect(result.data).not.toHaveProperty("ignoredUpstreamField");
    expectPlainPost(fetchMock, "download_travel_rule", {
      txHash: evidenceTransactionHash,
      wallet: {
        chain: "monad",
        address: evidenceWalletAddress,
      },
    });
  });

  it("maps optional identity references and propagates the request ID", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(travelRuleReportData));
    const client = createClient(fetchMock);

    const result = await client.downloadTravelRuleReport(
      {
        customerId: "DemoInvestor001",
        cvRecordId: "cv-record-001",
        transactionHash: evidenceTransactionHash,
        wallet: {
          chain: "monad",
          address: evidenceWalletAddress,
        },
      },
      { requestId: requestIdB },
    );

    expect(result.requestId).toBe(requestIdB);
    expect(result.data).toEqual(travelRuleReportData);
    expectPlainPost(
      fetchMock,
      "download_travel_rule",
      {
        customerId: "DemoInvestor001",
        cvRecordId: "cv-record-001",
        txHash: evidenceTransactionHash,
        wallet: {
          chain: "monad",
          address: evidenceWalletAddress,
        },
      },
      requestIdB,
    );
  });

  it.each([
    [
      "short customer ID",
      {
        customerId: "short",
        transactionHash: evidenceTransactionHash,
        wallet: { chain: "monad", address: evidenceWalletAddress },
      },
    ],
    [
      "punctuated customer ID",
      {
        customerId: "Demo-Investor-001",
        transactionHash: evidenceTransactionHash,
        wallet: { chain: "monad", address: evidenceWalletAddress },
      },
    ],
    [
      "blank record ID",
      {
        cvRecordId: " ",
        transactionHash: evidenceTransactionHash,
        wallet: { chain: "monad", address: evidenceWalletAddress },
      },
    ],
    [
      "malformed transaction hash",
      {
        transactionHash: "0x1234",
        wallet: { chain: "monad", address: evidenceWalletAddress },
      },
    ],
    [
      "wrong chain",
      {
        transactionHash: evidenceTransactionHash,
        wallet: { chain: "base", address: evidenceWalletAddress },
      },
    ],
    [
      "malformed wallet",
      {
        transactionHash: evidenceTransactionHash,
        wallet: { chain: "monad", address: "0x1" },
      },
    ],
    [
      "unknown root property",
      {
        transactionHash: evidenceTransactionHash,
        wallet: { chain: "monad", address: evidenceWalletAddress },
        unexpected: true,
      },
    ],
    [
      "unknown wallet property",
      {
        transactionHash: evidenceTransactionHash,
        wallet: {
          chain: "monad",
          address: evidenceWalletAddress,
          unexpected: true,
        },
      },
    ],
  ])("rejects %s before fetch", async (_label, input) => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createClient(fetchMock);
    const operation = client.downloadTravelRuleReport.bind(client) as (
      value: unknown,
    ) => Promise<unknown>;

    await expect(operation(input)).rejects.toBeInstanceOf(
      CleanverseConfigurationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["HTTP URL", "http://reports.example/report.pdf", "report.pdf"],
    [
      "credentialed URL",
      "https://user:pass@reports.example/report.pdf",
      "report.pdf",
    ],
    [
      "fragmented URL",
      "https://reports.example/report.pdf#token",
      "report.pdf",
    ],
    ["empty filename", "https://reports.example/report", ""],
    ["dot filename", "https://reports.example/report", ".."],
    ["path filename", "https://reports.example/report", "folder/report.pdf"],
    [
      "backslash filename",
      "https://reports.example/report",
      "folder\\report.pdf",
    ],
    [
      "control filename",
      "https://reports.example/report",
      "report\u0000.pdf",
    ],
    [
      "oversized filename",
      "https://reports.example/report",
      `${"a".repeat(256)}.pdf`,
    ],
  ])("rejects %s response data", async (_label, downloadUrl, fileName) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successResponse({ downloadUrl, fileName }),
    );
    const client = createClient(fetchMock);

    const error = await client
      .downloadTravelRuleReport({
        transactionHash: evidenceTransactionHash,
        wallet: {
          chain: "monad",
          address: evidenceWalletAddress,
        },
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CleanverseMalformedResponseError);
    expect(JSON.stringify(error)).not.toContain(downloadUrl);
    if (fileName.length > 0) {
      expect(JSON.stringify(error)).not.toContain(fileName);
    }
  });

  it("keeps business failures and network failures free of request and report data", async () => {
    const businessFetch = vi.fn<typeof fetch>();
    businessFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "0002",
          message: "sensitive-upstream-report-message",
          data: {
            downloadUrl: "https://sensitive.example/token",
            fileName: "sensitive-report.pdf",
          },
        }),
        { status: 200 },
      ),
    );
    const networkFetch = vi.fn<typeof fetch>();
    networkFetch.mockRejectedValue(
      new Error("sensitive-network-report-marker"),
    );
    const input = {
      customerId: "DemoInvestor001",
      cvRecordId: "sensitive-record-id",
      transactionHash: evidenceTransactionHash,
      wallet: {
        chain: "monad" as const,
        address: evidenceWalletAddress,
      },
    };

    const businessError = await createClient(businessFetch)
      .downloadTravelRuleReport(input)
      .catch((caught: unknown) => caught);
    const networkError = await createClient(networkFetch)
      .downloadTravelRuleReport(input)
      .catch((caught: unknown) => caught);
    const serialized = JSON.stringify([businessError, networkError]);

    expect(businessError).toBeInstanceOf(CleanverseBusinessError);
    expect(networkError).toBeInstanceOf(CleanverseNetworkError);
    expect(businessFetch).toHaveBeenCalledTimes(1);
    expect(networkFetch).toHaveBeenCalledTimes(1);
    expect(serialized).not.toContain("sensitive-upstream-report-message");
    expect(serialized).not.toContain("https://sensitive.example/token");
    expect(serialized).not.toContain("sensitive-report.pdf");
    expect(serialized).not.toContain("sensitive-record-id");
    expect(serialized).not.toContain(evidenceTransactionHash);
    expect(serialized).not.toContain(evidenceWalletAddress);
    expect(serialized).not.toContain("sensitive-network-report-marker");
  });
});
