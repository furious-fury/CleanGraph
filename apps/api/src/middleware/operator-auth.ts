import { createHash, timingSafeEqual } from "node:crypto";

import type { AssetErrorResponse } from "@cleangraph/shared";
import { createMiddleware } from "hono/factory";

import type { AppVariables } from "./request-context.js";

export function createOperatorAuth(configuredToken: string | undefined) {
  const configuredDigest = configuredToken
    ? createHash("sha256").update(configuredToken).digest()
    : undefined;

  return createMiddleware<{ Variables: AppVariables }>(async (context, next) => {
    const requestId = context.get("requestId");

    if (configuredDigest === undefined) {
      return context.json(assetError(requestId, "SERVICE_NOT_CONFIGURED", "Asset operator authentication is not configured."), 503);
    }

    const authorization = context.req.header("Authorization");
    const match = authorization?.match(/^Bearer ([^\s,]+)$/i);
    const submittedDigest = match
      ? createHash("sha256").update(match[1]!).digest()
      : undefined;

    if (submittedDigest === undefined || !timingSafeEqual(configuredDigest, submittedDigest)) {
      context.header("WWW-Authenticate", "Bearer");
      return context.json(assetError(requestId, "UNAUTHORIZED", "Valid operator credentials are required."), 401);
    }

    await next();
  });
}

function assetError(
  requestId: string,
  code: "SERVICE_NOT_CONFIGURED" | "UNAUTHORIZED",
  message: string,
): AssetErrorResponse {
  return { requestId, error: { code, message } };
}
