import { Buffer } from "node:buffer";
import { createDecipheriv } from "node:crypto";

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
  demoDocumentHash,
  demoTransactionHash,
  demoWalletAddress,
  fullGenerateAPassInput,
  generateAPassResponseData,
  minimalGenerateAPassInput,
} from "./fixtures/apass.js";

const requestIdA = "123e4567-e89b-42d3-a456-426614174000";
const requestIdB = "223e4567-e89b-42d3-a456-426614174000";
const decodedKey = Buffer.alloc(32, 7);
const apiKey = decodedKey.toString("base64");

function successResponse(data: unknown = generateAPassResponseData()) {
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

describe("CleanverseClient.generateAPass", () => {
  it("sends the minimal request through the encrypted endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse());
    const client = createClient(fetchMock);
    const input = minimalGenerateAPassInput();

    const result = await client.generateAPass(input, {
      requestId: requestIdB,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    const decrypted = decryptRequestBody(init?.body);

    expect(url).toBe(
      `${CLEANVERSE_SANDBOX_BASE_URL}/generate_apass`,
    );
    expect(init?.method).toBe("POST");
    expect(headers.get("api-id")).toBe("test-api-id");
    expect(headers.get("X-Request-ID")).toBe(requestIdB);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(Object.keys(decrypted.envelope)).toEqual(["data"]);
    expect(decrypted.body).toEqual({
      ...input,
      identityDataList: [...input.identityDataList],
      override: false,
    });
    expect(result).toEqual({
      requestId: requestIdB,
      data: {
        customerId: "DemoInvestor001",
        cvRecordId: "cv-record-001",
        tier: "3",
        wallet: {
          operation: "update",
          address: demoWalletAddress,
          chain: "monad",
          transactionHash: demoTransactionHash,
          depositUsdcWallet:
            "0x1111111111111111111111111111111111111111",
          depositUsdtWallet:
            "0x2222222222222222222222222222222222222222",
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("discard");
  });

  it("encrypts the exact full supported wire shape with explicit override", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse());
    const client = createClient(fetchMock);
    const input = fullGenerateAPassInput();

    await client.generateAPass(input);

    const [, init] = fetchMock.mock.calls[0]!;
    const serializedBody = String(init?.body);
    const decrypted = decryptRequestBody(init?.body);

    expect(decrypted.body).toEqual(input);
    expect(Object.keys(decrypted.body)).toEqual([
      "customerId",
      "kycSource",
      "kycId",
      "subTier",
      "subGroup",
      "override",
      "expirationTime",
      "wallet",
      "identityDataList",
    ]);
    expect(decrypted.body).not.toHaveProperty("bankAccountList");
    expect(decrypted.body).not.toHaveProperty("tier");
    expect(decrypted.body).not.toHaveProperty("group");
    expect(decrypted.plaintext).not.toContain("undefined");
    expect(serializedBody).not.toContain(input.customerId);
    expect(serializedBody).not.toContain("Demo Investor");
    expect(serializedBody).not.toContain(input.wallet.address);
    expect(serializedBody).not.toContain("fictional-provider");
    expect(serializedBody).not.toContain(demoDocumentHash);
  });

  it("uses a generated request ID when none is supplied", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse());
    const requestIdFactory = vi.fn<() => string>(() => requestIdA);
    const client = createClient(fetchMock, { requestIdFactory });

    const result = await client.generateAPass(
      minimalGenerateAPassInput(),
    );
    const [, init] = fetchMock.mock.calls[0]!;

    expect(result.requestId).toBe(requestIdA);
    expect(new Headers(init?.headers).get("X-Request-ID")).toBe(
      requestIdA,
    );
    expect(requestIdFactory).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid input before encryption or fetch", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createClient(fetchMock);
    const input = {
      ...minimalGenerateAPassInput(),
      bankAccountList: [
        {
          bankAccount: "sensitive-bank-account",
        },
      ],
    };

    const error = await client
      .generateAPass(input)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CleanverseConfigurationError);
    expect(JSON.stringify(error)).not.toContain(
      "sensitive-bank-account",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retry the explicit override-required business response", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "1000",
          message: "sensitive-overwrite-warning",
          data: {
            customerId: "sensitive-customer-marker",
          },
        }),
        { status: 200 },
      ),
    );
    const client = createClient(fetchMock);

    const error = await client
      .generateAPass(minimalGenerateAPassInput())
      .catch((caught: unknown) => caught);
    const serialized = JSON.stringify(error);

    expect(error).toBeInstanceOf(CleanverseBusinessError);
    expect(error).toMatchObject({ cleanverseCode: "1000" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(serialized).not.toContain("sensitive-overwrite-warning");
    expect(serialized).not.toContain("sensitive-customer-marker");
    expect(serialized).not.toContain("DemoInvestor001");
  });

  it("maps invalid response data without retaining identity markers", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      successResponse({
        ...generateAPassResponseData(),
        customerId: "DifferentCustomer001",
        rawIdentity: "sensitive-identity-marker",
        rawBank: "sensitive-bank-marker",
      }),
    );
    const client = createClient(fetchMock);

    const error = await client
      .generateAPass(minimalGenerateAPassInput())
      .catch((caught: unknown) => caught);
    const serialized = JSON.stringify(error);

    expect(error).toBeInstanceOf(CleanverseMalformedResponseError);
    expect(serialized).not.toContain("sensitive-identity-marker");
    expect(serialized).not.toContain("sensitive-bank-marker");
    expect(serialized).not.toContain("DifferentCustomer001");
  });

  it("maps network failures without retaining the request payload", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockRejectedValue(
      new Error("sensitive-network-response-marker"),
    );
    const client = createClient(fetchMock);

    const error = await client
      .generateAPass(minimalGenerateAPassInput())
      .catch((caught: unknown) => caught);
    const serialized = JSON.stringify(error);

    expect(error).toBeInstanceOf(CleanverseNetworkError);
    expect(serialized).not.toContain("sensitive-network-response-marker");
    expect(serialized).not.toContain("DemoInvestor001");
    expect(serialized).not.toContain(demoWalletAddress);
  });
});
