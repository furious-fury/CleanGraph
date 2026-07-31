export const demoWalletAddress =
  "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
export const demoTransactionHash = `0x${"1".repeat(64)}`;
export const demoDocumentHash =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export function minimalGenerateAPassInput() {
  return {
    customerId: "DemoInvestor001",
    expirationTime: Math.floor(Date.now() / 1_000) + 86_400,
    wallet: {
      chain: "monad" as const,
      address: demoWalletAddress,
    },
    identityDataList: [
      {
        idType: "PASSPORT" as const,
        fullName: "Demo Investor",
        issuingCountryISO2: "GB",
      },
    ] as const,
  };
}

export function fullGenerateAPassInput() {
  return {
    ...minimalGenerateAPassInput(),
    kycSource: "fictional-provider",
    kycId: "fictional-reference",
    subTier: 9,
    subGroup: "AI",
    override: true,
    identityDataList: [
      {
        idType: "PASSPORT" as const,
        fullName: "Demo Investor",
        idNumber: demoDocumentHash,
        validUntil: "2099-12-31",
        issuingCountryISO2: "GB",
      },
    ] as const,
  };
}

export function generateAPassResponseData() {
  return {
    customerId: "DemoInvestor001",
    cvRecordId: "cv-record-001",
    tier: "3",
    wallet: {
      operate: "update",
      address: demoWalletAddress.toLowerCase(),
      chain: "monad",
      txHash: demoTransactionHash,
      depositUSDCWallet:
        "0x1111111111111111111111111111111111111111",
      depositUSDTWallet:
        "0x2222222222222222222222222222222222222222",
      depositUSDCAccount: "discard-solana-only-field",
      depositUSDTAccount: "discard-solana-only-field",
      apassAddress: "discard-solana-only-field",
      ignoredUpstreamField: "discard-me",
    },
    ignoredUpstreamField: "discard-me",
  };
}
