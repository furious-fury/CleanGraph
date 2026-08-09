import {
  confirmTrwaTransfer,
  createMonadChain,
  getExplorerTransactionUrl,
  parseTrwaAmount,
  simulateTrwaTransfer,
} from "@cleangraph/contracts"
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Account,
  type Address,
  type Hash,
} from "viem"
import { isMeraError } from "@category-labs/mera"

import type { FrontendConfig } from "@/lib/config"
import {
  ExternalWalletIdentityMismatchError,
  getExternalWalletErrorMessage,
  type ExternalEvmWallet,
} from "@/lib/wallet"
import {
  authorizeMeraSigning,
  getMeraErrorMessage,
  WalletIdentityMismatchError,
} from "@/lib/mera-wallet"

export type ApprovedTransfer = {
  sender: Address
  recipient: Address
  amount: string
}

export type ConfirmedTransfer = {
  transactionHash: Hash
  explorerUrl: string
  blockNumber?: bigint
}

export type TransferPhase = "authorizing" | "simulating" | "signing" | "confirming"

type TransferPipelineDependencies = {
  authorizeAccount(expectedAddress: Address): Promise<Account | Address>
  getChainId(): Promise<number>
  simulate(input: {
    account: Account | Address
    recipient: Address
    amount: bigint
  }): Promise<unknown>
  write(simulation: unknown): Promise<Hash>
  confirm(hash: Hash): Promise<{ blockNumber?: bigint }>
}

export type TransferWallet =
  | { kind: "mera" }
  | { kind: "external"; wallet: ExternalEvmWallet }

export class WrongMonadNetworkError extends Error {
  constructor(actualChainId: number, expectedChainId: number) {
    super(`The RPC is connected to chain ${actualChainId}; expected Monad Testnet ${expectedChainId}.`)
    this.name = "WrongMonadNetworkError"
  }
}

export async function runTransferPipeline(
  config: FrontendConfig,
  transfer: ApprovedTransfer,
  dependencies: TransferPipelineDependencies,
  onPhase?: (phase: TransferPhase, transactionHash?: Hash) => void,
): Promise<ConfirmedTransfer> {
  const amount = parseTrwaAmount(transfer.amount)
  const actualChainId = await dependencies.getChainId()

  if (actualChainId !== config.chainId) {
    throw new WrongMonadNetworkError(actualChainId, config.chainId)
  }

  onPhase?.("authorizing")
  const account = await dependencies.authorizeAccount(transfer.sender)
  onPhase?.("simulating")
  const simulation = await dependencies.simulate({
    account,
    recipient: transfer.recipient,
    amount,
  })
  onPhase?.("signing")
  const transactionHash = await dependencies.write(simulation)
  onPhase?.("confirming", transactionHash)
  const receipt = await dependencies.confirm(transactionHash)

  return {
    transactionHash,
    explorerUrl: getExplorerTransactionUrl(config.explorerUrl, transactionHash),
    ...(receipt.blockNumber === undefined ? {} : { blockNumber: receipt.blockNumber }),
  }
}

export async function executeApprovedTransfer(
  config: FrontendConfig,
  transfer: ApprovedTransfer,
  transferWallet: TransferWallet,
  onPhase?: (phase: TransferPhase, transactionHash?: Hash) => void,
): Promise<ConfirmedTransfer> {
  const chain = createMonadChain({
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    explorerUrl: config.explorerUrl,
    name: "Monad Testnet",
  })
  const transport = http(config.rpcUrl)
  const publicClient = createPublicClient({ chain, transport })
  type TransferRequest = Awaited<ReturnType<typeof simulateTrwaTransfer>>["request"]
  let writeAuthorizedContract: ((request: TransferRequest) => Promise<Hash>) | undefined

  return runTransferPipeline(config, transfer, {
    async authorizeAccount(expectedAddress) {
      if (transferWallet.kind === "mera") {
        const authorizedAccount = await authorizeMeraSigning(expectedAddress)
        const walletClient = createWalletClient({
          account: authorizedAccount,
          chain,
          transport,
        })
        writeAuthorizedContract = (request) => walletClient.writeContract(request)
        return authorizedAccount
      }

      const provider = await transferWallet.wallet.prepareProvider(expectedAddress, config.chainId)
      const walletClient = createWalletClient({
        account: transferWallet.wallet.address,
        chain,
        transport: custom(provider),
      })
      writeAuthorizedContract = (request) => walletClient.writeContract(request)
      return transferWallet.wallet.address
    },
    getChainId: () => publicClient.getChainId(),
    async simulate({ account, recipient, amount }) {
      return simulateTrwaTransfer(publicClient, {
        tokenAddress: config.tokenAddress,
        account,
        recipient,
        amount,
      })
    },
    async write(simulation) {
      if (writeAuthorizedContract === undefined) {
        throw new Error("The wallet was not authorized for signing.")
      }
      const request = (simulation as Awaited<ReturnType<typeof simulateTrwaTransfer>>).request
      return writeAuthorizedContract(request)
    },
    confirm: (hash) => confirmTrwaTransfer(publicClient, hash),
  }, onPhase)
}

export function getTransferErrorMessage(error: unknown): string {
  if (error instanceof WrongMonadNetworkError) return error.message
  if (error instanceof ExternalWalletIdentityMismatchError) {
    return getExternalWalletErrorMessage(error)
  }
  if (error instanceof WalletIdentityMismatchError || isMeraError(error)) {
    return getMeraErrorMessage(error)
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (message.includes("user rejected") || message.includes("rejected the request")) {
      return "The wallet authorization was rejected. No transaction was sent."
    }

    if (message.includes("insufficient funds")) {
      return "The sender does not have enough MON for gas or enough TRWA for this transfer."
    }

    if (message.includes("revert")) {
      return "The TRWA transfer reverted on Monad. No successful settlement was recorded."
    }
  }

  return "The transfer could not be completed. Review the wallet and network, then run preflight again."
}
