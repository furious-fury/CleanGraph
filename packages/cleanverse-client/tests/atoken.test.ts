import { Buffer } from "node:buffer";
import { createDecipheriv } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  CLEANVERSE_SANDBOX_BASE_URL,
  CleanverseBusinessError,
  CleanverseClient,
  CleanverseConfigurationError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanversePollingExhaustedError,
  type CleanverseClientConfig,
} from "../src/index.js";
import {
  applicationData,
  demoATokenAddress,
  demoAdminAddress,
  demoApplicationRequestId,
  demoTransactionHash,
  fullLaunchATokenInput,
  launchATokenResponseData,
  minimalLaunchATokenInput,
} from "./fixtures/atoken.js";

const requestIdA = "123e4567-e89b-42d3-a456-426614174000";
const requestIdB = "223e4567-e89b-42d3-a456-426614174000";
const decodedKey = Buffer.alloc(32, 7);
const apiKey = decodedKey.toString("base64");

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

function decryptRequestBody(serializedBody: BodyInit | null | undefined) {
  const envelope = JSON.parse(String(serializedBody)) as {
    data: string;
  };
  const decipher = createDecipheriv(
    "aes-256-cbc",
    decodedKey,
    Buffer.alloc(16),
  );
  const plaintext = Buffer.concat([
    decipher.update(envelope.data, "base64"),
    decipher.final(),
  ]).toString("utf8");

  return {
    envelope,
    plaintext,
    body: JSON.parse(plaintext) as Record<string, unknown>,
  };
}

describe("CleanverseClient.launchAToken", () => {
  it("sends the exact encrypted launch contract with deterministic rule defaults", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successResponse(launchATokenResponseData()),
    );
    const client = createClient(fetchMock);

    const result = await client.launchAToken(
      minimalLaunchATokenInput(),
      { requestId: requestIdB },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    const decrypted = decryptRequestBody(init?.body);

    expect(url).toBe(
      `${CLEANVERSE_SANDBOX_BASE_URL}/atoken/launch`,
    );
    expect(init?.method).toBe("POST");
    expect(headers.get("api-id")).toBe("test-api-id");
    expect(headers.get("X-Request-ID")).toBe(requestIdB);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(Object.keys(decrypted.envelope)).toEqual(["data"]);
    expect(decrypted.body).toEqual({
      chain: "monad",
      token_name: "Tokenized Real-World Asset",
      token_symbol: "TRWA",
      decimals: 18,
      admin_address: demoAdminAddress,
      rule: {
        allowed_group: "II",
        allowed_sub_group: "AI",
        min_tier: 0,
        min_sub_tier: 0,
        is_black_list: false,
        countries: [],
      },
      icon: "https://assets.example.com/trwa.svg",
    });
    expect(result).toEqual({
      requestId: requestIdB,
      data: {
        applicationRequestId: demoApplicationRequestId,
        issueAssetId: 28,
      },
    });
    expect(result.data).not.toHaveProperty("ignoredUpstreamField");
  });

  it("encrypts the full allowlist and callback contract without leaking metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successResponse(launchATokenResponseData()),
    );
    const client = createClient(fetchMock);
    const input = fullLaunchATokenInput();

    await client.launchAToken(input);

    const [, init] = fetchMock.mock.calls[0]!;
    const serializedBody = String(init?.body);
    const decrypted = decryptRequestBody(init?.body);

    expect(decrypted.body).toEqual({
      chain: "monad",
      token_name: input.tokenName,
      token_symbol: input.tokenSymbol,
      decimals: input.decimals,
      admin_address: input.adminAddress,
      rule: {
        allowed_group: input.rule.allowedGroup,
        allowed_sub_group: input.rule.allowedSubGroup,
        min_tier: input.rule.minTier,
        min_sub_tier: input.rule.minSubTier,
        is_black_list: input.rule.isBlackList,
        countries: input.rule.countries,
      },
      icon: input.icon,
      callback_url: input.callbackUrl,
    });
    expect(serializedBody).not.toContain(input.tokenName);
    expect(serializedBody).not.toContain(input.tokenSymbol);
    expect(serializedBody).not.toContain(input.adminAddress);
    expect(serializedBody).not.toContain(input.icon);
    expect(serializedBody).not.toContain("US");
    expect(serializedBody).not.toContain(input.callbackUrl);
  });

  it.each([
    ["wrong chain", { chain: "base" }],
    ["blank name", { tokenName: " " }],
    ["padded symbol", { tokenSymbol: " TRWA" }],
    ["fractional decimals", { decimals: 18.5 }],
    ["negative decimals", { decimals: -1 }],
    ["oversized decimals", { decimals: 256 }],
    ["invalid admin", { adminAddress: "0x1234" }],
    ["invalid icon protocol", { icon: "file:///tmp/trwa.svg" }],
    [
      "invalid callback protocol",
      { callbackUrl: "ftp://api.example.com/callback" },
    ],
    ["long callback", { callbackUrl: `https://example.com/${"a".repeat(500)}` }],
    ["unknown root field", { unexpected: true }],
  ])("rejects %s before encryption or fetch", async (_label, change) => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createClient(fetchMock);

    await expect(
      client.launchAToken({
        ...minimalLaunchATokenInput(),
        ...change,
      }),
    ).rejects.toBeInstanceOf(CleanverseConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["one-character group", { allowedGroup: "I" }],
    ["three-character subgroup", { allowedSubGroup: "AII" }],
    ["fractional tier", { minTier: 1.5 }],
    ["negative tier", { minTier: -1 }],
    ["oversized sub-tier", { minSubTier: 100 }],
    ["lowercase country", { countries: ["gb"] }],
    ["unknown country", { countries: ["XX"] }],
    ["duplicate countries", { countries: ["GB", "GB"] }],
    ["unknown rule field", { unknownRule: true }],
  ])("rejects rule with %s before fetch", async (_label, ruleChange) => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createClient(fetchMock);
    const input = minimalLaunchATokenInput();

    await expect(
      client.launchAToken({
        ...input,
        rule: {
          ...input.rule,
          ...ruleChange,
        },
      }),
    ).rejects.toBeInstanceOf(CleanverseConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { requestId: "not-an-application-id", issueAssetId: 28 },
    { requestId: demoApplicationRequestId, issueAssetId: 0 },
    { requestId: demoApplicationRequestId, issueAssetId: "28" },
  ])("rejects malformed launch response data", async (data) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(data));
    const client = createClient(fetchMock);

    await expect(
      client.launchAToken(minimalLaunchATokenInput()),
    ).rejects.toBeInstanceOf(CleanverseMalformedResponseError);
  });
});

describe("CleanverseClient.queryATokenApplication", () => {
  it("queries the application with a bodyless GET and normalizes issued evidence", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successResponse(applicationData("ISSUED")),
    );
    const client = createClient(fetchMock);

    const result = await client.queryATokenApplication(
      { applicationRequestId: demoApplicationRequestId },
      { requestId: requestIdB },
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(url).toBe(
      `${CLEANVERSE_SANDBOX_BASE_URL}/atoken/query_apply_status/${demoApplicationRequestId}`,
    );
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(headers.get("Content-Type")).toBeNull();
    expect(headers.get("X-Request-ID")).toBe(requestIdB);
    expect(result).toEqual({
      requestId: requestIdB,
      data: {
        applicationRequestId: demoApplicationRequestId,
        flowType: "LAUNCH",
        status: "ISSUED",
        terminal: true,
        successful: true,
        chain: "monad",
        atokenAddress: demoATokenAddress,
        tokenSymbol: "TRWA",
        transactionHash: demoTransactionHash,
        issuedAt: "2026-08-08 12:05:00",
        callback: {
          url: "https://api.example.com/webhooks/cleanverse/atoken",
          status: "SUCCESS",
          attempts: 1,
          lastErrorPresent: false,
        },
      },
    });
    expect(result.data).not.toHaveProperty("ignoredUpstreamField");
  });

  it.each(["PENDING", "APPROVED", "ISSUING"] as const)(
    "normalizes non-terminal %s without reporting success",
    async (status) => {
      const fetchMock = vi.fn<typeof fetch>();
      fetchMock.mockResolvedValue(
        successResponse(applicationData(status)),
      );
      const client = createClient(fetchMock);

      const result = await client.queryATokenApplication({
        applicationRequestId: demoApplicationRequestId,
      });

      expect(result.data).toMatchObject({
        status,
        terminal: false,
        successful: false,
      });
      expect(result.data).not.toHaveProperty("failure");
    },
  );

  it.each([
    [
      "REJECTED",
      "APPLICATION_REJECTED",
      "sensitive-upstream-rejection-marker",
    ],
    [
      "ISSUE_FAILED",
      "ISSUANCE_FAILED",
      "sensitive-upstream-issuance-marker",
    ],
  ] as const)(
    "normalizes terminal %s without exposing its raw reason",
    async (status, failureCode, sensitiveMarker) => {
      const fetchMock = vi.fn<typeof fetch>();
      fetchMock.mockResolvedValue(
        successResponse(applicationData(status)),
      );
      const client = createClient(fetchMock);

      const result = await client.queryATokenApplication({
        applicationRequestId: demoApplicationRequestId,
      });
      const serialized = JSON.stringify(result);

      expect(result.data).toMatchObject({
        status,
        terminal: true,
        successful: false,
        failure: {
          code: failureCode,
          upstreamReasonPresent: true,
        },
      });
      expect(serialized).not.toContain(sensitiveMarker);
      expect(serialized).not.toContain(
        "sensitive-callback-error-marker",
      );
    },
  );

  it.each([
    {
      label: "invalid local application ID",
      input: { applicationRequestId: "../unsafe" },
      data: applicationData("PENDING"),
    },
    {
      label: "unknown local field",
      input: {
        applicationRequestId: demoApplicationRequestId,
        extra: true,
      },
      data: applicationData("PENDING"),
    },
  ])("rejects $label before fetch", async ({ input, data }) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(data));
    const client = createClient(fetchMock);

    await expect(
      client.queryATokenApplication(input),
    ).rejects.toBeInstanceOf(CleanverseConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      ...applicationData("PENDING"),
      requestId: "IA20260808120000999999",
    },
    { ...applicationData("PENDING"), chain: "base" },
    { ...applicationData("PENDING"), applyStatus: "UNKNOWN" },
    {
      ...applicationData("ISSUED"),
      atokenAddress: undefined,
    },
    { ...applicationData("ISSUED"), txHash: "0x1234" },
    {
      ...applicationData("REJECTED"),
      rejectReason: " ",
    },
    {
      ...applicationData("ISSUE_FAILED"),
      issueErrorMsg: "",
    },
  ])("rejects malformed or mismatched status data", async (data) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(data));
    const client = createClient(fetchMock);

    const error = await client
      .queryATokenApplication({
        applicationRequestId: demoApplicationRequestId,
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CleanverseMalformedResponseError);
    expect(JSON.stringify(error)).not.toContain(
      "sensitive-upstream",
    );
  });
});

describe("CleanverseClient.pollATokenApplication", () => {
  it("polls successful non-terminal states until ISSUED", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock
      .mockResolvedValueOnce(
        successResponse(applicationData("PENDING")),
      )
      .mockResolvedValueOnce(
        successResponse(applicationData("APPROVED")),
      )
      .mockResolvedValueOnce(
        successResponse(applicationData("ISSUED")),
      );
    const client = createClient(fetchMock);

    const result = await client.pollATokenApplication(
      { applicationRequestId: demoApplicationRequestId },
      {
        requestId: requestIdB,
        maxAttempts: 5,
        intervalMs: 0,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      attempts: 3,
      responseRequestId: requestIdB,
      application: {
        status: "ISSUED",
        terminal: true,
        successful: true,
      },
    });
    for (const [, init] of fetchMock.mock.calls) {
      expect(
        new Headers(init?.headers).get("X-Request-ID"),
      ).toBe(requestIdB);
    }
  });

  it.each(["REJECTED", "ISSUE_FAILED"] as const)(
    "stops at terminal failure %s without retrying it",
    async (status) => {
      const fetchMock = vi.fn<typeof fetch>();
      fetchMock.mockResolvedValue(
        successResponse(applicationData(status)),
      );
      const client = createClient(fetchMock);

      const result = await client.pollATokenApplication(
        { applicationRequestId: demoApplicationRequestId },
        { maxAttempts: 5, intervalMs: 0 },
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.application).toMatchObject({
        status,
        terminal: true,
        successful: false,
      });
    },
  );

  it("throws a safe retryable error after the configured attempt bound", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        successResponse(applicationData("APPROVED")),
      ),
    );
    const client = createClient(fetchMock);

    const error = await client
      .pollATokenApplication(
        { applicationRequestId: demoApplicationRequestId },
        {
          requestId: requestIdB,
          maxAttempts: 3,
          intervalMs: 0,
        },
      )
      .catch((caught: unknown) => caught);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(CleanversePollingExhaustedError);
    expect(error).toMatchObject({
      requestId: requestIdB,
      applicationStatus: "APPROVED",
      retryable: true,
    });
    expect(error.toJSON()).toEqual({
      name: "CleanversePollingExhaustedError",
      message:
        "The Cleanverse application did not reach a terminal state within the polling limit.",
      code: "CLEANVERSE_POLLING_EXHAUSTED",
      retryable: true,
      requestId: requestIdB,
      applicationStatus: "APPROVED",
    });
  });

  it.each([
    { maxAttempts: 0 },
    { maxAttempts: 101 },
    { maxAttempts: 1.5 },
    { intervalMs: -1 },
    { intervalMs: 60_001 },
    { intervalMs: 1.5 },
    { requestId: "not-a-uuid" },
    { unknown: true },
  ])("rejects invalid polling options before fetch", async (options) => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createClient(fetchMock);

    await expect(
      client.pollATokenApplication(
        { applicationRequestId: demoApplicationRequestId },
        options,
      ),
    ).rejects.toBeInstanceOf(CleanverseConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retry HTTP or Cleanverse business failures", async () => {
    const httpFetch = vi.fn<typeof fetch>();
    httpFetch.mockResolvedValue(new Response(null, { status: 503 }));
    const businessFetch = vi.fn<typeof fetch>();
    businessFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "12015",
          message: "sensitive-not-found-marker",
          data: "{}",
        }),
        { status: 200 },
      ),
    );

    await expect(
      createClient(httpFetch).pollATokenApplication(
        { applicationRequestId: demoApplicationRequestId },
        { maxAttempts: 5, intervalMs: 0 },
      ),
    ).rejects.toBeInstanceOf(CleanverseHttpError);
    await expect(
      createClient(businessFetch).pollATokenApplication(
        { applicationRequestId: demoApplicationRequestId },
        { maxAttempts: 5, intervalMs: 0 },
      ),
    ).rejects.toBeInstanceOf(CleanverseBusinessError);
    expect(httpFetch).toHaveBeenCalledTimes(1);
    expect(businessFetch).toHaveBeenCalledTimes(1);
  });
});
