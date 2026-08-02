import {
  CleanverseBusinessError,
  CleanverseConfigurationError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
} from "@cleangraph/cleanverse-client";
import {
  evidenceErrorResponseSchema,
  transactionEvidenceResponseSchema,
} from "@cleangraph/shared";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import {
  UnexpectedEvidenceReportError,
  type EvidenceService,
} from "../src/services/evidence.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const token = "test-operator-token-that-is-at-least-32-characters";
const transactionHash = `0x${"a".repeat(64)}`;
const walletAddress = "0x1111111111111111111111111111111111111111";
const evidenceInput = { chain: "monad", transactionHash, walletAddress };
const transaction = {
  chain: "monad" as const,
  symbol: "TRWA",
  transactionHash,
  fromAddress: walletAddress,
  toAddress: "0x2222222222222222222222222222222222222222",
  amount: "1000000000000000000",
  feeAmount: "0",
  feePayerIndex: 0,
  type: "transfer",
  blockNumber: 123,
  blockTime: 1_786_120_100,
  status: "success",
};

function createService(): EvidenceService {
  return {
    getEvidence: vi.fn<EvidenceService["getEvidence"]>().mockResolvedValue({
      response: {
        requestId,
        index: { status: "PENDING", attempts: 3 },
        report: { status: "PENDING" },
      },
    }),
  };
}

function configuredApp(
  service: EvidenceService = createService(),
  overrides = {},
) {
  return createApp({
    preflightService: null,
    assetLifecycleService: null,
    evidenceService: service,
    assetOperatorToken: token,
    logEvidenceFailure: vi.fn(),
    ...overrides,
  });
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "X-Request-ID": requestId,
};

function makeRequest(app = configuredApp(), input: unknown = evidenceInput) {
  return app.request("/api/v1/transactions/evidence", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
}

describe("protected transaction evidence route", () => {
  it.each([
    undefined,
    "Bearer wrong-token",
    `Bearer ${token} extra`,
    `Bearer ${token}, Bearer ${token}`,
  ])("returns the same 401 for invalid authorization", async (authorization) => {
    const response = await configuredApp().request(
      "/api/v1/transactions/evidence",
      {
        method: "POST",
        headers: authorization
          ? { Authorization: authorization, "Content-Type": "application/json" }
          : { "Content-Type": "application/json" },
        body: JSON.stringify(evidenceInput),
      },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(evidenceErrorResponseSchema.safeParse(await response.json()).success).toBe(true);
  });

  it("returns 503 when operator authentication is not configured", async () => {
    const response = await createApp({
      preflightService: null,
      assetLifecycleService: null,
      evidenceService: createService(),
      logEvidenceFailure: vi.fn(),
    }).request("/api/v1/transactions/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evidenceInput),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "SERVICE_NOT_CONFIGURED" },
    });
  });

  it("returns a correlated pending snapshot without caching it", async () => {
    const service = createService();
    const response = await makeRequest(configuredApp(service));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-ID")).toBe(requestId);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(transactionEvidenceResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      index: { status: "PENDING", attempts: 3 },
      report: { status: "PENDING" },
    });
    expect(service.getEvidence).toHaveBeenCalledWith(evidenceInput, requestId);
  });

  it("returns indexed evidence with an available time-limited report", async () => {
    const service = createService();
    vi.mocked(service.getEvidence).mockResolvedValue({
      response: {
        requestId,
        index: { status: "INDEXED", attempts: 1, transaction },
        report: {
          status: "AVAILABLE",
          fileName: "transaction-report.pdf",
          downloadUrl: "https://reports.example/download?token=sanitized",
        },
      },
    });

    const response = await makeRequest(configuredApp(service));
    expect(response.status).toBe(200);
    expect(
      transactionEvidenceResponseSchema.safeParse(await response.json()).success,
    ).toBe(true);
  });

  it("logs a sanitized known report failure while preserving indexed evidence", async () => {
    const service = createService();
    vi.mocked(service.getEvidence).mockResolvedValue({
      response: {
        requestId,
        index: { status: "INDEXED", attempts: 1, transaction },
        report: { status: "UNAVAILABLE" },
      },
      reportFailureCode: "CLEANVERSE_BUSINESS_ERROR",
    });
    const logEvidenceFailure = vi.fn();

    const response = await makeRequest(
      configuredApp(service, { logEvidenceFailure }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      index: { status: "INDEXED" },
      report: { status: "UNAVAILABLE" },
    });
    expect(logEvidenceFailure).toHaveBeenCalledWith({
      event: "evidence_report_unavailable",
      operation: "report",
      code: "CLEANVERSE_BUSINESS_ERROR",
      requestId,
      status: 200,
    });
  });

  it("returns a safe 503 when the evidence service is unavailable", async () => {
    const logEvidenceFailure = vi.fn();
    const response = await makeRequest(
      configuredApp(createService(), {
        evidenceService: null,
        logEvidenceFailure,
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: "SERVICE_NOT_CONFIGURED" },
    });
    expect(logEvidenceFailure).toHaveBeenCalledWith(
      expect.objectContaining({ event: "evidence_index_failure", status: 503 }),
    );
  });

  it.each([
    "{",
    JSON.stringify({ ...evidenceInput, chain: "base" }),
    JSON.stringify({ ...evidenceInput, transactionHash: "0x1" }),
    JSON.stringify({ ...evidenceInput, walletAddress: "0x1" }),
    JSON.stringify({ ...evidenceInput, unexpected: true }),
  ])("rejects invalid authenticated input", async (body) => {
    const response = await configuredApp().request(
      "/api/v1/transactions/evidence",
      { method: "POST", headers, body },
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it.each([
    [new CleanverseConfigurationError("invalid"), 422, "VALIDATION_ERROR"],
    [new CleanverseBusinessError(requestId, "0002"), 502, "CLEANVERSE_REJECTED"],
    [new CleanverseNetworkError(requestId), 502, "CLEANVERSE_UNAVAILABLE"],
    [new CleanverseMalformedResponseError(requestId), 502, "CLEANVERSE_UNAVAILABLE"],
    [new CleanverseTimeoutError(requestId), 504, "CLEANVERSE_TIMEOUT"],
    [new UnexpectedEvidenceReportError(), 500, "INTERNAL_SERVER_ERROR"],
    [new Error("secret upstream error"), 500, "INTERNAL_SERVER_ERROR"],
  ] as const)("maps a safe evidence failure %#", async (error, status, code) => {
    const service = createService();
    vi.mocked(service.getEvidence).mockRejectedValue(error);
    const logEvidenceFailure = vi.fn();
    const response = await makeRequest(
      configuredApp(service, { logEvidenceFailure }),
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(status);
    expect(serialized).toContain(code);
    expect(serialized).not.toContain("secret upstream error");
    expect(serialized).not.toContain(transactionHash);
    expect(serialized).not.toContain(walletAddress);
    expect(logEvidenceFailure).toHaveBeenCalledWith(
      expect.objectContaining({ code, requestId, status }),
    );
  });

  it("limits authenticated requests and resets at the next window", async () => {
    let now = 0;
    const app = configuredApp(createService(), {
      evidenceRateLimit: {
        limit: 1,
        windowMs: 60_000,
        clock: () => now,
        message: "Too many transaction evidence requests.",
      },
    });

    expect((await makeRequest(app)).status).toBe(200);
    const limited = await makeRequest(app);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(await limited.json()).toMatchObject({
      error: { code: "RATE_LIMITED", retryAfterSeconds: 60 },
    });
    now = 60_000;
    expect((await makeRequest(app)).status).toBe(200);
  });

  it("allows twenty authenticated evidence requests in the default window", async () => {
    const app = configuredApp();

    for (let request = 0; request < 20; request += 1) {
      expect((await makeRequest(app)).status).toBe(200);
    }

    const limited = await makeRequest(app);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({
      error: {
        code: "RATE_LIMITED",
        message: "Too many transaction evidence requests.",
      },
    });
  });

  it("counts invalid authenticated requests but not unauthorized requests", async () => {
    const app = configuredApp(createService(), {
      evidenceRateLimit: {
        limit: 1,
        windowMs: 60_000,
        clock: () => 0,
      },
    });
    const unauthorized = await app.request("/api/v1/transactions/evidence", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong",
      },
      body: "{",
    });
    const invalid = await app.request("/api/v1/transactions/evidence", {
      method: "POST",
      headers,
      body: "{",
    });
    const limited = await makeRequest(app);

    expect(unauthorized.status).toBe(401);
    expect(invalid.status).toBe(422);
    expect(limited.status).toBe(429);
  });
});
