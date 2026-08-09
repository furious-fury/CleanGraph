import type { Account, Address, Hash } from "viem"
import { describe, expect, it, vi } from "vitest"

import type { FrontendConfig } from "@/lib/config"
import {
  runTransferPipeline,
  WrongMonadNetworkError,
} from "@/lib/transfer"

const sender = "0x1111111111111111111111111111111111111111" as Address
const recipient = "0x2222222222222222222222222222222222222222" as Address
const hash = `0x${"ab".repeat(32)}` as Hash
const account = { address: sender, type: "local" } as Account
const config: FrontendConfig = {
  apiBaseUrl: "http://localhost:3000",
  chainId: 10_143,
  rpcUrl: "https://rpc.example",
  explorerUrl: "https://explorer.example",
  tokenAddress: "0x07DF3e225e2a7e67056078cF240eF5A3bD966CB4",
}

describe("approved transfer pipeline", () => {
  it("authorizes, simulates, signs, and confirms in order", async () => {
    const calls: string[] = []
    const phases: string[] = []
    const dependencies = {
      authorizeAccount: vi.fn(async () => { calls.push("authorize"); return account }),
      getChainId: vi.fn(async () => { calls.push("chain"); return 10_143 }),
      simulate: vi.fn(async (input: { amount: bigint }) => {
        calls.push("simulate")
        expect(input.amount).toBe(1_000_000_000_000_000_001n)
        return { request: "simulation" }
      }),
      write: vi.fn(async () => { calls.push("write"); return hash }),
      confirm: vi.fn(async () => { calls.push("confirm"); return { blockNumber: 42n } }),
    }

    await expect(runTransferPipeline(
      config,
      { sender, recipient, amount: "1.000000000000000001" },
      dependencies,
      (phase) => phases.push(phase),
    )).resolves.toEqual({
      transactionHash: hash,
      explorerUrl: `https://explorer.example/tx/${hash}`,
      blockNumber: 42n,
    })

    expect(calls).toEqual(["chain", "authorize", "simulate", "write", "confirm"])
    expect(phases).toEqual(["authorizing", "simulating", "signing", "confirming"])
  })

  it("stops before simulation and signing on the wrong chain", async () => {
    const simulate = vi.fn()
    const write = vi.fn()
    const authorizeAccount = vi.fn().mockResolvedValue(account)

    await expect(runTransferPipeline(
      config,
      { sender, recipient, amount: "1" },
      {
        authorizeAccount,
        getChainId: vi.fn().mockResolvedValue(1),
        simulate,
        write,
        confirm: vi.fn(),
      },
    )).rejects.toBeInstanceOf(WrongMonadNetworkError)

    expect(simulate).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(authorizeAccount).not.toHaveBeenCalled()
  })

  it("stops when passkey authorization is rejected", async () => {
    const getChainId = vi.fn().mockResolvedValue(10_143)
    const write = vi.fn()

    await expect(runTransferPipeline(
      config,
      { sender, recipient, amount: "1" },
      {
        authorizeAccount: vi.fn().mockRejectedValue(new Error("User rejected the request")),
        getChainId,
        simulate: vi.fn(),
        write,
        confirm: vi.fn(),
      },
    )).rejects.toThrow("User rejected")

    expect(getChainId).toHaveBeenCalledOnce()
    expect(write).not.toHaveBeenCalled()
  })
})
