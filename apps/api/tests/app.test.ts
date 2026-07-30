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

    expect(response.status).toBe(422);
    expect(body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });

  it("returns an explicit placeholder until Cleanverse is connected", async () => {
    const response = await app.request("/api/v1/compliance/preflight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validIntent),
    });
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body).toMatchObject({
      approved: false,
      status: "not_implemented",
      error: {
        code: "PREFLIGHT_NOT_IMPLEMENTED",
      },
    });
  });
});
