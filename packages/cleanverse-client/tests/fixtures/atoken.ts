export const demoAdminAddress =
  "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
export const demoATokenAddress =
  "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb";
export const demoTransactionHash = `0x${"1".repeat(64)}`;
export const demoApplicationRequestId = "IA20260808120000123456";

export function minimalLaunchATokenInput() {
  return {
    chain: "monad" as const,
    tokenName: "Tokenized Real-World Asset",
    tokenSymbol: "TRWA",
    decimals: 18,
    adminAddress: demoAdminAddress,
    rule: {
      allowedGroup: "II",
      allowedSubGroup: "AI",
      minTier: 0,
      minSubTier: 0,
    },
    icon: "https://assets.example.com/trwa.svg",
  };
}

export function fullLaunchATokenInput() {
  return {
    ...minimalLaunchATokenInput(),
    rule: {
      allowedGroup: "II",
      allowedSubGroup: "AI",
      minTier: 20,
      minSubTier: 10,
      isBlackList: false,
      countries: ["US", "GB", "DE", "SG"],
    },
    callbackUrl:
      "https://api.example.com/webhooks/cleanverse/atoken",
  };
}

export function launchATokenResponseData() {
  return {
    requestId: demoApplicationRequestId,
    issueAssetId: 28,
    ignoredUpstreamField: "discard-me",
  };
}

export function applicationData(
  applyStatus:
    | "PENDING"
    | "APPROVED"
    | "ISSUING"
    | "ISSUED"
    | "REJECTED"
    | "ISSUE_FAILED",
) {
  const shared = {
    flowType: "LAUNCH",
    requestId: demoApplicationRequestId,
    applyStatus,
    chain: "monad",
    tokenSymbol: "TRWA",
    ignoredUpstreamField: "discard-me",
  };

  switch (applyStatus) {
    case "ISSUED":
      return {
        ...shared,
        atokenAddress: demoATokenAddress,
        txHash: demoTransactionHash,
        issuedAt: "2026-08-08 12:05:00",
        issueErrorMsg: "",
        callbackUrl:
          "https://api.example.com/webhooks/cleanverse/atoken",
        callbackStatus: "SUCCESS",
        callbackAttempts: 1,
      };
    case "REJECTED":
      return {
        ...shared,
        rejectReason: "sensitive-upstream-rejection-marker",
        callbackStatus: "FAILED",
        callbackAttempts: 3,
        callbackLastError: "sensitive-callback-error-marker",
      };
    case "ISSUE_FAILED":
      return {
        ...shared,
        issueErrorMsg: "sensitive-upstream-issuance-marker",
      };
    default:
      return shared;
  }
}
