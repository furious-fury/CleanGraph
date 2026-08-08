import { describe, expect, it } from "vitest";

import { environmentSchema, getTrwaPolicy } from "../src/config/env.js";

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
