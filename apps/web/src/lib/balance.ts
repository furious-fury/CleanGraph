import {
  createMonadChain,
  formatTrwaAmount,
  readTrwaBalance,
} from "@cleangraph/contracts"
import { createPublicClient, http, type Address } from "viem"

import type { FrontendConfig } from "@/lib/config"

export type TrwaBalance = {
  raw: bigint
  formatted: string
}

type BalanceDependencies = {
  getChainId(): Promise<number>
  readBalance(account: Address): Promise<bigint>
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
  dependencies: BalanceDependencies,
): Promise<TrwaBalance> {
  const actualChainId = await dependencies.getChainId()

  if (actualChainId !== config.chainId) {
    throw new BalanceNetworkMismatchError(actualChainId, config.chainId)
  }

  const raw = await dependencies.readBalance(account)
  return { raw, formatted: formatTrwaAmount(raw) }
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

export function getBalanceErrorMessage(error: unknown): string {
  if (error instanceof BalanceNetworkMismatchError) return error.message
  return "The TRWA balance could not be read from Monad. Check the RPC connection and try again."
}
