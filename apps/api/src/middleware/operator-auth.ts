import { createHash, timingSafeEqual } from "node:crypto";

import { createMiddleware } from "hono/factory";

import type { AppVariables } from "./request-context.js";

type OperatorAuthOptions = {
  notConfiguredMessage?: string;
};

type OperatorAuthErrorResponse = {
  requestId: string;
  error: {
    code: "SERVICE_NOT_CONFIGURED" | "UNAUTHORIZED";
    message: string;
  };
};

export function createOperatorAuth(
  configuredToken: string | undefined,
  options: OperatorAuthOptions = {},
) {
  const configuredDigest = configuredToken
    ? createHash("sha256").update(configuredToken).digest()
    : undefined;

  return createMiddleware<{ Variables: AppVariables }>(async (context, next) => {
    const requestId = context.get("requestId");

    if (configuredDigest === undefined) {
      return context.json(
        operatorAuthError(
          requestId,
          "SERVICE_NOT_CONFIGURED",
          options.notConfiguredMessage ??
            "Operator authentication is not configured.",
        ),
        503,
      );
    }

    const authorization = context.req.header("Authorization");
    const match = authorization?.match(/^Bearer ([^\s,]+)$/i);
    const submittedDigest = match
      ? createHash("sha256").update(match[1]!).digest()
      : undefined;

    if (submittedDigest === undefined || !timingSafeEqual(configuredDigest, submittedDigest)) {
      context.header("WWW-Authenticate", "Bearer");
      return context.json(
        operatorAuthError(
          requestId,
          "UNAUTHORIZED",
          "Valid operator credentials are required.",
        ),
        401,
      );
    }

    await next();
  });
}

function operatorAuthError(
  requestId: string,
  code: "SERVICE_NOT_CONFIGURED" | "UNAUTHORIZED",
  message: string,
): OperatorAuthErrorResponse {
  return { requestId, error: { code, message } };
}
