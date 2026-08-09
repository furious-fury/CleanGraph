import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
  isMeraError,
  type PasskeyCredentialMetadata,
  type Secp256k1SigningSession,
} from "@category-labs/mera"
import { toViemAccount } from "@category-labs/mera/viem"
import { HDKey } from "@scure/bip32"
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39"
import { wordlist } from "@scure/bip39/wordlists/english.js"
import type { Address, Hex, LocalAccount } from "viem"

const credentialStorageKey = "cleangraph.mera.credential"

let session: Secp256k1SigningSession | undefined
let account: LocalAccount<"mera"> | undefined

export type MeraWallet = {
  address: `0x${string}`
}

export async function createMeraWallet(): Promise<MeraWallet> {
  const created = await createPasskeyWithPrfOutput({
    rp: { id: location.hostname, name: "CleanGraph" },
    user: {
      name: "CleanGraph operator",
      displayName: "CleanGraph operator",
    },
  })

  saveCredential({
    credentialId: created.credentialId,
    transports: created.transports,
  })

  return activateSession(created.prfOutput)
}

export async function connectMeraWallet(): Promise<MeraWallet> {
  const knownCredential = getStoredCredential()
  const result = await getPasskeyPrfOutput({
    rpId: location.hostname,
    credential: knownCredential,
  })

  if (knownCredential?.credentialId !== result.credentialId) {
    saveCredential({ credentialId: result.credentialId })
  }

  return activateSession(result.prfOutput)
}

export function disconnectMeraWallet(): void {
  session?.end()
  session = undefined
  account = undefined
}

export async function authorizeMeraSigning(expectedAddress: Address): Promise<LocalAccount<"mera">> {
  const knownCredential = getStoredCredential()
  const result = await getPasskeyPrfOutput({
    rpId: location.hostname,
    credential: knownCredential,
  })
  const wallet = activateSession(result.prfOutput)

  if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase() || account === undefined) {
    disconnectMeraWallet()
    throw new WalletIdentityMismatchError()
  }

  return account
}

export async function signMeraMessage(expectedAddress: Address, message: string): Promise<Hex> {
  const authorizedAccount = await authorizeMeraSigning(expectedAddress)
  return authorizedAccount.signMessage({ message })
}

export function getMeraErrorMessage(error: unknown): string {
  if (error instanceof WalletIdentityMismatchError) {
    return error.message
  }

  if (!isMeraError(error)) {
    return "CleanGraph could not connect the passkey wallet. Please try again."
  }

  switch (error.code) {
    case "PRF_UNAVAILABLE":
      return "This passkey provider does not support the required PRF extension. Try iCloud Keychain, 1Password, or Google Password Manager."
    case "CRYPTO_UNAVAILABLE":
      return "Passkey wallets require HTTPS, or localhost during development."
    case "PASSKEY_OPERATION_FAILED":
      return "The passkey request was cancelled or could not be completed. Please try again."
    default:
      return "CleanGraph could not connect the passkey wallet. Please try again."
  }
}

function activateSession(prfOutput: Uint8Array): MeraWallet {
  disconnectMeraWallet()
  session = createSecp256k1SigningSession({
    privateKey: deriveEvmKey(prfOutput),
  })
  account = toViemAccount(session)

  return { address: account.address }
}

export class WalletIdentityMismatchError extends Error {
  constructor() {
    super("The authorized passkey belongs to a different wallet. Reconnect the original sender and run preflight again.")
    this.name = "WalletIdentityMismatchError"
  }
}

function deriveEvmKey(prfOutput: Uint8Array, index = 0): Uint8Array {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist))
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`)

  if (node.privateKey === null) {
    throw new Error("Passkey derivation did not produce a private key.")
  }

  return node.privateKey
}

function getStoredCredential(): PasskeyCredentialMetadata | undefined {
  try {
    const stored = localStorage.getItem(credentialStorageKey)
    return stored ? (JSON.parse(stored) as PasskeyCredentialMetadata) : undefined
  } catch {
    return undefined
  }
}

function saveCredential(credential: PasskeyCredentialMetadata): void {
  localStorage.setItem(credentialStorageKey, JSON.stringify(credential))
}
