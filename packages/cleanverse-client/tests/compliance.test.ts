import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import {
  CLEANVERSE_SANDBOX_BASE_URL,
  CleanverseClient,
  CleanverseConfigurationError,
  CleanverseMalformedResponseError,
  type APassVerificationOutcome,
  type CleanverseClientConfig,
} from "../src/index.js";
import {
  activeAPassData,
  atokenRulesData,
  frozenAPassData,
  verificationData,
} from "./fixtures/compliance.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const apiKey = Buffer.alloc(32, 7).toString("base64");
const walletAddress = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const atokenAddress = "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb";

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
    requestIdFactory: () => requestId,
    ...overrides,
  });
}

function expectPlainPost(
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
  path: string,
  body: unknown,
): void {
  const [input, init] = fetchMock.mock.calls[0]!;
  const headers = new Headers(init?.headers);

  expect(input).toBe(`${CLEANVERSE_SANDBOX_BASE_URL}/${path}`);
  expect(init?.method).toBe("POST");
  expect(init?.body).toBe(JSON.stringify(body));
  expect(headers.get("Content-Type")).toBe("application/json");
  expect(headers.get("X-Request-ID")).toBe(requestId);
}

describe("CleanverseClient compliance reads", () => {
  it("queries and normalizes an active A-Pass", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(activeAPassData));
    const client = createClient(fetchMock);

    const result = await client.queryAPass(
      {
        chain: "monad",
        address: walletAddress,
      },
      { requestId },
    );

    expect(result).toEqual({
      requestId,
      data: {
        cvRecordId: "cv-record-001",
        tier: "30",
        subTier: 12,
        statusCode: 1,
        status: "ACTIVE",
        expirationTime: 1_863_690_034,
        group: "II",
        subGroup: "AI",
        currentKycHash:
          "3557683c1e62fb7dc8ef438e81cb4ffdf4c6077f8616ce759ac2fff850ba31d9",
        countries: ["GB", "US"],
      },
    });
    expect(result.data).not.toHaveProperty("ignoredUpstreamField");
    expectPlainPost(fetchMock, "query_apass", {
      chain: "monad",
      address: walletAddress,
    });
  });

  it("normalizes a frozen A-Pass with no country tags", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(frozenAPassData));
    const client = createClient(fetchMock);

    const result = await client.queryAPass({
      chain: "monad",
      address: walletAddress,
    });

    expect(result.data).toMatchObject({
      statusCode: 2,
      status: "FROZEN",
      countries: [],
    });
  });

  it("queries and normalizes allowlist and blacklist A-Token rules", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(atokenRulesData));
    const client = createClient(fetchMock);

    const result = await client.queryATokenRules(
      {
        chain: "monad",
        atokenAddress,
      },
      { requestId },
    );

    expect(result).toEqual({
      requestId,
      data: {
        chain: "monad",
        atokenAddress,
        rules: [
          {
            allowedGroup: "II",
            allowedSubGroup: "AI",
            minTier: 20,
            minSubTier: 10,
            isBlackList: false,
            countries: ["US", "GB", "DE", "SG"],
          },
          {
            allowedGroup: "",
            allowedSubGroup: "",
            minTier: 0,
            minSubTier: 0,
            isBlackList: true,
            countries: ["BR"],
          },
        ],
      },
    });
    expect(result.data).not.toHaveProperty("ignoredUpstreamField");
    expect(result.data.rules[0]).not.toHaveProperty("ignoredRuleField");
    expectPlainPost(fetchMock, "atoken/rules", {
      chain: "monad",
      atoken_address: atokenAddress,
    });
  });

  it.each<[1 | 2 | 3 | 4, APassVerificationOutcome]>([
    [1, "ATOKEN_NOT_FOUND"],
    [2, "APASS_MISSING"],
    [3, "APASS_NOT_ELIGIBLE"],
    [4, "ELIGIBLE"],
  ])("maps verification code %i to %s", async (code, outcome) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(verificationData(code)));
    const client = createClient(fetchMock);

    const result = await client.verifyAPassForToken(
      {
        chain: "monad",
        atokenAddress,
        address: walletAddress,
      },
      { requestId },
    );

    expect(result).toEqual({
      requestId,
      data: {
        chain: "monad",
        atokenAddress,
        address: walletAddress,
        verificationCode: code,
        outcome,
        message: `sanitized verification result ${code}`,
        registrationUrl:
          "https://register.cleanverse.example/apass/sanitized",
      },
    });
    expect(result.data).not.toHaveProperty("ignoredUpstreamField");
    expectPlainPost(fetchMock, "verify_apass", {
      chain: "monad",
      atoken: atokenAddress,
      address: walletAddress,
    });
  });
});

describe("CleanverseClient compliance contract validation", () => {
  it.each([
    {
      method: "queryAPass",
      input: { chain: "base", address: walletAddress },
    },
    {
      method: "queryAPass",
      input: { chain: "monad", address: "0x1234" },
    },
    {
      method: "queryAPass",
      input: {
        chain: "monad",
        address: walletAddress,
        unexpected: true,
      },
    },
    {
      method: "queryATokenRules",
      input: { chain: "monad", atokenAddress: "not-an-address" },
    },
    {
      method: "verifyAPassForToken",
      input: {
        chain: "monad",
        atokenAddress,
        address: walletAddress,
        unexpected: true,
      },
    },
  ])("rejects invalid $method input before fetch", async ({ method, input }) => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createClient(fetchMock);
    const operation = (
      client[method as keyof Pick<
        CleanverseClient,
        "queryAPass" | "queryATokenRules" | "verifyAPassForToken"
      >] as (value: unknown) => Promise<unknown>
    ).bind(client);

    await expect(operation(input)).rejects.toBeInstanceOf(
      CleanverseConfigurationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      method: "queryAPass",
      data: { ...activeAPassData, countries: ["gb"] },
    },
    {
      method: "queryAPass",
      data: { ...activeAPassData, status: 3 },
    },
    {
      method: "queryATokenRules",
      data: { ...atokenRulesData, atoken_address: walletAddress },
    },
    {
      method: "queryATokenRules",
      data: {
        ...atokenRulesData,
        rules: [{ ...atokenRulesData.rules[0], min_tier: 100 }],
      },
    },
    {
      method: "verifyAPassForToken",
      data: { ...verificationData(4), code: 5 },
    },
    {
      method: "verifyAPassForToken",
      data: { ...verificationData(4), address: atokenAddress },
    },
    {
      method: "verifyAPassForToken",
      data: { ...verificationData(4), atoken: walletAddress },
    },
    {
      method: "verifyAPassForToken",
      data: { ...verificationData(4), chain: "base" },
    },
  ])("rejects malformed $method response data", async ({ method, data }) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(data));
    const client = createClient(fetchMock);
    const operations = {
      queryAPass: () =>
        client.queryAPass({ chain: "monad", address: walletAddress }),
      queryATokenRules: () =>
        client.queryATokenRules({ chain: "monad", atokenAddress }),
      verifyAPassForToken: () =>
        client.verifyAPassForToken({
          chain: "monad",
          atokenAddress,
          address: walletAddress,
        }),
    };

    await expect(
      operations[method as keyof typeof operations](),
    ).rejects.toBeInstanceOf(CleanverseMalformedResponseError);
  });

  it("does not retain sensitive upstream values in malformed errors", async () => {
    const sensitiveData = {
      ...verificationData(4),
      code: 99,
      message: "sensitive-upstream-message",
      magickLink: "https://sensitive.example/registration-token",
      identity: "sensitive-wallet-payload",
      currentKycHash: "sensitive-kyc-hash",
    };
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse(sensitiveData));
    const client = createClient(fetchMock);

    const error = await client
      .verifyAPassForToken({
        chain: "monad",
        atokenAddress,
        address: walletAddress,
      })
      .catch((caught: unknown) => caught);
    const serializedError = JSON.stringify(error);

    expect(error).toBeInstanceOf(CleanverseMalformedResponseError);
    expect(serializedError).not.toContain("sensitive-upstream-message");
    expect(serializedError).not.toContain("registration-token");
    expect(serializedError).not.toContain("sensitive-wallet-payload");
    expect(serializedError).not.toContain("sensitive-kyc-hash");
    expect(serializedError).not.toContain(walletAddress);
  });
});
