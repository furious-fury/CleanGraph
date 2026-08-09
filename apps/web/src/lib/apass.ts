import {
  demoAPassChallengeResponseSchema,
  demoAPassErrorResponseSchema,
  demoAPassResponseSchema,
  type DemoAPassChallengePurpose,
  type DemoAPassProfile,
  type DemoAPassPublicStatus,
} from "@cleangraph/shared"
import { getAddress, type Address, type Hash, type Hex } from "viem"

import type { FrontendConfig } from "@/lib/config"

export type { DemoAPassProfile, DemoAPassPublicStatus }

export type DemoAPassChallenge = {
  challengeId: string
  message: string
  expiresAt: string
}

export type DemoAPassEnrollment = {
  walletAddress: Address
  status: DemoAPassPublicStatus
  registrationTransactionHash?: Hash
}

export class DemoAPassApiError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly status: number
  readonly retryAfterSeconds?: number

  constructor(input: { message: string; code: string; status: number; requestId?: string; retryAfterSeconds?: number }) {
    super(input.message)
    this.name = "DemoAPassApiError"
    this.code = input.code
    this.status = input.status
    this.requestId = input.requestId
    this.retryAfterSeconds = input.retryAfterSeconds
  }
}

export async function requestDemoAPassChallenge(
  config: FrontendConfig,
  input: {
    walletAddress: Address
    purpose: DemoAPassChallengePurpose
    profile?: DemoAPassProfile
  },
  signal?: AbortSignal,
): Promise<DemoAPassChallenge> {
  const payload = await requestJson(config, "/api/v1/demo/apass/challenges", {
    method: "POST",
    body: JSON.stringify({
      walletAddress: getAddress(input.walletAddress),
      purpose: input.purpose,
      ...(input.profile === undefined ? {} : { profile: input.profile }),
    }),
    signal,
  })
  const parsed = demoAPassChallengeResponseSchema.safeParse(payload)

  if (!parsed.success) throw invalidResponseError()
  return parsed.data
}

export async function requestDemoAPassEnrollment(
  config: FrontendConfig,
  input: {
    walletAddress: Address
    challengeId: string
    signature: Hex
    profile: DemoAPassProfile
  },
  signal?: AbortSignal,
): Promise<DemoAPassEnrollment> {
  const payload = await requestJson(config, "/api/v1/demo/apasses", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      walletAddress: getAddress(input.walletAddress),
    }),
    signal,
  }, [409])

  return parseEnrollment(payload)
}

export async function requestDemoAPassStatus(
  config: FrontendConfig,
  input: {
    walletAddress: Address
    challengeId: string
    signature: Hex
  },
  signal?: AbortSignal,
): Promise<DemoAPassEnrollment> {
  const payload = await requestJson(config, "/api/v1/demo/apasses/status", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      walletAddress: getAddress(input.walletAddress),
    }),
    signal,
  })

  return parseEnrollment(payload)
}

export function getDemoAPassErrorMessage(error: DemoAPassApiError): string {
  if (error.code === "SERVICE_NOT_CONFIGURED" || error.code === "NOT_FOUND") {
    return "Demo A-Pass onboarding is not enabled on the API yet. Enable DEMO_MODE, configure the database, restart the API, then retry."
  }

  if (error.code === "CHALLENGE_EXPIRED") {
    return "The wallet challenge expired before it was signed. Start the request again."
  }

  if (error.code === "CHALLENGE_REPLAYED") {
    return "That wallet challenge has already been used. Start the request again to get a fresh challenge."
  }

  if (error.code === "WALLET_SIGNATURE_INVALID" || error.code === "CHALLENGE_INVALID") {
    return "The signed challenge did not match this wallet or request. Reconnect the wallet and try again."
  }

  if (error.code === "ONBOARDING_NOT_FOUND") {
    return "No demo A-Pass registration was found for this wallet. Create one first."
  }

  if (error.code === "APASS_NOT_FOUND") {
    return "Cleanverse does not have an A-Pass for this wallet. Create one before using it for a transfer."
  }

  if (error.code === "APASS_INACTIVE") {
    return "Cleanverse found this wallet's A-Pass, but it is not active."
  }

  if (error.code === "RATE_LIMITED") {
    return "Too many A-Pass requests were made. Wait briefly, then retry with a fresh challenge."
  }

  if (error.code === "DATABASE_UNAVAILABLE") {
    return "The A-Pass database is temporarily unavailable. Wait a moment, then retry with a fresh challenge."
  }

  return error.message
}

async function requestJson(
  config: FrontendConfig,
  path: string,
  init: RequestInit,
  acceptedErrorStatuses: number[] = [],
): Promise<unknown> {
  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")

  if (init.body !== undefined) headers.set("Content-Type", "application/json")
  if (typeof crypto.randomUUID === "function") headers.set("X-Request-ID", crypto.randomUUID())

  const response = await fetch(`${config.apiBaseUrl}${path}`, { ...init, headers })
  const payload = await readJson(response)

  if (!response.ok && !acceptedErrorStatuses.includes(response.status)) {
    const parsed = demoAPassErrorResponseSchema.safeParse(payload)
    throw new DemoAPassApiError({
      message: parsed.success ? parsed.data.error.message : "The A-Pass service could not complete the request.",
      code: parsed.success ? parsed.data.error.code : "APASS_REQUEST_FAILED",
      status: response.status,
      ...(parsed.success ? { requestId: parsed.data.requestId } : {}),
      ...readRetryAfter(response),
    })
  }

  return payload
}

function readRetryAfter(response: Response): { retryAfterSeconds?: number } {
  const value = response.headers.get("Retry-After")
  if (value === null || !/^\d+$/.test(value)) return {}
  const retryAfterSeconds = Number(value)
  return Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds > 0
    ? { retryAfterSeconds }
    : {}
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw invalidResponseError()
  }
}

function parseEnrollment(value: unknown): DemoAPassEnrollment {
  const parsed = demoAPassResponseSchema.safeParse(value)
  if (!parsed.success) throw invalidResponseError()

  return {
    walletAddress: getAddress(parsed.data.walletAddress),
    status: parsed.data.status,
    ...(parsed.data.registrationTransactionHash === undefined
      ? {}
      : { registrationTransactionHash: parsed.data.registrationTransactionHash as Hash }),
  }
}

function invalidResponseError(): DemoAPassApiError {
  return new DemoAPassApiError({
    message: "The A-Pass service returned an invalid response.",
    code: "INVALID_APASS_RESPONSE",
    status: 502,
  })
}
