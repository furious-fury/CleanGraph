import { describe, expect, it, vi } from "vitest"
import type { Address } from "viem"

import type { FrontendConfig } from "@/lib/config"
import {
  BalanceNetworkMismatchError,
  loadTrwaBalance,
} from "@/lib/balance"

const config: FrontendConfig = {
  apiBaseUrl: "http://localhost:3000",
  chainId: 10_143,
  rpcUrl: "https://rpc.example",
  explorerUrl: "https://explorer.example",
  tokenAddress: "0x07DF3e225e2a7e67056078cF240eF5A3bD966CB4",
}

const account = "0x1111111111111111111111111111111111111111" as Address

describe("TRWA balance", () => {
  it("reads and formats the exact 18-decimal balance", async () => {
    const readBalance = vi.fn().mockResolvedValue(1_234_567_890_123_456_789n)

    await expect(loadTrwaBalance(config, account, {
      getChainId: vi.fn().mockResolvedValue(10_143),
      readBalance,
    })).resolves.toEqual({
      raw: 1_234_567_890_123_456_789n,
      formatted: "1.234567890123456789",
    })
    expect(readBalance).toHaveBeenCalledWith(account)
  })

  it("does not read the contract when the RPC is on the wrong chain", async () => {
    const readBalance = vi.fn()

    await expect(loadTrwaBalance(config, account, {
      getChainId: vi.fn().mockResolvedValue(1),
      readBalance,
    })).rejects.toBeInstanceOf(BalanceNetworkMismatchError)
    expect(readBalance).not.toHaveBeenCalled()
  })
})
