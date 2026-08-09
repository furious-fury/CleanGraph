import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DemoAPassApiError,
  requestDemoAPassChallenge,
  requestDemoAPassEnrollment,
  waitForDemoAPassActivation,
} from "@/lib/apass"
import type { FrontendConfig } from "@/lib/config"

const config: FrontendConfig = {
  apiBaseUrl: "http://localhost:3000",
  chainId: 10_143,
  rpcUrl: "https://rpc.example",
  explorerUrl: "https://explorer.example",
  tokenAddress: "0x07DF3e225e2a7e67056078cF240eF5A3bD966CB4",
}

const walletAddress = "0x1111111111111111111111111111111111111111"
const transactionHash = `0x${"ab".repeat(32)}` as const

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("demo A-Pass API client", () => {
  it("requests a wallet-bound challenge", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      requestId: "request-1",
      challengeId: "challenge-1",
      message: "Sign this CleanGraph challenge",
      expiresAt: "2026-08-09T01:00:00.000Z",
    }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(requestDemoAPassChallenge(config, walletAddress)).resolves.toMatchObject({
      challengeId: "challenge-1",
      message: "Sign this CleanGraph challenge",
    })
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({ walletAddress })
  })

  it("submits only the selected fictional profile and signed challenge", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      requestId: "request-2",
      enrollmentId: "enrollment-1",
      state: "PENDING",
      walletAddress,
      transactionHash,
    }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(requestDemoAPassEnrollment(config, {
      walletAddress,
      challengeId: "challenge-1",
      signature: "0x1234",
      profile: "ELIGIBLE_GB",
    })).resolves.toMatchObject({ state: "PENDING", enrollmentId: "enrollment-1" })

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      walletAddress,
      challengeId: "challenge-1",
      signature: "0x1234",
      profile: "ELIGIBLE_GB",
    })
  })

  it("polls a pending enrollment until it becomes active", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        requestId: "request-3",
        enrollmentId: "enrollment-1",
        state: "ACTIVE",
        walletAddress,
        transactionHash,
      }))
    vi.stubGlobal("fetch", fetchMock)

    const activation = waitForDemoAPassActivation(config, {
      requestId: "request-2",
      enrollmentId: "enrollment-1",
      state: "PENDING",
      walletAddress,
      transactionHash,
    }, { intervalMs: 10 })

    await vi.advanceTimersByTimeAsync(10)
    await expect(activation).resolves.toMatchObject({ state: "ACTIVE" })
  })

  it("preserves safe API error codes and request IDs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      requestId: "request-error",
      error: { code: "DEMO_MODE_DISABLED", message: "Demo mode is disabled." },
    }, 503)))

    const error = await requestDemoAPassChallenge(config, walletAddress).catch((caught) => caught)
    expect(error).toBeInstanceOf(DemoAPassApiError)
    expect(error).toMatchObject({ code: "DEMO_MODE_DISABLED", requestId: "request-error", status: 503 })
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
