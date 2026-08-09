import { describe, expect, it, vi } from "vitest"
import type { Address } from "viem"

import type { FrontendConfig } from "@/lib/config"
import {
  BalanceNetworkMismatchError,
  formatNativeBalance,
  loadTrwaBalance,
  loadWalletBalances,
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

describe("wallet balances", () => {
  it("reads and formats native MON alongside TRWA", async () => {
    await expect(loadWalletBalances(config, account, {
      getChainId: vi.fn().mockResolvedValue(10_143),
      readNativeBalance: vi.fn().mockResolvedValue(12_345_678_900_000_000_000n),
      readTrwaBalance: vi.fn().mockResolvedValue(2_500_000_000_000_000_000n),
    })).resolves.toEqual({
      native: {
        raw: 12_345_678_900_000_000_000n,
        formatted: "12.345678",
      },
      trwa: {
        raw: 2_500_000_000_000_000_000n,
        formatted: "2.5",
      },
    })
  })

  it("keeps very small native balances visible", () => {
    expect(formatNativeBalance(1n)).toBe("<0.000001")
    expect(formatNativeBalance(0n)).toBe("0")
  })

  it("keeps MON available when the TRWA contract read fails", async () => {
    await expect(loadWalletBalances(config, account, {
      getChainId: vi.fn().mockResolvedValue(10_143),
      readNativeBalance: vi.fn().mockResolvedValue(1_000_000_000_000_000_000n),
      readTrwaBalance: vi.fn().mockRejectedValue(new Error("contract unavailable")),
    })).resolves.toEqual({
      native: {
        raw: 1_000_000_000_000_000_000n,
        formatted: "1",
      },
      trwa: null,
    })
  })

  it("does not read balances when the RPC is on the wrong chain", async () => {
    const readNativeBalance = vi.fn()
    const readTrwaBalance = vi.fn()

    await expect(loadWalletBalances(config, account, {
      getChainId: vi.fn().mockResolvedValue(1),
      readNativeBalance,
      readTrwaBalance,
    })).rejects.toBeInstanceOf(BalanceNetworkMismatchError)
    expect(readNativeBalance).not.toHaveBeenCalled()
    expect(readTrwaBalance).not.toHaveBeenCalled()
  })
})
