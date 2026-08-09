import {
  getAddress,
  isHex,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem"

export type ExternalEvmWallet = {
  address: Address
  label: string
  signMessage(expectedAddress: Address, message: string): Promise<Hex>
  prepareProvider(expectedAddress: Address, chainId: number): Promise<EIP1193Provider>
  disconnect(): void
}

export type ExternalWalletController = {
  enabled: boolean
  wallet: ExternalEvmWallet | null
  connect(): Promise<ExternalEvmWallet>
  disconnect(): void
}

export type ExternalWalletPort = {
  address: string
  label: string
  sign(message: string): Promise<string>
  switchChain(chainId: number): Promise<void>
  getProvider(): Promise<EIP1193Provider>
  disconnect(): void
}

export function createExternalEvmWallet(port: ExternalWalletPort): ExternalEvmWallet {
  const address = getAddress(port.address)

  return {
    address,
    label: port.label || "External wallet",
    async signMessage(expectedAddress, message) {
      assertWalletAddress(address, expectedAddress)
      const signature = await port.sign(message)
      if (!isHex(signature)) throw new ExternalWalletSignatureError()
      return signature
    },
    async prepareProvider(expectedAddress, chainId) {
      assertWalletAddress(address, expectedAddress)
      await port.switchChain(chainId)
      return port.getProvider()
    },
    disconnect: port.disconnect,
  }
}

export const disabledExternalWalletController: ExternalWalletController = {
  enabled: false,
  wallet: null,
  async connect() {
    throw new ExternalWalletUnavailableError()
  },
  disconnect() {},
}

export function getExternalWalletErrorMessage(error: unknown): string {
  if (error instanceof ExternalWalletIdentityMismatchError) return error.message
  if (error instanceof ExternalWalletUnavailableError) return error.message

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (message.includes("reject") || message.includes("cancel") || message.includes("closed")) {
      return "The external wallet request was cancelled. No signature or transaction was sent."
    }
    if (message.includes("chain") || message.includes("network")) {
      return "Switch the connected wallet to Monad Testnet and try again."
    }
  }

  return "CleanGraph could not use the external wallet. Reconnect it and try again."
}

function assertWalletAddress(actualAddress: Address, expectedAddress: Address): void {
  if (actualAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new ExternalWalletIdentityMismatchError()
  }
}

export class ExternalWalletUnavailableError extends Error {
  constructor() {
    super("External wallets are not configured. Add VITE_PRIVY_APP_ID and restart the frontend.")
    this.name = "ExternalWalletUnavailableError"
  }
}

export class ExternalWalletConnectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExternalWalletConnectionError"
  }
}

export class ExternalWalletIdentityMismatchError extends Error {
  constructor() {
    super("The connected external wallet does not match the wallet used for preflight. Reconnect the original sender.")
    this.name = "ExternalWalletIdentityMismatchError"
  }
}

export class ExternalWalletSignatureError extends Error {
  constructor() {
    super("The external wallet returned an invalid message signature.")
    this.name = "ExternalWalletSignatureError"
  }
}
