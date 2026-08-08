import { describe, expect, it } from "vitest";

import { formatTrwaAmount, parseTrwaAmount } from "../src/amount.js";

describe("TRWA amounts", () => {
  it("parses and formats decimal-safe amounts", () => {
    expect(parseTrwaAmount("1")).toBe(10n ** 18n);
    expect(parseTrwaAmount("1.000000000000000001")).toBe(1_000_000_000_000_000_001n);
    expect(formatTrwaAmount(1_250_000_000_000_000_000n)).toBe("1.25");
    expect(formatTrwaAmount(0n)).toBe("0");
  });

  it.each(["0", "0.0", "-1", "+1", " 1", "1 ", "1e3", "one", "01"])(
    "rejects invalid or zero input %s",
    (value) => expect(() => parseTrwaAmount(value)).toThrow(),
  );

  it("rejects excessive precision and uint256 overflow", () => {
    expect(() => parseTrwaAmount("0.0000000000000000001")).toThrow(RangeError);
    expect(() =>
      parseTrwaAmount(
        "115792089237316195423570985008687907853269984665640564039458",
      ),
    ).toThrow(RangeError);
    expect(() => formatTrwaAmount(-1n)).toThrow(RangeError);
  });
});
