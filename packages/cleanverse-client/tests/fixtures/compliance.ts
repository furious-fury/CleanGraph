export const activeAPassData = {
  cvRecordId: "cv-record-001",
  subTier: 12,
  tier: "30",
  status: 1,
  expirationTime: 1_863_690_034,
  subGroup: "AI",
  currentKycHash:
    "3557683c1e62fb7dc8ef438e81cb4ffdf4c6077f8616ce759ac2fff850ba31d9",
  group: "II",
  countries: ["GB", "US"],
  ignoredUpstreamField: "not-public",
};

export const frozenAPassData = {
  cvRecordId: "cv-record-002",
  subTier: 12,
  tier: "30",
  status: 2,
  expirationTime: 1_863_690_034,
  subGroup: "AI",
  currentKycHash:
    "4557683c1e62fb7dc8ef438e81cb4ffdf4c6077f8616ce759ac2fff850ba31d9",
  group: "II",
  countries: [],
};

export const atokenRulesData = {
  chain: "monad",
  atoken_address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  rules: [
    {
      allowed_group: "II",
      allowed_sub_group: "AI",
      min_tier: 20,
      min_sub_tier: 10,
      is_black_list: false,
      countries: ["US", "GB", "DE", "SG"],
      ignoredRuleField: "not-public",
    },
    {
      allowed_group: "",
      allowed_sub_group: "",
      min_tier: 0,
      min_sub_tier: 0,
      is_black_list: true,
      countries: ["BR"],
    },
  ],
  ignoredUpstreamField: "not-public",
};

export function verificationData(code: 1 | 2 | 3 | 4) {
  return {
    chain: "monad",
    atoken: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    code,
    message: `sanitized verification result ${code}`,
    magickLink: "https://register.cleanverse.example/apass/sanitized",
    ignoredUpstreamField: "not-public",
  };
}
