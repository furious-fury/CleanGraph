import {
  CleanverseBusinessError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
} from "@cleangraph/cleanverse-client";
import {
  assetApplicationResponseSchema,
  assetErrorResponseSchema,
  assetLaunchResponseSchema,
} from "@cleangraph/shared";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type { AssetLifecycleService } from "../src/services/assets.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const token = "test-operator-token-that-is-at-least-32-characters";
const launchInput = {
  chain: "monad",
  tokenName: "Tokenized Real-World Asset",
  tokenSymbol: "TRWA",
  decimals: 18,
  adminAddress: "0x1111111111111111111111111111111111111111",
  rule: { allowedGroup: "II", allowedSubGroup: "AI", minTier: 1, minSubTier: 0, countries: ["NG"] },
  icon: "https://assets.example.com/trwa.svg",
};
const pendingApplication = {
  applicationRequestId: "IA123",
  flowType: "LAUNCH" as const,
  status: "PENDING" as const,
  terminal: false,
  successful: false,
  chain: "monad" as const,
  tokenSymbol: "TRWA",
};

function createService(): AssetLifecycleService {
  return {
    launch: vi.fn<AssetLifecycleService["launch"]>().mockResolvedValue({ applicationRequestId: "IA123", issueAssetId: 28 }),
    getApplication: vi.fn<AssetLifecycleService["getApplication"]>().mockResolvedValue(pendingApplication),
  };
}

function configuredApp(service: AssetLifecycleService = createService(), overrides = {}) {
  return createApp({ preflightService: null, assetLifecycleService: service, assetOperatorToken: token, logAssetFailure: vi.fn(), ...overrides });
}

const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Request-ID": requestId };

describe("protected asset lifecycle routes", () => {
  it.each([undefined, "Bearer wrong-token-that-is-at-least-32-characters", `Bearer ${token} extra`, `Bearer ${token}, Bearer ${token}`])("returns the same 401 for invalid authorization", async (authorization) => {
    const response = await configuredApp().request("/api/v1/assets/launch", {
      method: "POST",
      headers: authorization ? { Authorization: authorization, "Content-Type": "application/json" } : { "Content-Type": "application/json" },
      body: JSON.stringify(launchInput),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(assetErrorResponseSchema.safeParse(await response.json()).success).toBe(true);
  });

  it("returns 503 when operator authentication is not configured", async () => {
    const response = await createApp({ preflightService: null, assetLifecycleService: createService(), logAssetFailure: vi.fn() }).request("/api/v1/assets/launch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(launchInput) });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "SERVICE_NOT_CONFIGURED" } });
  });

  it("launches an A-Token with a correlated 202 response", async () => {
    const service = createService();
    const response = await configuredApp(service).request("/api/v1/assets/launch", { method: "POST", headers, body: JSON.stringify(launchInput) });
    const body = await response.json();
    expect(response.status).toBe(202);
    expect(response.headers.get("X-Request-ID")).toBe(requestId);
    expect(assetLaunchResponseSchema.safeParse(body).success).toBe(true);
    expect(service.launch).toHaveBeenCalledWith(expect.objectContaining({ rule: expect.objectContaining({ isBlackList: false }) }), requestId);
  });

  it("accepts a case-insensitive bearer scheme", async () => {
    const response = await configuredApp().request("/api/v1/assets/launch", {
      method: "POST",
      headers: { ...headers, Authorization: `bearer ${token}` },
      body: JSON.stringify(launchInput),
    });
    expect(response.status).toBe(202);
  });

  it("returns a snapshot for a standard launch application", async () => {
    const service = createService();
    const response = await configuredApp(service).request("/api/v1/assets/applications/IA123", { headers });
    expect(response.status).toBe(200);
    expect(assetApplicationResponseSchema.safeParse(await response.json()).success).toBe(true);
    expect(service.getApplication).toHaveBeenCalledWith("IA123", requestId);
  });

  it("returns rejected applications as completed HTTP 200 snapshots", async () => {
    const service = createService();
    vi.mocked(service.getApplication).mockResolvedValue({
      ...pendingApplication,
      status: "REJECTED",
      terminal: true,
      failure: {
        code: "APPLICATION_REJECTED",
        message: "Cleanverse rejected the A-Token application.",
        upstreamReasonPresent: true,
      },
    });
    const response = await configuredApp(service).request("/api/v1/assets/applications/IA123", { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ application: { status: "REJECTED", successful: false } });
  });

  it("returns a safe 503 when Cleanverse service configuration is unavailable", async () => {
    const response = await createApp({
      preflightService: null,
      assetLifecycleService: null,
      assetOperatorToken: token,
      logAssetFailure: vi.fn(),
    }).request("/api/v1/assets/applications/IA123", { headers });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "SERVICE_NOT_CONFIGURED" } });
  });

  it("rejects invalid JSON and non-standard application identifiers", async () => {
    const app = configuredApp();
    const invalidJson = await app.request("/api/v1/assets/launch", { method: "POST", headers, body: "{" });
    const invalidId = await app.request("/api/v1/assets/applications/IAR123", { headers });
    expect(invalidJson.status).toBe(422);
    expect(invalidId.status).toBe(422);
  });

  it.each([
    [new CleanverseBusinessError(requestId, "12015"), 404, "APPLICATION_NOT_FOUND"],
    [new CleanverseBusinessError(requestId, "1000"), 502, "CLEANVERSE_REJECTED"],
    [new CleanverseNetworkError(requestId), 502, "CLEANVERSE_UNAVAILABLE"],
    [new CleanverseTimeoutError(requestId), 504, "CLEANVERSE_TIMEOUT"],
  ] as const)("maps safe Cleanverse failure %#", async (error, status, code) => {
    const service = createService();
    vi.mocked(service.getApplication).mockRejectedValue(error);
    const response = await configuredApp(service).request("/api/v1/assets/applications/IA123", { headers });
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ requestId, error: { code } });
  });

  it("does not expose unexpected exception messages or request payloads", async () => {
    const service = createService();
    vi.mocked(service.launch).mockRejectedValue(new Error("secret upstream body Tokenized Real-World Asset"));
    const response = await configuredApp(service).request("/api/v1/assets/launch", { method: "POST", headers, body: JSON.stringify(launchInput) });
    const serialized = JSON.stringify(await response.json());
    expect(response.status).toBe(500);
    expect(serialized).not.toContain("secret upstream body");
    expect(serialized).not.toContain(launchInput.tokenName);
  });

  it("limits authenticated launch requests and resets at the next window", async () => {
    let now = 0;
    const app = configuredApp(createService(), { launchRateLimit: { limit: 1, windowMs: 60_000, clock: () => now } });
    const makeRequest = () => app.request("/api/v1/assets/launch", { method: "POST", headers, body: JSON.stringify(launchInput) });
    expect((await makeRequest()).status).toBe(202);
    const limited = await makeRequest();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    expect(await limited.json()).toMatchObject({ error: { code: "RATE_LIMITED", retryAfterSeconds: 60 } });
    now = 60_000;
    expect((await makeRequest()).status).toBe(202);
  });

  it("counts invalid authenticated requests but not unauthorized requests", async () => {
    const app = configuredApp(createService(), { launchRateLimit: { limit: 1, windowMs: 60_000, clock: () => 0 } });
    const unauthorized = await app.request("/api/v1/assets/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer wrong" },
      body: "{",
    });
    const invalid = await app.request("/api/v1/assets/launch", { method: "POST", headers, body: "{" });
    const limited = await app.request("/api/v1/assets/launch", { method: "POST", headers, body: JSON.stringify(launchInput) });
    expect(unauthorized.status).toBe(401);
    expect(invalid.status).toBe(422);
    expect(limited.status).toBe(429);
  });
});
