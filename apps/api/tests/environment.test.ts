import { describe, expect, it } from "vitest";

import { environmentSchema, getFrontendUrl, getTrwaPolicy } from "../src/config/env.js";

const completePolicy = {
  TRWA_TOKEN_ADDRESS: "0x1111111111111111111111111111111111111111",
  TRWA_ALLOWED_GROUP: "AB",
  TRWA_ALLOWED_SUBGROUP: "CD",
  TRWA_ALLOWED_COUNTRIES: "US, GB,DE,SG",
};

describe("TRWA policy environment", () => {
  it("leaves preflight unconfigured when every policy value is absent", () => {
    const environment = environmentSchema.parse({ NODE_ENV: "test" });
    expect(getTrwaPolicy(environment)).toBeUndefined();
  });

  it("parses optional group and subgroup codes with a unique uppercase country allowlist", () => {
    const environment = environmentSchema.parse({ NODE_ENV: "test", ...completePolicy });
    expect(getTrwaPolicy(environment)).toEqual({
      tokenAddress: completePolicy.TRWA_TOKEN_ADDRESS,
      allowedGroup: completePolicy.TRWA_ALLOWED_GROUP,
      allowedSubgroup: completePolicy.TRWA_ALLOWED_SUBGROUP,
      allowedCountries: ["US", "GB", "DE", "SG"],
    });
  });

  it("allows a country-only policy for blank provider group fields", () => {
    const environment = environmentSchema.parse({
      NODE_ENV: "test",
      TRWA_TOKEN_ADDRESS: completePolicy.TRWA_TOKEN_ADDRESS,
      TRWA_ALLOWED_COUNTRIES: "GB,DE",
    });

    expect(getTrwaPolicy(environment)).toEqual({
      tokenAddress: completePolicy.TRWA_TOKEN_ADDRESS,
      allowedCountries: ["GB", "DE"],
    });
  });

  it.each([
    { TRWA_TOKEN_ADDRESS: completePolicy.TRWA_TOKEN_ADDRESS },
    { TRWA_ALLOWED_COUNTRIES: completePolicy.TRWA_ALLOWED_COUNTRIES },
    { TRWA_ALLOWED_GROUP: completePolicy.TRWA_ALLOWED_GROUP },
    { ...completePolicy, TRWA_TOKEN_ADDRESS: "not-an-address" },
    { ...completePolicy, TRWA_ALLOWED_GROUP: "A" },
    { ...completePolicy, TRWA_ALLOWED_SUBGROUP: "ABC" },
    { ...completePolicy, TRWA_ALLOWED_COUNTRIES: "US,us" },
    { ...completePolicy, TRWA_ALLOWED_COUNTRIES: "US,US" },
    { ...completePolicy, TRWA_ALLOWED_COUNTRIES: "US," },
  ])("rejects partial or malformed policy configuration", (configuration) => {
    expect(() => environmentSchema.parse({ NODE_ENV: "test", ...configuration })).toThrow();
  });
});

describe("demo A-Pass environment", () => {
  it("keeps demo mode disabled by default", () => {
    const environment = environmentSchema.parse({ NODE_ENV: "test" });
    expect(environment.DEMO_MODE).toBe(false);
  });

  it("uses one frontend URL for CORS and wallet challenge origin binding", () => {
    const environment = environmentSchema.parse({
      NODE_ENV: "test",
      FRONTEND_URL: "https://app.cleangraph.example",
    });

    expect(getFrontendUrl(environment)).toBe(
      "https://app.cleangraph.example",
    );
  });

  it("accepts a complete enabled demo configuration", () => {
    const environment = environmentSchema.parse({
      NODE_ENV: "test",
      DEMO_MODE: "true",
      DATABASE_URL: "postgresql://user:password@localhost:5432/cleangraph",
      FRONTEND_URL: "https://app.cleangraph.example",
      CLEANVERSE_API_ID: "demo-api-id",
      CLEANVERSE_API_KEY: "demo-api-key",
    });

    expect(environment.DEMO_MODE).toBe(true);
  });

  it("does not require demo dependencies when explicitly disabled", () => {
    expect(
      environmentSchema.parse({ NODE_ENV: "test", DEMO_MODE: "false" })
        .DEMO_MODE,
    ).toBe(false);
  });

  it.each([
    "DATABASE_URL",
    "CLEANVERSE_API_ID",
    "CLEANVERSE_API_KEY",
  ] as const)("requires %s when demo mode is enabled", (missing) => {
    const configuration: Record<string, string> = {
      NODE_ENV: "test",
      DEMO_MODE: "true",
      DATABASE_URL: "postgresql://user:password@localhost:5432/cleangraph",
      FRONTEND_URL: "https://app.cleangraph.example",
      CLEANVERSE_API_ID: "demo-api-id",
      CLEANVERSE_API_KEY: "demo-api-key",
    };
    delete configuration[missing];

    expect(() => environmentSchema.parse(configuration)).toThrow();
  });
});
