import { Buffer } from "node:buffer";

import {
  preflightDecisionSchema,
  preflightErrorResponseSchema,
  type PreflightErrorCode,
} from "@cleangraph/shared";
import { describe, expect, it, vi } from "vitest";

import { app, createApp } from "../src/app.js";
import type { Environment } from "../src/config/env.js";
import type {
  PreflightEvaluation,
  PreflightService,
} from "../src/services/preflight.js";

const validIntent = {
  chain: "monad",
  sender: "0x1111111111111111111111111111111111111111",
  recipient: "0x2222222222222222222222222222222222222222",
  atokenAddress: "0x3333333333333333333333333333333333333333",
  amount: "10.5",
};
const requestId = "123e4567-e89b-42d3-a456-426614174000";
const checkedAt = "2026-07-31T12:00:00.000Z";
const baseEnvironment: Environment = {
  NODE_ENV: "test",
  PORT: 3000,
  API_CORS_ORIGIN: "http://localhost:5173",
  CLEANVERSE_TIMEOUT_MS: 10_000,
};

function createService(
  evaluation: PreflightEvaluation,
): {
  service: PreflightService;
  evaluate: ReturnType<typeof vi.fn<PreflightService["evaluate"]>>;
} {
  const evaluate = vi.fn<PreflightService["evaluate"]>();
  evaluate.mockResolvedValue(evaluation);

  return {
    service: { evaluate },
    evaluate,
  };
}

function createConfiguredApp(service: PreflightService) {
  return createApp({
    preflightService: service,
    logFailure: vi.fn(),
  });
}

async function requestPreflight(
  testApp: ReturnType<typeof createApp>,
  body: unknown = validIntent,
) {
  return testApp.request("/api/v1/compliance/preflight", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
    body: JSON.stringify(body),
  });
}

describe("CleanGraph API", () => {
  it("reports service health without exposing configuration", async () => {
    const response = await app.request("/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      service: "cleangraph-api",
    });
    expect(response.headers.get("X-Request-ID")).toBeTypeOf("string");
    expect(JSON.stringify(body)).not.toContain("CLEANVERSE_API");
  });

  it("preserves a valid caller request ID", async () => {
    const response = await app.request("/health", {
      headers: {
        "X-Request-ID": requestId,
      },
    });

    expect(response.headers.get("X-Request-ID")).toBe(requestId);
  });

  it("reports degraded readiness when Cleanverse is not configured", async () => {
    const testApp = createApp({
      preflightService: null,
      logFailure: vi.fn(),
    });
    const response = await testApp.request("/ready");
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "degraded",
      checks: {
        cleanverseCredentials: false,
      },
    });
  });

  it("reports ready when the Cleanverse service is available", async () => {
    const { service } = createService({
      kind: "failure",
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
      checks: [],
    });
    const response = await createConfiguredApp(service).request("/ready");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ready",
      checks: {
        cleanverseCredentials: true,
      },
    });
  });

  it.each([
    {
      CLEANVERSE_API_KEY: "not-valid-base64",
    },
    {
      CLEANVERSE_API_KEY: Buffer.alloc(32, 7).toString("base64"),
      CLEANVERSE_BASE_URL: "http://unsafe.example/api",
    },
    {
      CLEANVERSE_API_KEY: Buffer.alloc(32, 7).toString("base64"),
      CLEANVERSE_TIMEOUT_MS: "not-a-number",
    },
  ])(
    "keeps health available but reports degraded readiness for invalid Cleanverse configuration",
    async (invalidConfiguration) => {
      const testApp = createApp({
        environment: {
          ...baseEnvironment,
          CLEANVERSE_API_ID: "test-api-id",
          ...invalidConfiguration,
        },
        logFailure: vi.fn(),
      });
      const healthResponse = await testApp.request("/health");
      const readyResponse = await testApp.request("/ready");

      expect(healthResponse.status).toBe(200);
      expect(readyResponse.status).toBe(503);
    },
  );

  it("constructs the service once valid backend credentials are present", async () => {
    const testApp = createApp({
      environment: {
        ...baseEnvironment,
        CLEANVERSE_API_ID: "test-api-id",
        CLEANVERSE_API_KEY: Buffer.alloc(32, 7).toString("base64"),
      },
      logFailure: vi.fn(),
    });
    const response = await testApp.request("/ready");

    expect(response.status).toBe(200);
  });

  it("rejects invalid transaction intents", async () => {
    const response = await app.request("/api/v1/compliance/preflight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...validIntent,
        sender: "not-an-address",
      }),
    });
    const body = await response.json();
    const parsedBody = preflightErrorResponseSchema.safeParse(body);

    expect(response.status).toBe(422);
    expect(parsedBody.success).toBe(true);
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
      checks: [],
    });
  });

  it("rejects invalid JSON with a contract-compliant validation error", async () => {
    const response = await app.request("/api/v1/compliance/preflight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{",
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(preflightErrorResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
      checks: [],
    });
  });

  it("does not echo sensitive invalid input in validation errors", async () => {
    const sensitiveMarker = "sensitive-marker-that-must-not-be-returned";
    const response = await app.request("/api/v1/compliance/preflight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...validIntent,
        unexpectedSecret: sensitiveMarker,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(JSON.stringify(body)).not.toContain(sensitiveMarker);
  });

  it("returns a completed approved decision from the preflight service", async () => {
    const { service, evaluate } = createService({
      kind: "decision",
      decision: {
        requestId,
        approved: true,
        decisionCode: "TRANSFER_APPROVED",
        checks: [
          {
            id: "sender-eligibility",
            source: "cleanverse",
            status: "approved",
            code: "ELIGIBLE",
            message: "Sender has an eligible A-Pass for this A-Token.",
            checkedAt,
          },
          {
            id: "recipient-eligibility",
            source: "cleanverse",
            status: "approved",
            code: "ELIGIBLE",
            message:
              "Recipient has an eligible A-Pass for this A-Token.",
            checkedAt,
          },
          {
            id: "asset-rules",
            source: "cleanverse",
            status: "approved",
            code: "ATOKEN_RULES_LOADED",
            message: "A-Token compliance rules loaded successfully.",
            checkedAt,
          },
        ],
      },
    });
    const response = await requestPreflight(createConfiguredApp(service));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-ID")).toBe(requestId);
    expect(preflightDecisionSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      approved: true,
      decisionCode: "TRANSFER_APPROVED",
    });
    expect(evaluate).toHaveBeenCalledWith(validIntent, requestId);
  });

  it("returns a policy denial with HTTP 200", async () => {
    const { service } = createService({
      kind: "decision",
      decision: {
        requestId,
        approved: false,
        decisionCode: "RECIPIENT_NOT_ELIGIBLE",
        checks: [
          {
            id: "sender-eligibility",
            source: "cleanverse",
            status: "approved",
            code: "ELIGIBLE",
            message: "Sender has an eligible A-Pass for this A-Token.",
            checkedAt,
          },
          {
            id: "recipient-eligibility",
            source: "cleanverse",
            status: "denied",
            code: "APASS_NOT_ELIGIBLE",
            message:
              "Recipient is not eligible to receive this A-Token.",
            checkedAt,
          },
        ],
      },
    });
    const response = await requestPreflight(createConfiguredApp(service));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(preflightDecisionSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      requestId,
      approved: false,
      decisionCode: "RECIPIENT_NOT_ELIGIBLE",
    });
  });

  it("keeps the response body request ID aligned with the header", async () => {
    const { service } = createService({
      kind: "decision",
      decision: {
        requestId: "223e4567-e89b-42d3-a456-426614174000",
        approved: false,
        decisionCode: "SENDER_APASS_MISSING",
        checks: [],
      },
    });
    const response = await requestPreflight(createConfiguredApp(service));
    const body = await response.json();

    expect(response.headers.get("X-Request-ID")).toBe(requestId);
    expect(body).toMatchObject({ requestId });
  });

  it("returns 503 when the Cleanverse service is not configured", async () => {
    const logFailure = vi.fn();
    const testApp = createApp({
      preflightService: null,
      logFailure,
    });
    const response = await requestPreflight(testApp);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(preflightErrorResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      requestId,
      error: {
        code: "SERVICE_NOT_CONFIGURED",
      },
      checks: [],
    });
    expect(logFailure).toHaveBeenCalledWith({
      code: "SERVICE_NOT_CONFIGURED",
      requestId,
      completedChecks: 0,
    });
  });

  it.each([
    ["CLEANVERSE_TIMEOUT", 504],
    ["CLEANVERSE_UNAVAILABLE", 502],
    ["INTERNAL_SERVER_ERROR", 500],
  ] as const)(
    "maps %s to HTTP %i with completed checks",
    async (code, status) => {
      const { service } = createService({
        kind: "failure",
        error: {
          code,
          message: publicMessage(code),
        },
        checks: [
          {
            id: "sender-eligibility",
            source: "cleanverse",
            status: "approved",
            code: "ELIGIBLE",
            message: "Sender has an eligible A-Pass for this A-Token.",
            checkedAt,
          },
        ],
      });
      const response = await requestPreflight(
        createConfiguredApp(service),
      );
      const body = await response.json();

      expect(response.status).toBe(status);
      expect(response.headers.get("X-Request-ID")).toBe(requestId);
      expect(preflightErrorResponseSchema.safeParse(body).success).toBe(
        true,
      );
      expect(body).toMatchObject({
        requestId,
        error: { code },
        checks: [{ id: "sender-eligibility" }],
      });
    },
  );

  it("sanitizes an unexpected service exception", async () => {
    const sensitiveMarker = "sensitive-service-exception";
    const service: PreflightService = {
      evaluate: vi.fn().mockRejectedValue(new Error(sensitiveMarker)),
    };
    const response = await requestPreflight(createConfiguredApp(service));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(preflightErrorResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      requestId,
      error: {
        code: "INTERNAL_SERVER_ERROR",
      },
      checks: [],
    });
    expect(JSON.stringify(body)).not.toContain(sensitiveMarker);
  });
});

function publicMessage(code: PreflightErrorCode): string {
  switch (code) {
    case "CLEANVERSE_TIMEOUT":
      return "The compliance service timed out.";
    case "CLEANVERSE_UNAVAILABLE":
      return "The compliance service is temporarily unavailable.";
    default:
      return "An unexpected error occurred.";
  }
}
