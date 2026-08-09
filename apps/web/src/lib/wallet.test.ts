import type { EIP1193Provider } from "viem"
import { describe, expect, it, vi } from "vitest"

import {
  createExternalEvmWallet,
  ExternalWalletIdentityMismatchError,
  ExternalWalletSignatureError,
  type ExternalWalletPort,
} from "@/lib/wallet"

const address = "0x1111111111111111111111111111111111111111" as const
const otherAddress = "0x2222222222222222222222222222222222222222" as const
const signature = `0x${"ab".repeat(65)}` as const

function walletPort(overrides: Partial<ExternalWalletPort> = {}) {
  const provider = { request: vi.fn() } as unknown as EIP1193Provider
  const port: ExternalWalletPort = {
    address,
    label: "MetaMask",
    sign: vi.fn().mockResolvedValue(signature),
    switchChain: vi.fn().mockResolvedValue(undefined),
    getProvider: vi.fn().mockResolvedValue(provider),
    disconnect: vi.fn(),
    ...overrides,
  }
  return { port, provider }
}

describe("external EVM wallet adapter", () => {
  it("signs an A-Pass challenge only for the connected address", async () => {
    const { port } = walletPort()
    const wallet = createExternalEvmWallet(port)

    await expect(wallet.signMessage(address, "CleanGraph challenge")).resolves.toBe(signature)
    expect(port.sign).toHaveBeenCalledWith("CleanGraph challenge")

    await expect(wallet.signMessage(otherAddress, "wrong wallet")).rejects.toBeInstanceOf(
      ExternalWalletIdentityMismatchError,
    )
    expect(port.sign).toHaveBeenCalledTimes(1)
  })

  it("switches to Monad before exposing the provider for settlement", async () => {
    const calls: string[] = []
    const { port, provider } = walletPort({
      switchChain: vi.fn(async () => { calls.push("switch") }),
      getProvider: vi.fn(async () => { calls.push("provider"); return provider }),
    })
    const wallet = createExternalEvmWallet(port)

    await expect(wallet.prepareProvider(address, 10_143)).resolves.toBe(provider)
    expect(port.switchChain).toHaveBeenCalledWith(10_143)
    expect(calls).toEqual(["switch", "provider"])
  })

  it("rejects a malformed wallet signature", async () => {
    const { port } = walletPort({ sign: vi.fn().mockResolvedValue("not-a-signature") })
    const wallet = createExternalEvmWallet(port)

    await expect(wallet.signMessage(address, "challenge")).rejects.toBeInstanceOf(
      ExternalWalletSignatureError,
    )
  })
})
