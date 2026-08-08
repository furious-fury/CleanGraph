import { formatUnits, maxUint256, parseUnits } from "viem";

import { TRWA_DECIMALS } from "./metadata.js";

const DECIMAL_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export function parseTrwaAmount(value: string): bigint {
  if (value !== value.trim() || !DECIMAL_AMOUNT.test(value)) {
    throw new TypeError("TRWA amount must be an unsigned decimal string");
  }

  const fraction = value.split(".")[1];
  if (fraction !== undefined && fraction.length > TRWA_DECIMALS) {
    throw new RangeError("TRWA amount supports at most 18 decimal places");
  }

  const amount = parseUnits(value, TRWA_DECIMALS);
  if (amount <= 0n) {
    throw new RangeError("TRWA amount must be greater than zero");
  }
  if (amount > maxUint256) {
    throw new RangeError("TRWA amount exceeds uint256");
  }
  return amount;
}

export function formatTrwaAmount(value: bigint): string {
  if (value < 0n || value > maxUint256) {
    throw new RangeError("TRWA base-unit amount must fit uint256");
  }
  return formatUnits(value, TRWA_DECIMALS);
}
