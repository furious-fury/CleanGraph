import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  CLEANVERSE_SANDBOX_BASE_URL,
  CleanverseBusinessError,
  CleanverseClient,
  CleanverseConfigurationError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
  type CleanverseClientConfig,
  type CleanverseResponse,
} from "../src/index.js";

const requestIdA = "123e4567-e89b-42d3-a456-426614174000";
const requestIdB = "223e4567-e89b-42d3-a456-426614174000";
const apiKey = Buffer.alloc(32, 7).toString("base64");
const responseDataSchema = z.object({
  allowed: z.boolean(),
});

type PlainCallOptions<T> = {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  requestId?: string;
  dataSchema: z.ZodType<T>;
};

type EncryptedCallOptions<T> = {
  path: string;
  body: unknown;
  requestId?: string;
  dataSchema: z.ZodType<T>;
};

class TestCleanverseClient extends CleanverseClient {
  plain<T>(
    options: PlainCallOptions<T>,
  ): Promise<CleanverseResponse<T>> {
    return this.requestPlain(options);
  }

  encrypted<T>(
    options: EncryptedCallOptions<T>,
  ): Promise<CleanverseResponse<T>> {
    return this.requestEncrypted(options);
  }
}

function successResponse(data: unknown = { allowed: true }): Response {
  return new Response(
    JSON.stringify({
      code: "0000",
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
): TestCleanverseClient {
  return new TestCleanverseClient({
    apiId: "test-api-id",
    apiKey,
    fetch: fetchImplementation,
    requestIdFactory: () => requestIdA,
    ...overrides,
  });
}

describe("CleanverseClient transport", () => {
  it("uses the sandbox base URL and sends authenticated JSON headers", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse());
    const client = createClient(fetchMock);

    const result = await client.plain({
      path: "/verify_apass",
      method: "POST",
      body: { chain: "monad" },
      dataSchema: responseDataSchema,
    });

    expect(result).toEqual({
      requestId: requestIdA,
      data: { allowed: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [input, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(input).toBe(`${CLEANVERSE_SANDBOX_BASE_URL}/verify_apass`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ chain: "monad" }));
    expect(headers.get("api-id")).toBe("test-api-id");
    expect(headers.get("X-Request-ID")).toBe(requestIdA);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("preserves a valid caller request ID", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse());
    const client = createClient(fetchMock);

    const result = await client.plain({
      path: "query_apass",
      method: "POST",
      body: {},
      requestId: requestIdB,
      dataSchema: responseDataSchema,
    });
    const [, init] = fetchMock.mock.calls[0]!;

    expect(result.requestId).toBe(requestIdB);
    expect(new Headers(init?.headers).get("X-Request-ID")).toBe(requestIdB);
  });

  it("generates a distinct request ID for each operation", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation(async () => successResponse());
    const requestIdFactory = vi
      .fn<() => string>()
      .mockReturnValueOnce(requestIdA)
      .mockReturnValueOnce(requestIdB);
    const client = createClient(fetchMock, { requestIdFactory });

    const first = await client.plain({
      path: "query_apass",
      method: "POST",
      body: {},
      dataSchema: responseDataSchema,
    });
    const second = await client.plain({
      path: "atoken/rules",
      method: "POST",
      body: {},
      dataSchema: responseDataSchema,
    });

    expect(first.requestId).toBe(requestIdA);
    expect(second.requestId).toBe(requestIdB);
    expect(requestIdFactory).toHaveBeenCalledTimes(2);
  });

  it("sends GET requests without a body or content type", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse());
    const client = createClient(fetchMock);

    await client.plain({
      path: `atoken/query_apply_status/${requestIdA}`,
      method: "GET",
      dataSchema: responseDataSchema,
    });
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);

    expect(init?.body).toBeUndefined();
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("encrypts protected request bodies without exposing plaintext", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse());
    const client = createClient(fetchMock);
    const plaintextMarker = "sensitive-identity-marker";

    await client.encrypted({
      path: "generate_apass",
      body: { identity: plaintextMarker },
      dataSchema: responseDataSchema,
    });
    const [, init] = fetchMock.mock.calls[0]!;
    const serializedBody = String(init?.body);
    const parsedBody = JSON.parse(serializedBody) as Record<string, unknown>;

    expect(Object.keys(parsedBody)).toEqual(["data"]);
    expect(parsedBody.data).toBeTypeOf("string");
    expect(serializedBody).not.toContain(plaintextMarker);
  });

  it.each([
    "https://evil.example/verify_apass",
    "//evil.example/verify_apass",
    "",
    "../verify_apass",
    "atoken/../verify_apass",
    "atoken/%2e%2e/verify_apass",
    "atoken/..%2fverify_apass",
    "verify_apass#fragment",
    " verify_apass",
    "verify_apass\\nested",
  ])("rejects unsafe endpoint path %j", async (path) => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createClient(fetchMock);

    await expect(
      client.plain({
        path,
        method: "POST",
        body: {},
        dataSchema: responseDataSchema,
      }),
    ).rejects.toBeInstanceOf(CleanverseConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects GET request bodies", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createClient(fetchMock);

    await expect(
      client.plain({
        path: "query",
        method: "GET",
        body: {},
        dataSchema: responseDataSchema,
      }),
    ).rejects.toBeInstanceOf(CleanverseConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid caller and generated request IDs", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const invalidFactoryClient = createClient(fetchMock, {
      requestIdFactory: () => "not-a-uuid",
    });
    const client = createClient(fetchMock);

    await expect(
      client.plain({
        path: "query",
        method: "POST",
        requestId: "not-a-uuid",
        body: {},
        dataSchema: responseDataSchema,
      }),
    ).rejects.toBeInstanceOf(CleanverseConfigurationError);
    await expect(
      invalidFactoryClient.plain({
        path: "query",
        method: "POST",
        body: {},
        dataSchema: responseDataSchema,
      }),
    ).rejects.toBeInstanceOf(CleanverseConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CleanverseClient failure mapping", () => {
  it("maps an elapsed deadline to a timeout without retrying", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const client = createClient(fetchMock, { timeoutMs: 5 });

    await expect(
      client.plain({
        path: "query",
        method: "POST",
        body: {},
        dataSchema: responseDataSchema,
      }),
    ).rejects.toBeInstanceOf(CleanverseTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the timeout active while reading the response body", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async (_input, init) =>
        ({
          ok: true,
          status: 200,
          json: () =>
            new Promise<unknown>((_resolve, reject) => {
              init?.signal?.addEventListener(
                "abort",
                () => reject(new DOMException("Aborted", "AbortError")),
                { once: true },
              );
            }),
        }) as Response,
    );
    const client = createClient(fetchMock, { timeoutMs: 5 });

    await expect(
      client.plain({
        path: "query",
        method: "POST",
        body: {},
        dataSchema: responseDataSchema,
      }),
    ).rejects.toBeInstanceOf(CleanverseTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a fetch rejection to a network error without retrying", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockRejectedValue(new Error("connection failed"));
    const client = createClient(fetchMock);

    await expect(
      client.plain({
        path: "query",
        method: "POST",
        body: {},
        dataSchema: responseDataSchema,
      }),
    ).rejects.toBeInstanceOf(CleanverseNetworkError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([401, 408, 429, 500, 503])(
    "maps HTTP %i to an HTTP error without retrying",
    async (status) => {
      const fetchMock = vi.fn<typeof fetch>();
      fetchMock.mockResolvedValue(
        new Response("raw-upstream-response", { status }),
      );
      const client = createClient(fetchMock);

      const error = await client
        .plain({
          path: "query",
          method: "POST",
          body: {},
          dataSchema: responseDataSchema,
        })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(CleanverseHttpError);
      expect(JSON.stringify(error)).not.toContain("raw-upstream-response");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("maps invalid JSON to a malformed-response error", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response("not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createClient(fetchMock);

    await expect(
      client.plain({
        path: "query",
        method: "POST",
        body: {},
        dataSchema: responseDataSchema,
      }),
    ).rejects.toBeInstanceOf(CleanverseMalformedResponseError);
  });

  it.each([
    {},
    { code: 0, data: { allowed: true } },
    { data: { allowed: true } },
    { code: "raw sensitive response value", data: { allowed: true } },
  ])("maps malformed envelope %j to a malformed-response error", async (body) => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(body), { status: 200 }),
    );
    const client = createClient(fetchMock);

    await expect(
      client.plain({
        path: "query",
        method: "POST",
        body: {},
        dataSchema: responseDataSchema,
      }),
    ).rejects.toBeInstanceOf(CleanverseMalformedResponseError);
  });

  it("maps a non-success Cleanverse code to a business error", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "3001",
          message: "raw-business-message",
          data: null,
        }),
        { status: 200 },
      ),
    );
    const client = createClient(fetchMock);

    const error = await client
      .plain({
        path: "query",
        method: "POST",
        body: {},
        dataSchema: responseDataSchema,
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CleanverseBusinessError);
    expect(error).toMatchObject({ cleanverseCode: "3001" });
    expect(JSON.stringify(error)).not.toContain("raw-business-message");
  });

  it("rejects endpoint data that fails its Zod schema", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(successResponse({ allowed: "yes" }));
    const client = createClient(fetchMock);

    await expect(
      client.plain({
        path: "query",
        method: "POST",
        body: {},
        dataSchema: responseDataSchema,
      }),
    ).rejects.toBeInstanceOf(CleanverseMalformedResponseError);
  });
});
