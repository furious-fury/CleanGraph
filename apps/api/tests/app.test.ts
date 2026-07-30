import { preflightErrorResponseSchema } from "@cleangraph/shared";
import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";

const validIntent = {
  chain: "monad",
  sender: "0x1111111111111111111111111111111111111111",
  recipient: "0x2222222222222222222222222222222222222222",
  atokenAddress: "0x3333333333333333333333333333333333333333",
  amount: "10.5",
};

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
    const requestId = "123e4567-e89b-42d3-a456-426614174000";
    const response = await app.request("/health", {
      headers: {
        "X-Request-ID": requestId,
      },
    });

    expect(response.headers.get("X-Request-ID")).toBe(requestId);
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

  it("returns an explicit placeholder until Cleanverse is connected", async () => {
    const requestId = "123e4567-e89b-42d3-a456-426614174000";
    const response = await app.request("/api/v1/compliance/preflight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
      body: JSON.stringify(validIntent),
    });
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(response.headers.get("X-Request-ID")).toBe(requestId);
    expect(preflightErrorResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      requestId,
      error: {
        code: "PREFLIGHT_NOT_IMPLEMENTED",
      },
      checks: [],
    });
    expect(body).not.toHaveProperty("approved", true);
  });
});
