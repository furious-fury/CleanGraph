import { describe, expect, it } from "vitest"

import {
  MONAD_TESTNET_CHAIN_ID,
  TRWA_TOKEN_ADDRESS,
  resolveFrontendConfig,
} from "@/lib/config"

const validEnvironment = {
  VITE_API_BASE_URL: "http://localhost:3000",
  VITE_MONAD_CHAIN_ID: String(MONAD_TESTNET_CHAIN_ID),
  VITE_MONAD_RPC_URL: "https://rpc.testnet.monad.xyz",
  VITE_MONAD_EXPLORER_URL: "https://testnet.monadexplorer.com",
}

describe("frontend configuration", () => {
  it("normalizes the public Monad configuration", () => {
    expect(resolveFrontendConfig(validEnvironment)).toEqual({
      ok: true,
      config: {
        apiBaseUrl: "http://localhost:3000",
        chainId: MONAD_TESTNET_CHAIN_ID,
        rpcUrl: "https://rpc.testnet.monad.xyz",
        explorerUrl: "https://testnet.monadexplorer.com",
        tokenAddress: TRWA_TOKEN_ADDRESS,
      },
    })
  })

  it("fails closed when chain services are missing", () => {
    const result = resolveFrontendConfig({ VITE_API_BASE_URL: "http://localhost:3000" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain("required")
  })

  it("rejects a non-Monad chain and insecure remote RPC", () => {
    expect(resolveFrontendConfig({ ...validEnvironment, VITE_MONAD_CHAIN_ID: "1" }).ok).toBe(false)
    expect(resolveFrontendConfig({ ...validEnvironment, VITE_MONAD_RPC_URL: "http://rpc.example" }).ok).toBe(false)
  })

  it("keeps the public Privy app ID optional", () => {
    const result = resolveFrontendConfig({ ...validEnvironment, VITE_PRIVY_APP_ID: "clean-graph-demo" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.config.privyAppId).toBe("clean-graph-demo")
  })
})
