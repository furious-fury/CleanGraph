import { Buffer } from "node:buffer";

import { describe, expect, it, vi } from "vitest";

import {
  CLEANVERSE_SANDBOX_BASE_URL,
  DEFAULT_CLEANVERSE_TIMEOUT_MS,
} from "../src/index.js";
import { resolveCleanverseClientConfig } from "../src/config.js";
import { CleanverseConfigurationError } from "../src/errors.js";

const fetchStub = vi.fn<typeof fetch>();

function createApiKey(length: number): string {
  return Buffer.alloc(length, 1).toString("base64");
}

describe("resolveCleanverseClientConfig", () => {
  it.each([
    [16, "aes-128-cbc"],
    [24, "aes-192-cbc"],
    [32, "aes-256-cbc"],
  ] as const)(
    "accepts a %i-byte AES key and selects %s",
    (length, expectedAlgorithm) => {
      const resolved = resolveCleanverseClientConfig({
        apiId: "test-api-id",
        apiKey: createApiKey(length),
        fetch: fetchStub,
      });

      expect(resolved.aesKey).toHaveLength(length);
      expect(resolved.aesAlgorithm).toBe(expectedAlgorithm);
    },
  );

  it("uses the documented sandbox defaults", () => {
    const resolved = resolveCleanverseClientConfig({
      apiId: "test-api-id",
      apiKey: createApiKey(32),
      fetch: fetchStub,
    });

    expect(resolved.baseUrl).toBe(CLEANVERSE_SANDBOX_BASE_URL);
    expect(resolved.timeoutMs).toBe(DEFAULT_CLEANVERSE_TIMEOUT_MS);
  });

  it.each(["", "   ", "api-id\r\ninjected: value"])(
    "rejects invalid API ID %j",
    (apiId) => {
      expect(() =>
        resolveCleanverseClientConfig({
          apiId,
          apiKey: createApiKey(32),
          fetch: fetchStub,
        }),
      ).toThrow(CleanverseConfigurationError);
    },
  );

  it.each([
    "",
    "not-base64",
    "AAAA=",
    "AA_A",
    `${createApiKey(32)}\n`,
  ])("rejects malformed Base64 API key %j", (apiKey) => {
    expect(() =>
      resolveCleanverseClientConfig({
        apiId: "test-api-id",
        apiKey,
        fetch: fetchStub,
      }),
    ).toThrow(CleanverseConfigurationError);
  });

  it.each([1, 15, 17, 23, 25, 31, 33])(
    "rejects a decoded %i-byte AES key",
    (length) => {
      expect(() =>
        resolveCleanverseClientConfig({
          apiId: "test-api-id",
          apiKey: createApiKey(length),
          fetch: fetchStub,
        }),
      ).toThrow(CleanverseConfigurationError);
    },
  );

  it.each([
    "not-a-url",
    "http://uatapi.cleanverse.com/api/cooperate",
    "https://user:pass@uatapi.cleanverse.com/api/cooperate",
    "https://uatapi.cleanverse.com/api/cooperate?debug=true",
    "https://uatapi.cleanverse.com/api/cooperate#fragment",
  ])("rejects unsafe base URL %s", (baseUrl) => {
    expect(() =>
      resolveCleanverseClientConfig({
        apiId: "test-api-id",
        apiKey: createApiKey(32),
        baseUrl,
        fetch: fetchStub,
      }),
    ).toThrow(CleanverseConfigurationError);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid timeout %s",
    (timeoutMs) => {
      expect(() =>
        resolveCleanverseClientConfig({
          apiId: "test-api-id",
          apiKey: createApiKey(32),
          timeoutMs,
          fetch: fetchStub,
        }),
      ).toThrow(CleanverseConfigurationError);
    },
  );
});
