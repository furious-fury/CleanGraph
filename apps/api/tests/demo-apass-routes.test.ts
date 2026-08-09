import type { Environment } from "../src/config/env.js";
import {
  DemoAPassServiceError,
  type DemoAPassService,
} from "../src/services/demo-apass.js";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";

const wallet = "0x1111111111111111111111111111111111111111";
const challengeId = "223e4567-e89b-42d3-a456-426614174000";
const signature = `0x${"1".repeat(130)}`;
const baseEnvironment: Environment = {
  NODE_ENV: "test",
  PORT: 3000,
  FRONTEND_URL: "https://app.cleangraph.example",
  CLEANVERSE_TIMEOUT_MS: 10_000,
};

function service(): DemoAPassService {
  return {
    createChallenge: vi.fn().mockResolvedValue({
      challengeId,
      message: "Sign this exact message",
      expiresAt: "2026-08-09T12:05:00.000Z",
    }),
    createAPass: vi.fn().mockResolvedValue({
      walletAddress: wallet,
      status: "PENDING",
      registrationTransactionHash: `0x${"a".repeat(64)}`,
    }),
    readStatus: vi.fn().mockResolvedValue({
      walletAddress: wallet,
      status: "ACTIVE",
    }),
  };
}

function request(path: string, body: unknown, app = enabledApp()) {
  return app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "192.0.2.10",
      Origin: "https://app.cleangraph.example",
    },
    body: JSON.stringify(body),
  });
}

function enabledApp(demoService = service()) {
  return createApp({
    environment: baseEnvironment,
    preflightService: null,
    evidenceService: null,
    demoEnabled: true,
    demoAPassService: demoService,
    demoClientIpHeader: "X-Forwarded-For",
    logDemoAPassFailure: vi.fn(),
  });
}

describe("demo A-Pass HTTP routes", () => {
  it("returns 404 with no upstream call when demo mode is disabled", async () => {
    const demoService = service();
    const app = createApp({
      environment: baseEnvironment,
      preflightService: null,
      evidenceService: null,
      demoEnabled: false,
      demoAPassService: demoService,
    });
    const response = await request(
      "/api/v1/demo/apass/challenges",
      { walletAddress: wallet, purpose: "STATUS" },
      app,
    );

    expect(response.status).toBe(404);
    expect(demoService.createChallenge).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns a safe 503 when enabled without a usable Cleanverse runtime", async () => {
    const app = createApp({
      environment: baseEnvironment,
      preflightService: null,
      evidenceService: null,
      demoEnabled: true,
      demoAPassService: null,
      logDemoAPassFailure: vi.fn(),
    });
    const response = await request(
      "/api/v1/demo/apass/challenges",
      { walletAddress: wallet, purpose: "STATUS" },
      app,
    );

    expect(response.status).toBe(503);
    expect((await response.json()).error).toEqual({
      code: "SERVICE_NOT_CONFIGURED",
      message: "The demo A-Pass service is not configured.",
    });
  });

  it("creates a challenge without placing request IDs in the body", async () => {
    const response = await request("/api/v1/demo/apass/challenges", {
      walletAddress: wallet,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      challengeId,
      message: "Sign this exact message",
      expiresAt: "2026-08-09T12:05:00.000Z",
    });
    expect(response.headers.get("X-Request-ID")).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.cleangraph.example",
    );
  });

  it("returns only the safe creation fields", async () => {
    const response = await request("/api/v1/demo/apasses", {
      walletAddress: wallet,
      profile: "ELIGIBLE_GB",
      challengeId,
      signature,
    });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual({
      walletAddress: wallet,
      status: "PENDING",
      registrationTransactionHash: `0x${"a".repeat(64)}`,
    });
    expect(JSON.stringify(body)).not.toMatch(
      /customer|identity|document|credential|cleanverse/i,
    );
  });

  it("rejects attempts to set identity or policy fields in the browser payload", async () => {
    const demoService = service();
    const response = await request(
      "/api/v1/demo/apasses",
      {
        walletAddress: wallet,
        profile: "ELIGIBLE_GB",
        challengeId,
        signature,
        country: "US",
        fullName: "Injected Name",
        customerId: "InjectedCustomer",
        documentHash: "f".repeat(64),
        expirationTime: 1_900_000_000,
        group: "AA",
        subGroup: "BB",
        override: true,
      },
      enabledApp(demoService),
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(body)).not.toContain("Injected Name");
    expect(demoService.createAPass).not.toHaveBeenCalled();
  });

  it("requires profile only for CREATE challenges", async () => {
    expect(
      (
        await request("/api/v1/demo/apass/challenges", {
          walletAddress: wallet,
          purpose: "CREATE",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await request("/api/v1/demo/apass/challenges", {
          walletAddress: wallet,
          purpose: "STATUS",
          profile: "RESTRICTED_BR",
        })
      ).status,
    ).toBe(422);
  });

  it("returns 429 and Retry-After for a persistent rate limit", async () => {
    const demoService = service();
    vi.mocked(demoService.createChallenge).mockRejectedValue(
      new DemoAPassServiceError(
        "RATE_LIMITED",
        429,
        "Too many demo A-Pass requests.",
        42,
      ),
    );
    const response = await request(
      "/api/v1/demo/apass/challenges",
      { walletAddress: wallet, purpose: "STATUS" },
      enabledApp(demoService),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect((await response.json()).error).toEqual({
      code: "RATE_LIMITED",
      message: "Too many demo A-Pass requests.",
    });
  });

  it("returns a safe 409 when an A-Pass already exists", async () => {
    const demoService = service();
    vi.mocked(demoService.createAPass).mockResolvedValue({
      walletAddress: wallet,
      status: "ALREADY_EXISTS",
    });
    const response = await request(
      "/api/v1/demo/apasses",
      { walletAddress: wallet, profile: "ELIGIBLE_GB", challengeId, signature },
      enabledApp(demoService),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      walletAddress: wallet,
      status: "ALREADY_EXISTS",
    });
  });

  it("keeps a known service rejection when the error crosses a module boundary", async () => {
    const demoService = service();
    const logFailure = vi.fn();
    const boundaryError = Object.assign(
      new Error("Cleanverse rejected the demo A-Pass request with business code 1000."),
      {
        name: "DemoAPassServiceError",
        code: "CLEANVERSE_REJECTED",
        status: 502,
        upstreamCode: "1000",
      },
    );
    vi.mocked(demoService.createAPass).mockRejectedValue(boundaryError);
    const app = createApp({
      environment: baseEnvironment,
      preflightService: null,
      evidenceService: null,
      demoEnabled: true,
      demoAPassService: demoService,
      demoClientIpHeader: "X-Forwarded-For",
      logDemoAPassFailure: logFailure,
    });

    const response = await request(
      "/api/v1/demo/apasses",
      { walletAddress: wallet, profile: "ELIGIBLE_GB", challengeId, signature },
      app,
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "CLEANVERSE_REJECTED" },
    });
    expect(logFailure).toHaveBeenCalledWith(
      expect.objectContaining({ upstreamCode: "1000" }),
    );
  });

  it("returns a safe database-unavailable response for PostgreSQL connection failures", async () => {
    const demoService = service();
    const logFailure = vi.fn();
    vi.mocked(demoService.createAPass).mockRejectedValue(
      Object.assign(new Error("sensitive database detail"), { code: "ETIMEDOUT" }),
    );
    const app = createApp({
      environment: baseEnvironment,
      preflightService: null,
      evidenceService: null,
      demoEnabled: true,
      demoAPassService: demoService,
      demoClientIpHeader: "X-Forwarded-For",
      logDemoAPassFailure: logFailure,
    });

    const response = await request(
      "/api/v1/demo/apasses",
      { walletAddress: wallet, profile: "ELIGIBLE_GB", challengeId, signature },
      app,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "The demo A-Pass database is temporarily unavailable.",
      },
    });
    expect(logFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "DATABASE_UNAVAILABLE",
        causeCode: "ETIMEDOUT",
      }),
    );
  });

  it("uses a fresh signed request for status", async () => {
    const demoService = service();
    const response = await request(
      "/api/v1/demo/apasses/status",
      { walletAddress: wallet, challengeId, signature },
      enabledApp(demoService),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      walletAddress: wallet,
      status: "ACTIVE",
    });
    expect(demoService.readStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddress: wallet,
        challengeId,
        signature,
        clientIp: "192.0.2.10",
        requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      }),
    );
  });
});
