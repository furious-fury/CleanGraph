import { describe, expect, it } from "vitest";

import { environmentSchema, getTrwaPolicy } from "../src/config/env.js";

const completePolicy = {
  TRWA_TOKEN_ADDRESS: "0x1111111111111111111111111111111111111111",
  TRWA_ALLOWED_GROUP: "Institutional Investor",
  TRWA_ALLOWED_SUBGROUP: "Accredited Investor",
  TRWA_ALLOWED_COUNTRIES: "US, GB,DE,SG",
};

describe("TRWA policy environment", () => {
  it("leaves preflight unconfigured when every policy value is absent", () => {
    const environment = environmentSchema.parse({ NODE_ENV: "test" });
    expect(getTrwaPolicy(environment)).toBeUndefined();
  });

  it("parses a complete unique uppercase country allowlist", () => {
    const environment = environmentSchema.parse({ NODE_ENV: "test", ...completePolicy });
    expect(getTrwaPolicy(environment)).toEqual({
      tokenAddress: completePolicy.TRWA_TOKEN_ADDRESS,
      allowedGroup: completePolicy.TRWA_ALLOWED_GROUP,
      allowedSubgroup: completePolicy.TRWA_ALLOWED_SUBGROUP,
      allowedCountries: ["US", "GB", "DE", "SG"],
    });
  });

  it.each([
    { TRWA_TOKEN_ADDRESS: completePolicy.TRWA_TOKEN_ADDRESS },
    { ...completePolicy, TRWA_TOKEN_ADDRESS: "not-an-address" },
    { ...completePolicy, TRWA_ALLOWED_COUNTRIES: "US,us" },
    { ...completePolicy, TRWA_ALLOWED_COUNTRIES: "US,US" },
    { ...completePolicy, TRWA_ALLOWED_COUNTRIES: "US," },
  ])("rejects partial or malformed policy configuration", (configuration) => {
    expect(() => environmentSchema.parse({ NODE_ENV: "test", ...configuration })).toThrow();
  });
});
