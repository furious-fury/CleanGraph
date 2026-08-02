import { describe, expect, it } from "vitest";

import {
  assetApplicationResponseSchema,
  assetErrorResponseSchema,
  assetLaunchRequestSchema,
  cleanverseCountryCodeSchema,
} from "../src/index.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const launch = {
  chain: "monad",
  tokenName: "Tokenized Real-World Asset",
  tokenSymbol: "TRWA",
  decimals: 18,
  adminAddress: "0x1111111111111111111111111111111111111111",
  rule: {
    allowedGroup: "II",
    allowedSubGroup: "AI",
    minTier: 1,
    minSubTier: 0,
    countries: ["NG", "US"],
  },
  icon: "https://assets.example.com/trwa.svg",
};

describe("asset lifecycle contracts", () => {
  it("applies safe launch defaults and rejects unknown fields", () => {
    expect(assetLaunchRequestSchema.parse(launch).rule).toMatchObject({
      isBlackList: false,
      countries: ["NG", "US"],
    });
    expect(assetLaunchRequestSchema.safeParse({ ...launch, supply: 1_000_000 }).success).toBe(false);
  });

  it.each(["ng", "XX", "GBR"])("rejects unsupported country code %s", (country) => {
    expect(cleanverseCountryCodeSchema.safeParse(country).success).toBe(false);
  });

  it("rejects duplicate countries and unsafe URLs", () => {
    expect(assetLaunchRequestSchema.safeParse({ ...launch, rule: { ...launch.rule, countries: ["NG", "NG"] } }).success).toBe(false);
    expect(assetLaunchRequestSchema.safeParse({ ...launch, icon: "file:///tmp/token.svg" }).success).toBe(false);
  });

  it("accepts an issued standard launch with complete evidence", () => {
    const result = assetApplicationResponseSchema.safeParse({
      requestId,
      application: {
        applicationRequestId: "IA123",
        flowType: "LAUNCH",
        status: "ISSUED",
        terminal: true,
        successful: true,
        chain: "monad",
        atokenAddress: "0x2222222222222222222222222222222222222222",
        tokenSymbol: "TRWA",
        transactionHash: `0x${"a".repeat(64)}`,
        issuedAt: "2026-08-01 12:00:00",
      },
    });
    expect(result.success).toBe(true);
  });

  it.each([
    { status: "ISSUED", terminal: false, successful: true },
    { status: "PENDING", terminal: false, successful: true },
    { status: "REJECTED", terminal: true, successful: false },
  ])("rejects inconsistent application state %#", (state) => {
    const result = assetApplicationResponseSchema.safeParse({
      requestId,
      application: {
        applicationRequestId: "IA123",
        flowType: "LAUNCH",
        chain: "monad",
        tokenSymbol: "TRWA",
        ...state,
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts rate-limit metadata only on the sanitized error envelope", () => {
    expect(assetErrorResponseSchema.safeParse({
      requestId,
      error: { code: "RATE_LIMITED", message: "Try again later.", retryAfterSeconds: 30 },
    }).success).toBe(true);
  });
});
