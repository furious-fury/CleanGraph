import {
  createMonadChain,
  formatTrwaAmount,
  readTrwaBalance,
} from "@cleangraph/contracts"
import { createPublicClient, formatUnits, http, type Address } from "viem"

import type { FrontendConfig } from "@/lib/config"

export type TrwaBalance = {
  raw: bigint
  formatted: string
}

export type WalletBalances = {
  native: {
    raw: bigint
    formatted: string
  }
  trwa: TrwaBalance | null
}

type TrwaBalanceDependencies = {
  getChainId(): Promise<number>
  readBalance(account: Address): Promise<bigint>
}

type WalletBalanceDependencies = {
  getChainId(): Promise<number>
  readNativeBalance(account: Address): Promise<bigint>
  readTrwaBalance(account: Address): Promise<bigint>
}

export class BalanceNetworkMismatchError extends Error {
  constructor(actualChainId: number, expectedChainId: number) {
    super(`The balance RPC is connected to chain ${actualChainId}; expected Monad Testnet ${expectedChainId}.`)
    this.name = "BalanceNetworkMismatchError"
  }
}

export async function loadTrwaBalance(
  config: FrontendConfig,
  account: Address,
  dependencies: TrwaBalanceDependencies,
): Promise<TrwaBalance> {
  const actualChainId = await dependencies.getChainId()

  if (actualChainId !== config.chainId) {
    throw new BalanceNetworkMismatchError(actualChainId, config.chainId)
  }

  const raw = await dependencies.readBalance(account)
  return { raw, formatted: formatTrwaAmount(raw) }
}

export function formatNativeBalance(raw: bigint): string {
  const [whole, fraction = ""] = formatUnits(raw, 18).split(".")
  const visibleFraction = fraction.slice(0, 6).replace(/0+$/, "")

  if (visibleFraction) return `${whole}.${visibleFraction}`
  if (raw > 0n && whole === "0") return "<0.000001"
  return whole
}

export async function loadWalletBalances(
  config: FrontendConfig,
  account: Address,
  dependencies: WalletBalanceDependencies,
): Promise<WalletBalances> {
  const actualChainId = await dependencies.getChainId()

  if (actualChainId !== config.chainId) {
    throw new BalanceNetworkMismatchError(actualChainId, config.chainId)
  }

  const [nativeResult, trwaResult] = await Promise.allSettled([
    dependencies.readNativeBalance(account),
    dependencies.readTrwaBalance(account),
  ])

  if (nativeResult.status === "rejected") throw nativeResult.reason

  return {
    native: {
      raw: nativeResult.value,
      formatted: formatNativeBalance(nativeResult.value),
    },
    trwa: trwaResult.status === "fulfilled"
      ? { raw: trwaResult.value, formatted: formatTrwaAmount(trwaResult.value) }
      : null,
  }
}

export async function requestTrwaBalance(
  config: FrontendConfig,
  account: Address,
): Promise<TrwaBalance> {
  const chain = createMonadChain({
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    explorerUrl: config.explorerUrl,
    name: "Monad Testnet",
  })
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  })

  return loadTrwaBalance(config, account, {
    getChainId: () => publicClient.getChainId(),
    readBalance: (address) => readTrwaBalance(publicClient, config.tokenAddress, address),
  })
}

export async function requestWalletBalances(
  config: FrontendConfig,
  account: Address,
): Promise<WalletBalances> {
  const chain = createMonadChain({
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    explorerUrl: config.explorerUrl,
    name: "Monad Testnet",
  })
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  })

  return loadWalletBalances(config, account, {
    getChainId: () => publicClient.getChainId(),
    readNativeBalance: (address) => publicClient.getBalance({ address }),
    readTrwaBalance: (address) => readTrwaBalance(publicClient, config.tokenAddress, address),
  })
}

export function getBalanceErrorMessage(error: unknown): string {
  if (error instanceof BalanceNetworkMismatchError) return error.message
  return "Wallet balances could not be read from Monad. Check the RPC connection and try again."
}
