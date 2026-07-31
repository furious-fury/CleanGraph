import { describe, expect, it } from "vitest";

import {
  createGenerateAPassResultSchema,
  parseGenerateAPassInput,
} from "../src/apass.js";
import {
  CleanverseConfigurationError,
  CleanverseMalformedResponseError,
} from "../src/index.js";

const walletAddress = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const transactionHash = `0x${"1".repeat(64)}`;
const futureExpiration = Math.floor(Date.now() / 1_000) + 86_400;
const validInput = {
  customerId: "DemoInvestor001",
  expirationTime: futureExpiration,
  wallet: {
    chain: "monad",
    address: walletAddress,
  },
  identityDataList: [
    {
      idType: "PASSPORT",
      fullName: "Demo Investor",
      issuingCountryISO2: "GB",
    },
  ],
} as const;

function validResponseData() {
  return {
    customerId: validInput.customerId,
    cvRecordId: "cv-record-001",
    tier: "3",
    wallet: {
      operate: "update",
      address: walletAddress.toLowerCase(),
      chain: "monad",
      txHash: transactionHash,
      depositUSDCWallet:
        "0x1111111111111111111111111111111111111111",
      depositUSDTWallet:
        "0x2222222222222222222222222222222222222222",
      depositUSDCAccount: "discard-solana-only-field",
      apassAddress: "discard-solana-only-field",
      ignoredUpstreamField: "discard-me",
    },
    ignoredUpstreamField: "discard-me",
  };
}

describe("A-Pass provisioning input contract", () => {
  it("accepts the minimal country-tagged Monad input and defaults override", () => {
    const parsed = parseGenerateAPassInput(validInput);

    expect(parsed).toEqual({
      ...validInput,
      identityDataList: [...validInput.identityDataList],
      override: false,
    });
  });

  it("accepts the full supported PII-minimized input", () => {
    const parsed = parseGenerateAPassInput({
      ...validInput,
      kycSource: "fictional-provider",
      kycId: "fictional-reference",
      subTier: 9,
      subGroup: "AI",
      override: true,
      identityDataList: [
        {
          ...validInput.identityDataList[0],
          idNumber:
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          validUntil: "2099-12-31",
        },
      ],
    });

    expect(parsed).toMatchObject({
      subTier: 9,
      subGroup: "AI",
      override: true,
      identityDataList: [
        {
          issuingCountryISO2: "GB",
          validUntil: "2099-12-31",
        },
      ],
    });
  });

  it.each([
    "short",
    "contains-hyphen",
    "contains space",
    "contains_underscore",
    "12345678901!",
  ])("rejects invalid customer ID %j", (customerId) => {
    expect(() =>
      parseGenerateAPassInput({ ...validInput, customerId }),
    ).toThrow(CleanverseConfigurationError);
  });

  it.each([
    {
      ...validInput,
      wallet: { ...validInput.wallet, chain: "base" },
    },
    {
      ...validInput,
      wallet: { ...validInput.wallet, address: "0x1234" },
    },
    {
      ...validInput,
      wallet: { ...validInput.wallet, extra: true },
    },
  ])("rejects invalid wallet input", (input) => {
    expect(() => parseGenerateAPassInput(input)).toThrow(
      CleanverseConfigurationError,
    );
  });

  it.each([
    -1,
    0,
    1.5,
    Math.floor(Date.now() / 1_000) - 1,
    Math.floor(Date.now() / 1_000),
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid expiration %j", (expirationTime) => {
    expect(() =>
      parseGenerateAPassInput({ ...validInput, expirationTime }),
    ).toThrow(CleanverseConfigurationError);
  });

  it.each([0, 100, 1.5])("rejects invalid sub-tier %j", (subTier) => {
    expect(() =>
      parseGenerateAPassInput({ ...validInput, subTier }),
    ).toThrow(CleanverseConfigurationError);
  });

  it.each(["A", "ABC", "A1", "A_", " A"])(
    "rejects invalid subgroup %j",
    (subGroup) => {
      expect(() =>
        parseGenerateAPassInput({ ...validInput, subGroup }),
      ).toThrow(CleanverseConfigurationError);
    },
  );

  it("rejects an empty identity list", () => {
    expect(() =>
      parseGenerateAPassInput({
        ...validInput,
        identityDataList: [],
      }),
    ).toThrow(CleanverseConfigurationError);
  });

  it.each([
    {
      ...validInput.identityDataList[0],
      idType: "NATIONAL_ID",
    },
    {
      ...validInput.identityDataList[0],
      idNumber: "RAW-DOCUMENT-NUMBER",
    },
    {
      ...validInput.identityDataList[0],
      fullName: " ",
    },
    {
      ...validInput.identityDataList[0],
      unexpected: "field",
    },
  ])("rejects unsupported or unsafe identity input", (identity) => {
    expect(() =>
      parseGenerateAPassInput({
        ...validInput,
        identityDataList: [identity],
      }),
    ).toThrow(CleanverseConfigurationError);
  });

  it.each(["2025-12-31", "2030-02-30", "31-12-2099", "2099-2-01"])(
    "rejects invalid or expired document date %j",
    (validUntil) => {
      expect(() =>
        parseGenerateAPassInput({
          ...validInput,
          identityDataList: [
            {
              ...validInput.identityDataList[0],
              validUntil,
            },
          ],
        }),
      ).toThrow(CleanverseConfigurationError);
    },
  );

  it.each(["gb", "ZZ", "UK", "G1", " GBR"])(
    "rejects unsupported country code %j",
    (issuingCountryISO2) => {
      expect(() =>
        parseGenerateAPassInput({
          ...validInput,
          identityDataList: [
            {
              ...validInput.identityDataList[0],
              issuingCountryISO2,
            },
          ],
        }),
      ).toThrow(CleanverseConfigurationError);
    },
  );

  it("rejects unsupported bank, tier, group, and top-level fields", () => {
    for (const unsupported of [
      { bankAccountList: [] },
      { tier: 3 },
      { group: "II" },
      { unexpected: true },
    ]) {
      expect(() =>
        parseGenerateAPassInput({ ...validInput, ...unsupported }),
      ).toThrow(CleanverseConfigurationError);
    }
  });
});

describe("A-Pass provisioning response contract", () => {
  it("normalizes safe Monad fields and discards upstream extras", () => {
    const input = parseGenerateAPassInput(validInput);
    const parsed = createGenerateAPassResultSchema(input).parse(
      validResponseData(),
    );

    expect(parsed).toEqual({
      customerId: validInput.customerId,
      cvRecordId: "cv-record-001",
      tier: "3",
      wallet: {
        operation: "update",
        address: walletAddress,
        chain: "monad",
        transactionHash,
        depositUsdcWallet:
          "0x1111111111111111111111111111111111111111",
        depositUsdtWallet:
          "0x2222222222222222222222222222222222222222",
      },
    });
    expect(JSON.stringify(parsed)).not.toContain("discard");
  });

  it.each([
    { customerId: "DifferentCustomer001" },
    {
      wallet: {
        ...validResponseData().wallet,
        address: "0x3333333333333333333333333333333333333333",
      },
    },
    {
      wallet: {
        ...validResponseData().wallet,
        chain: "base",
      },
    },
    {
      wallet: {
        ...validResponseData().wallet,
        txHash: "0x1234",
      },
    },
  ])("rejects malformed or mismatched response data", (override) => {
    const input = parseGenerateAPassInput(validInput);
    const data = {
      ...validResponseData(),
      ...override,
    };

    expect(() =>
      createGenerateAPassResultSchema(input).parse(data),
    ).toThrow();
  });

  it("is compatible with the client's malformed response error boundary", () => {
    const error = new CleanverseMalformedResponseError(
      "123e4567-e89b-42d3-a456-426614174000",
    );

    expect(JSON.stringify(error)).not.toContain(validInput.customerId);
  });
});
