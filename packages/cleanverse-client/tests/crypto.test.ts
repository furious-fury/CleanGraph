import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import { resolveCleanverseClientConfig } from "../src/config.js";
import { encryptPayload } from "../src/crypto.js";
import { CleanverseConfigurationError } from "../src/errors.js";

const independentVectorKey = Buffer.from(
  Array.from({ length: 32 }, (_, index) => index),
).toString("base64");

function getEncryptionConfig(apiKey = independentVectorKey) {
  return resolveCleanverseClientConfig({
    apiId: "test-api-id",
    apiKey,
    fetch: async () => new Response(),
  });
}

describe("encryptPayload", () => {
  it("matches the independently verified AES-256-CBC vector", () => {
    const config = getEncryptionConfig();
    const encrypted = encryptPayload(
      { chain: "monad", value: "TRWA" },
      config.aesKey,
      config.aesAlgorithm,
    );

    expect(encrypted).toEqual({
      data: "eFlh276RxYvin6LQw66f/j4Wf+W+2CxlgXMNNlYa2X3x3QM+7zixn7j7ZPkOoCyj",
    });
  });

  it("is deterministic with the documented zero IV", () => {
    const config = getEncryptionConfig();
    const payload = { chain: "monad", amount: "10.5" };

    expect(
      encryptPayload(payload, config.aesKey, config.aesAlgorithm),
    ).toEqual(encryptPayload(payload, config.aesKey, config.aesAlgorithm));
  });

  it("encrypts Unicode payloads without exposing plaintext", () => {
    const config = getEncryptionConfig();
    const plaintextMarker = "T-Bill 世界";
    const encrypted = encryptPayload(
      { label: plaintextMarker },
      config.aesKey,
      config.aesAlgorithm,
    );

    expect(Object.keys(encrypted)).toEqual(["data"]);
    expect(encrypted.data).not.toContain(plaintextMarker);
    expect(() => Buffer.from(encrypted.data, "base64")).not.toThrow();
  });

  it.each([
    undefined,
    () => undefined,
    Symbol("unsupported"),
    { value: 1n },
  ])("rejects payloads that JSON cannot serialize", (payload) => {
    const config = getEncryptionConfig();

    expect(() =>
      encryptPayload(payload, config.aesKey, config.aesAlgorithm),
    ).toThrow(CleanverseConfigurationError);
  });
});
