import { afterEach, describe, expect, it, vi } from "vitest"

import {
  DemoAPassApiError,
  getDemoAPassErrorMessage,
  requestDemoAPassChallenge,
  requestDemoAPassEnrollment,
  requestDemoAPassStatus,
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
const challengeId = "223e4567-e89b-42d3-a456-426614174000"
const requestId = "323e4567-e89b-42d3-a456-426614174000"
const transactionHash = `0x${"ab".repeat(32)}` as const
const signature = `0x${"1".repeat(130)}` as `0x${string}`

afterEach(() => vi.unstubAllGlobals())

describe("demo A-Pass API client", () => {
  it("requests a creation challenge bound to the selected profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      challengeId,
      message: "Sign this CleanGraph challenge",
      expiresAt: "2026-08-09T01:00:00.000Z",
    }, 201))
    vi.stubGlobal("fetch", fetchMock)

    await expect(requestDemoAPassChallenge(config, {
      walletAddress,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
    })).resolves.toMatchObject({ challengeId, message: "Sign this CleanGraph challenge" })
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/api/v1/demo/apass/challenges")
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      walletAddress,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
    })
  })

  it("submits the signed creation challenge to the new backend route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      walletAddress,
      status: "PENDING",
      registrationTransactionHash: transactionHash,
    }, 202))
    vi.stubGlobal("fetch", fetchMock)

    await expect(requestDemoAPassEnrollment(config, {
      walletAddress,
      challengeId,
      signature,
      profile: "ELIGIBLE_GB",
    })).resolves.toMatchObject({ status: "PENDING", registrationTransactionHash: transactionHash })
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/api/v1/demo/apasses")
  })

  it("treats the backend's 409 ALREADY_EXISTS response as a safe result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      walletAddress,
      status: "ALREADY_EXISTS",
    }, 409)))

    await expect(requestDemoAPassEnrollment(config, {
      walletAddress,
      challengeId,
      signature,
      profile: "RESTRICTED_BR",
    })).resolves.toMatchObject({ status: "ALREADY_EXISTS" })
  })

  it("checks status with a separately signed status challenge", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      walletAddress,
      status: "ACTIVE",
      registrationTransactionHash: transactionHash,
    }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(requestDemoAPassStatus(config, {
      walletAddress,
      challengeId,
      signature,
    })).resolves.toMatchObject({ status: "ACTIVE" })
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3000/api/v1/demo/apasses/status")
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      walletAddress,
      challengeId,
      signature,
    })
  })

  it("preserves contract-valid API error codes and request IDs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      requestId,
      error: { code: "SERVICE_NOT_CONFIGURED", message: "Demo service is disabled." },
    }, 503)))

    const error = await requestDemoAPassChallenge(config, {
      walletAddress,
      purpose: "STATUS",
    }).catch((caught) => caught)
    expect(error).toBeInstanceOf(DemoAPassApiError)
    expect(error).toMatchObject({ code: "SERVICE_NOT_CONFIGURED", requestId, status: 503 })
  })

  it("explains a Cleanverse A-Pass miss instead of calling the API disabled", () => {
    const error = new DemoAPassApiError({
      code: "APASS_NOT_FOUND",
      message: "Cleanverse does not have an A-Pass for this wallet.",
      requestId,
      status: 404,
    })

    expect(getDemoAPassErrorMessage(error)).toBe(
      "Cleanverse does not have an A-Pass for this wallet. Create one before using it for a transfer.",
    )
  })

  it("preserves the server retry window for rate-limited creation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      requestId,
      error: { code: "RATE_LIMITED", message: "Too many demo A-Pass requests." },
    }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "420" },
    })))

    const error = await requestDemoAPassEnrollment(config, {
      walletAddress,
      challengeId,
      signature,
      profile: "ELIGIBLE_GB",
    }).catch((caught) => caught)

    expect(error).toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 420,
      status: 429,
    })
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
