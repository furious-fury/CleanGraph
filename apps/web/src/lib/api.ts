import {
  preflightDecisionSchema,
  preflightErrorResponseSchema,
  transactionIntentSchema,
  type PreflightDecision,
  type PreflightErrorResponse,
  type TransactionIntent,
} from "@cleangraph/shared"

import type { FrontendConfig } from "@/lib/config"

export type ReadinessState = {
  ready: boolean
  requestId: string
}

export type PreflightResult = PreflightDecision | PreflightErrorResponse

export class ApiResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ApiResponseError"
  }
}

export async function requestReadiness(
  config: FrontendConfig,
  signal?: AbortSignal,
): Promise<ReadinessState> {
  const response = await fetch(`${config.apiBaseUrl}/ready`, {
    headers: { Accept: "application/json" },
    signal,
  })
  const payload = await readJson(response)

  if (!isReadinessPayload(payload)) {
    throw new ApiResponseError("The readiness service returned an invalid response.")
  }

  return {
    ready: response.ok && payload.status === "ready" && payload.checks.preflightService === true,
    requestId: payload.requestId,
  }
}

export async function requestPreflight(
  config: FrontendConfig,
  input: TransactionIntent,
): Promise<PreflightResult> {
  const intent = transactionIntentSchema.parse(input)
  const headers = new Headers({ "Content-Type": "application/json" })

  if (typeof crypto.randomUUID === "function") {
    headers.set("X-Request-ID", crypto.randomUUID())
  }

  const response = await fetch(`${config.apiBaseUrl}/api/v1/compliance/preflight`, {
    method: "POST",
    headers,
    body: JSON.stringify(intent),
  })
  const payload = await readJson(response)
  const decision = preflightDecisionSchema.safeParse(payload)

  if (decision.success) {
    if (!response.ok) {
      throw new ApiResponseError("The compliance service returned a decision with an invalid status.")
    }

    return decision.data
  }

  const error = preflightErrorResponseSchema.safeParse(payload)

  if (error.success) {
    return error.data
  }

  throw new ApiResponseError("The compliance service returned an invalid response.")
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new ApiResponseError("The service response was not valid JSON.")
  }
}

function isReadinessPayload(value: unknown): value is {
  status: "ready" | "degraded"
  checks: { preflightService: boolean }
  requestId: string
} {
  if (typeof value !== "object" || value === null) return false

  const record = value as Record<string, unknown>
  const checks = record.checks

  return (
    (record.status === "ready" || record.status === "degraded") &&
    typeof record.requestId === "string" &&
    typeof checks === "object" &&
    checks !== null &&
    typeof (checks as Record<string, unknown>).preflightService === "boolean"
  )
}
