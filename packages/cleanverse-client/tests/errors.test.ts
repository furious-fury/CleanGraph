import { describe, expect, it } from "vitest";

import {
  CleanverseBusinessError,
  CleanverseConfigurationError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
} from "../src/index.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

describe("Cleanverse errors", () => {
  it.each([
    [408, true],
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
    [404, false],
  ])("marks HTTP %i retryable=%s", (status, retryable) => {
    const error = new CleanverseHttpError(requestId, status);

    expect(error.retryable).toBe(retryable);
    expect(error.status).toBe(status);
  });

  it("uses the expected retry policy for non-HTTP errors", () => {
    expect(new CleanverseTimeoutError(requestId).retryable).toBe(true);
    expect(new CleanverseNetworkError(requestId).retryable).toBe(true);
    expect(
      new CleanverseMalformedResponseError(requestId).retryable,
    ).toBe(false);
    expect(
      new CleanverseBusinessError(requestId, "1001").retryable,
    ).toBe(false);
    expect(new CleanverseConfigurationError("Invalid config").retryable).toBe(
      false,
    );
  });

  it("serializes only safe metadata", () => {
    const secretMarker = "secret-api-key";
    const plaintextMarker = "sensitive-identity-payload";
    const responseMarker = "raw-upstream-response";
    const cause = new Error(
      `${secretMarker}:${plaintextMarker}:${responseMarker}`,
    );
    const error = new CleanverseNetworkError(requestId, cause);
    const serialized = JSON.stringify(error);

    expect(serialized).toContain(requestId);
    expect(serialized).not.toContain(secretMarker);
    expect(serialized).not.toContain(plaintextMarker);
    expect(serialized).not.toContain(responseMarker);
    expect(error.cause).toBe(cause);
  });

  it("exposes only the Cleanverse business code", () => {
    const error = new CleanverseBusinessError(requestId, "3001");

    expect(error.toJSON()).toMatchObject({
      code: "CLEANVERSE_BUSINESS_ERROR",
      cleanverseCode: "3001",
      requestId,
      retryable: false,
    });
  });
});
