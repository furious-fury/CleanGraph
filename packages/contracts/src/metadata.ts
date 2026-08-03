export const TRWA_NAME = "Tokenized Real-World Asset" as const;
export const TRWA_SYMBOL = "TRWA" as const;
export const TRWA_DECIMALS = 18 as const;
export const TRWA_FIXED_SUPPLY = 1_000_000n * 10n ** BigInt(TRWA_DECIMALS);

export const trwaMetadata = {
  name: TRWA_NAME,
  symbol: TRWA_SYMBOL,
  decimals: TRWA_DECIMALS,
  fixedSupply: TRWA_FIXED_SUPPLY,
} as const;
