import { afterEach, describe, expect, it, vi } from "vitest"

import type { FrontendConfig } from "@/lib/config"
import { requestPreflight, requestReadiness } from "@/lib/api"

const config: FrontendConfig = {
  apiBaseUrl: "http://localhost:3000",
  chainId: 10_143,
  rpcUrl: "https://rpc.example",
  explorerUrl: "https://explorer.example",
  tokenAddress: "0x07DF3e225e2a7e67056078cF240eF5A3bD966CB4",
}

const intent = {
  chain: "monad" as const,
  sender: "0x1111111111111111111111111111111111111111",
  recipient: "0x2222222222222222222222222222222222222222",
  tokenAddress: config.tokenAddress,
  amount: "1",
}

afterEach(() => vi.unstubAllGlobals())

describe("frontend API client", () => {
  it("enables readiness only for a configured preflight service", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "ready",
      checks: { preflightService: true },
      requestId: "01a94fa1-0a53-4ddc-b07c-c99f792ab5f4",
    }), { status: 200, headers: { "Content-Type": "application/json" } })))

    await expect(requestReadiness(config)).resolves.toEqual({
      ready: true,
      requestId: "01a94fa1-0a53-4ddc-b07c-c99f792ab5f4",
    })
  })

  it("accepts only a contract-valid approval", async () => {
    const approval = {
      requestId: "01a94fa1-0a53-4ddc-b07c-c99f792ab5f4",
      approved: true,
      decisionCode: "TRANSFER_APPROVED",
      checks: [{
        id: "asset-policy",
        source: "cleangraph",
        status: "approved",
        code: "LOCAL_ASSET_POLICY_PASSED",
        message: "The local TRWA policy passed.",
        checkedAt: "2026-08-09T00:00:00.000Z",
      }],
    }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(approval), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(requestPreflight(config, intent)).resolves.toEqual(approval)
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual(intent)
  })

  it("rejects malformed success payloads before they can enable signing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      approved: true,
      decisionCode: "TRANSFER_APPROVED",
      checks: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } })))

    await expect(requestPreflight(config, intent)).rejects.toThrow("invalid response")
  })
})
