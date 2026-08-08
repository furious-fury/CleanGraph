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

const credentialStorageKey = "cleangraph.mera.credential"

let session: Secp256k1SigningSession | undefined

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
}

export function getMeraErrorMessage(error: unknown): string {
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

  return { address: toViemAccount(session).address }
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
