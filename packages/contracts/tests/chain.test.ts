import { describe, expect, it } from "vitest";

import {
  createMonadChain,
  getExplorerAddressUrl,
  getExplorerTransactionUrl,
} from "../src/chain.js";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const HASH = `0x${"ab".repeat(32)}` as const;

describe("Monad chain configuration", () => {
  it("constructs a chain from validated caller configuration", () => {
    const chain = createMonadChain({
      chainId: 10_143,
      rpcUrl: "https://rpc.testnet.monad.xyz",
      explorerUrl: "https://testnet.monadexplorer.com",
      name: "Monad Testnet",
    });
    expect(chain.id).toBe(10_143);
    expect(chain.rpcUrls.default.http).toEqual(["https://rpc.testnet.monad.xyz/"]);
    expect(chain.nativeCurrency.symbol).toBe("MON");
  });

  it.each([
    { chainId: 0, rpcUrl: "https://rpc.example", explorerUrl: "https://explorer.example" },
    { chainId: 1.1, rpcUrl: "https://rpc.example", explorerUrl: "https://explorer.example" },
    { chainId: 1, rpcUrl: "http://rpc.example", explorerUrl: "https://explorer.example" },
    { chainId: 1, rpcUrl: "https://user:pass@rpc.example", explorerUrl: "https://explorer.example" },
    { chainId: 1, rpcUrl: "https://rpc.example", explorerUrl: "not-a-url" },
  ])("rejects unsafe configuration", (config) => {
    expect(() => createMonadChain(config)).toThrow();
  });

  it("builds safe address and transaction explorer URLs", () => {
    expect(getExplorerAddressUrl("https://explorer.example/base", ADDRESS)).toBe(
      `https://explorer.example/base/address/${ADDRESS}`,
    );
    expect(getExplorerTransactionUrl("https://explorer.example", HASH)).toBe(
      `https://explorer.example/tx/${HASH}`,
    );
    expect(() => getExplorerTransactionUrl("https://explorer.example", "0x12")).toThrow();
  });
});
