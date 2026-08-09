import { getAddress, isHash, type Address, type Hash, type Hex } from "viem"

import type { FrontendConfig } from "@/lib/config"

export type DemoAPassProfile = "ELIGIBLE_GB" | "RESTRICTED_BR"
export type DemoAPassState = "PENDING" | "ACTIVE"

export type DemoAPassChallenge = {
  requestId: string
  challengeId: string
  message: string
  expiresAt: string
}

export type DemoAPassEnrollment = {
  requestId: string
  enrollmentId: string
  state: DemoAPassState
  walletAddress: Address
  transactionHash: Hash
  expiresAt?: string
}

export class DemoAPassApiError extends Error {
  readonly code: string
  readonly requestId?: string
  readonly status: number

  constructor(input: { message: string; code: string; status: number; requestId?: string }) {
    super(input.message)
    this.name = "DemoAPassApiError"
    this.code = input.code
    this.status = input.status
    this.requestId = input.requestId
  }
}

export class DemoAPassActivationTimeoutError extends Error {
  constructor() {
    super("A-Pass registration is still pending on Monad. Retry the status check in a moment.")
    this.name = "DemoAPassActivationTimeoutError"
  }
}

export async function requestDemoAPassChallenge(
  config: FrontendConfig,
  walletAddress: Address,
  signal?: AbortSignal,
): Promise<DemoAPassChallenge> {
  const payload = await requestJson(config, "/api/v1/apass/demo/challenge", {
    method: "POST",
    body: JSON.stringify({ walletAddress: getAddress(walletAddress) }),
    signal,
  })

  if (!isChallenge(payload)) {
    throw invalidResponseError()
  }

  return payload
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
  const payload = await requestJson(config, "/api/v1/apass/demo", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      walletAddress: getAddress(input.walletAddress),
    }),
    signal,
  })

  return parseEnrollment(payload)
}

export async function requestDemoAPassStatus(
  config: FrontendConfig,
  enrollmentId: string,
  signal?: AbortSignal,
): Promise<DemoAPassEnrollment> {
  const payload = await requestJson(
    config,
    `/api/v1/apass/demo/${encodeURIComponent(enrollmentId)}`,
    { signal },
  )

  return parseEnrollment(payload)
}

export async function waitForDemoAPassActivation(
  config: FrontendConfig,
  enrollment: DemoAPassEnrollment,
  options: {
    signal?: AbortSignal
    attempts?: number
    intervalMs?: number
    onUpdate?: (enrollment: DemoAPassEnrollment) => void
  } = {},
): Promise<DemoAPassEnrollment> {
  if (enrollment.state === "ACTIVE") return enrollment

  const attempts = options.attempts ?? 20
  const intervalMs = options.intervalMs ?? 1_500
  let latest = enrollment

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await delay(intervalMs, options.signal)
    latest = await requestDemoAPassStatus(config, enrollment.enrollmentId, options.signal)
    options.onUpdate?.(latest)

    if (latest.state === "ACTIVE") return latest
  }

  throw new DemoAPassActivationTimeoutError()
}

export function getDemoAPassErrorMessage(error: DemoAPassApiError | DemoAPassActivationTimeoutError): string {
  if (error instanceof DemoAPassActivationTimeoutError) return error.message

  if (error.code === "NOT_FOUND" || error.code === "DEMO_MODE_DISABLED" || error.status === 404) {
    return "Demo A-Pass onboarding is not enabled on the API yet. Enable demo mode, restart the API, then retry."
  }

  if (error.code === "CHALLENGE_EXPIRED") {
    return "The wallet challenge expired before it was signed. Start A-Pass creation again."
  }

  if (error.code === "INVALID_SIGNATURE") {
    return "The signed challenge did not match this wallet. Reconnect the wallet and try again."
  }

  return error.message
}

async function requestJson(
  config: FrontendConfig,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")

  if (init.body !== undefined) headers.set("Content-Type", "application/json")
  if (typeof crypto.randomUUID === "function") headers.set("X-Request-ID", crypto.randomUUID())

  const response = await fetch(`${config.apiBaseUrl}${path}`, { ...init, headers })
  const payload = await readJson(response)

  if (!response.ok) {
    const apiError = parseError(payload)
    throw new DemoAPassApiError({
      message: apiError?.message ?? "The A-Pass service could not complete the request.",
      code: apiError?.code ?? "APASS_REQUEST_FAILED",
      status: response.status,
      ...(apiError?.requestId === undefined ? {} : { requestId: apiError.requestId }),
    })
  }

  return payload
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw invalidResponseError()
  }
}

function parseEnrollment(value: unknown): DemoAPassEnrollment {
  if (!isRecord(value)) throw invalidResponseError()

  const { requestId, enrollmentId, state, walletAddress, transactionHash, expiresAt } = value

  if (
    typeof requestId !== "string" ||
    typeof enrollmentId !== "string" ||
    (state !== "PENDING" && state !== "ACTIVE") ||
    typeof walletAddress !== "string" ||
    typeof transactionHash !== "string" ||
    !isHash(transactionHash) ||
    (expiresAt !== undefined && typeof expiresAt !== "string")
  ) {
    throw invalidResponseError()
  }

  let normalizedAddress: Address
  try {
    normalizedAddress = getAddress(walletAddress)
  } catch {
    throw invalidResponseError()
  }

  return {
    requestId,
    enrollmentId,
    state,
    walletAddress: normalizedAddress,
    transactionHash,
    ...(expiresAt === undefined ? {} : { expiresAt }),
  }
}

function isChallenge(value: unknown): value is DemoAPassChallenge {
  if (!isRecord(value)) return false

  return (
    typeof value.requestId === "string" &&
    typeof value.challengeId === "string" &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    typeof value.expiresAt === "string"
  )
}

function parseError(value: unknown): { code: string; message: string; requestId?: string } | undefined {
  if (!isRecord(value) || !isRecord(value.error)) return undefined
  if (typeof value.error.code !== "string" || typeof value.error.message !== "string") return undefined

  return {
    code: value.error.code,
    message: value.error.message,
    ...(typeof value.requestId === "string" ? { requestId: value.requestId } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function invalidResponseError(): DemoAPassApiError {
  return new DemoAPassApiError({
    message: "The A-Pass service returned an invalid response.",
    code: "INVALID_APASS_RESPONSE",
    status: 502,
  })
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("The request was aborted.", "AbortError"))
      return
    }

    const onAbort = () => {
      globalThis.clearTimeout(timeout)
      reject(signal?.reason ?? new DOMException("The request was aborted.", "AbortError"))
    }
    const timeout = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, milliseconds)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}
