import type { Address } from "viem"

export const TRWA_TOKEN_ADDRESS = "0x07DF3e225e2a7e67056078cF240eF5A3bD966CB4" as Address
export const MONAD_TESTNET_CHAIN_ID = 10_143

export type FrontendConfig = {
  apiBaseUrl: string
  chainId: number
  rpcUrl: string
  explorerUrl: string
  tokenAddress: Address
  privyAppId?: string
}

export type FrontendConfigResult =
  | { ok: true; config: FrontendConfig }
  | { ok: false; message: string }

type PublicEnvironment = Record<string, string | boolean | undefined>

export function resolveFrontendConfig(environment: PublicEnvironment): FrontendConfigResult {
  try {
    const apiBaseUrl = parseUrl(
      stringValue(environment.VITE_API_BASE_URL) ?? "http://localhost:3000",
      "VITE_API_BASE_URL",
      true,
    )
    const chainId = parseChainId(
      stringValue(environment.VITE_MONAD_CHAIN_ID) ?? String(MONAD_TESTNET_CHAIN_ID),
    )
    const rpcValue = stringValue(environment.VITE_MONAD_RPC_URL)
    const explorerValue = stringValue(environment.VITE_MONAD_EXPLORER_URL)
    const privyAppId = stringValue(environment.VITE_PRIVY_APP_ID)

    if (!rpcValue || !explorerValue) {
      return {
        ok: false,
        message: "Monad RPC and explorer configuration are required before transfers can run.",
      }
    }

    return {
      ok: true,
      config: {
        apiBaseUrl,
        chainId,
        rpcUrl: parseUrl(rpcValue, "VITE_MONAD_RPC_URL", false),
        explorerUrl: parseUrl(explorerValue, "VITE_MONAD_EXPLORER_URL", false),
        tokenAddress: TRWA_TOKEN_ADDRESS,
        ...(privyAppId === undefined ? {} : { privyAppId }),
      },
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The public frontend configuration is invalid.",
    }
  }
}

function stringValue(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined
}

function parseChainId(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new TypeError("VITE_MONAD_CHAIN_ID must be an integer.")
  }

  const chainId = Number(value)

  if (chainId !== MONAD_TESTNET_CHAIN_ID) {
    throw new RangeError(`VITE_MONAD_CHAIN_ID must be ${MONAD_TESTNET_CHAIN_ID}.`)
  }

  return chainId
}

function parseUrl(value: string, field: string, allowLocalHttp: boolean): string {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new TypeError(`${field} must be a valid URL.`)
  }

  const isLocalHttp =
    allowLocalHttp &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)

  if (
    (url.protocol !== "https:" && !isLocalHttp) ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new TypeError(`${field} must be a credential-free HTTPS URL.`)
  }

  return url.toString().replace(/\/$/, "")
}
