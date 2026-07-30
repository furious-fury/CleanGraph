import { randomUUID } from "node:crypto";

import { CleanverseConfigurationError } from "./errors.js";

export const CLEANVERSE_SANDBOX_BASE_URL =
  "https://uatapi.cleanverse.com/api/cooperate";
export const DEFAULT_CLEANVERSE_TIMEOUT_MS = 10_000;

export type CleanverseClientConfig = {
  apiId: string;
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  requestIdFactory?: () => string;
};

export type AesAlgorithm =
  | "aes-128-cbc"
  | "aes-192-cbc"
  | "aes-256-cbc";

export type ResolvedCleanverseClientConfig = {
  apiId: string;
  aesKey: Buffer;
  aesAlgorithm: AesAlgorithm;
  baseUrl: string;
  timeoutMs: number;
  fetch: typeof globalThis.fetch;
  requestIdFactory: () => string;
};

const standardBase64Pattern =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function decodeApiKey(apiKey: string): {
  aesKey: Buffer;
  aesAlgorithm: AesAlgorithm;
} {
  if (
    apiKey.length === 0 ||
    apiKey.length % 4 !== 0 ||
    !standardBase64Pattern.test(apiKey)
  ) {
    throw new CleanverseConfigurationError(
      "The Cleanverse API key must be valid standard Base64.",
    );
  }

  const aesKey = Buffer.from(apiKey, "base64");

  if (aesKey.toString("base64") !== apiKey) {
    throw new CleanverseConfigurationError(
      "The Cleanverse API key must be valid standard Base64.",
    );
  }

  const algorithmByLength: Partial<Record<number, AesAlgorithm>> = {
    16: "aes-128-cbc",
    24: "aes-192-cbc",
    32: "aes-256-cbc",
  };
  const aesAlgorithm = algorithmByLength[aesKey.length];

  if (aesAlgorithm === undefined) {
    throw new CleanverseConfigurationError(
      "The decoded Cleanverse API key must contain 16, 24, or 32 bytes.",
    );
  }

  return { aesKey, aesAlgorithm };
}

function normalizeBaseUrl(baseUrl: string): string {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch {
    throw new CleanverseConfigurationError(
      "The Cleanverse base URL is invalid.",
    );
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new CleanverseConfigurationError(
      "The Cleanverse base URL must use HTTPS without credentials, a query, or a fragment.",
    );
  }

  return url.toString().replace(/\/+$/, "");
}

export function resolveCleanverseClientConfig(
  config: CleanverseClientConfig,
): ResolvedCleanverseClientConfig {
  const apiId = config.apiId.trim();

  if (apiId.length === 0) {
    throw new CleanverseConfigurationError(
      "The Cleanverse API ID must not be empty.",
    );
  }

  try {
    new Headers({ "api-id": apiId });
  } catch {
    throw new CleanverseConfigurationError(
      "The Cleanverse API ID is not a valid HTTP header value.",
    );
  }

  const timeoutMs = config.timeoutMs ?? DEFAULT_CLEANVERSE_TIMEOUT_MS;

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new CleanverseConfigurationError(
      "The Cleanverse timeout must be a positive safe integer.",
    );
  }

  const fetchImplementation = config.fetch ?? globalThis.fetch;

  if (typeof fetchImplementation !== "function") {
    throw new CleanverseConfigurationError(
      "A Fetch API implementation is required.",
    );
  }

  const requestIdFactory = config.requestIdFactory ?? randomUUID;

  if (typeof requestIdFactory !== "function") {
    throw new CleanverseConfigurationError(
      "The Cleanverse request-ID factory must be a function.",
    );
  }

  const { aesKey, aesAlgorithm } = decodeApiKey(config.apiKey);

  return {
    apiId,
    aesKey,
    aesAlgorithm,
    baseUrl: normalizeBaseUrl(
      config.baseUrl ?? CLEANVERSE_SANDBOX_BASE_URL,
    ),
    timeoutMs,
    fetch: fetchImplementation,
    requestIdFactory,
  };
}
