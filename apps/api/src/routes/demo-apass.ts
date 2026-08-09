import {
  createDemoAPassRequestSchema,
  demoAPassChallengeRequestSchema,
  readDemoAPassStatusRequestSchema,
  type DemoAPassErrorCode,
} from "@cleangraph/shared";
import { Hono, type Context } from "hono";
import { z } from "zod";

import type { AppVariables } from "../middleware/request-context.js";
import {
  DemoAPassServiceError,
  type DemoAPassService,
} from "../services/demo-apass.js";

export type DemoAPassFailureLog = {
  event: "demo_apass_failure";
  operation: "challenge" | "create" | "status";
  code: string;
  requestId: string;
  status: number;
};

type DemoAPassRouteOptions = {
  enabled: boolean;
  service?: DemoAPassService;
  clientIpHeader: string;
  onFailure?: (failure: DemoAPassFailureLog) => void;
};

type AppContext = Context<{ Variables: AppVariables }>;

export function createDemoAPassRoutes(options: DemoAPassRouteOptions) {
  const routes = new Hono<{ Variables: AppVariables }>();

  routes.use("/demo/apass/*", async (context, next) => {
    context.header("Cache-Control", "no-store");
    await next();
  });

  routes.post("/demo/apass/challenges", async (context) => {
    if (!options.enabled) return context.notFound();
    const parsed = demoAPassChallengeRequestSchema.safeParse(
      await context.req.json().catch(() => undefined),
    );
    if (!parsed.success) {
      return validationResponse(context, parsed.error);
    }
    if (!options.service) {
      return unavailableResponse(context, "challenge", options.onFailure);
    }

    try {
      const challenge = await options.service.createChallenge({
        walletAddress: parsed.data.walletAddress,
        purpose: parsed.data.purpose,
        ...(parsed.data.profile === undefined
          ? {}
          : { profile: parsed.data.profile }),
        clientIp: clientIp(context, options.clientIpHeader),
      });
      return context.json(challenge, 201);
    } catch (error) {
      return failureResponse(
        context,
        "challenge",
        error,
        options.onFailure,
      );
    }
  });

  routes.post("/demo/apasses", async (context) => {
    if (!options.enabled) return context.notFound();
    const parsed = createDemoAPassRequestSchema.safeParse(
      await context.req.json().catch(() => undefined),
    );
    if (!parsed.success) {
      return validationResponse(context, parsed.error);
    }
    if (!options.service) {
      return unavailableResponse(context, "create", options.onFailure);
    }

    try {
      const response = await options.service.createAPass({
        ...parsed.data,
        clientIp: clientIp(context, options.clientIpHeader),
        requestId: context.get("requestId"),
      });
      if (response.status === "ALREADY_EXISTS") {
        return context.json(response, 409);
      }
      return context.json(
        response,
        response.status === "ACTIVE" ? 200 : 202,
      );
    } catch (error) {
      return failureResponse(context, "create", error, options.onFailure);
    }
  });

  routes.post("/demo/apasses/status", async (context) => {
    if (!options.enabled) return context.notFound();
    const parsed = readDemoAPassStatusRequestSchema.safeParse(
      await context.req.json().catch(() => undefined),
    );
    if (!parsed.success) {
      return validationResponse(context, parsed.error);
    }
    if (!options.service) {
      return unavailableResponse(context, "status", options.onFailure);
    }

    try {
      const response = await options.service.readStatus({
        ...parsed.data,
        clientIp: clientIp(context, options.clientIpHeader),
        requestId: context.get("requestId"),
      });
      return context.json(response, 200);
    } catch (error) {
      return failureResponse(context, "status", error, options.onFailure);
    }
  });

  return routes;
}

function clientIp(context: AppContext, headerName: string): string {
  const value = context.req.header(headerName)?.split(",")[0]?.trim();
  return value && value.length <= 128 ? value : "unknown";
}

function validationResponse(context: AppContext, error: z.ZodError) {
  return context.json(
    {
      requestId: context.get("requestId"),
      error: {
        code: "VALIDATION_ERROR" as const,
        message: "The demo A-Pass request is invalid.",
        fields: z.flattenError(error).fieldErrors,
      },
    },
    422,
  );
}

function failureResponse(
  context: AppContext,
  operation: DemoAPassFailureLog["operation"],
  error: unknown,
  onFailure?: (failure: DemoAPassFailureLog) => void,
) {
  if (!(error instanceof DemoAPassServiceError)) {
    return internalResponse(context, operation, onFailure);
  }
  if (error.retryAfterSeconds !== undefined) {
    context.header("Retry-After", String(error.retryAfterSeconds));
  }
  logFailure(context, operation, error.code, error.status, onFailure);
  return context.json(
    {
      requestId: context.get("requestId"),
      error: {
        code: error.code,
        message: error.message,
      },
    },
    error.status,
  );
}

function unavailableResponse(
  context: AppContext,
  operation: DemoAPassFailureLog["operation"],
  onFailure?: (failure: DemoAPassFailureLog) => void,
) {
  const code = "SERVICE_NOT_CONFIGURED" satisfies DemoAPassErrorCode;
  logFailure(context, operation, code, 503, onFailure);
  return context.json(
    {
      requestId: context.get("requestId"),
      error: {
        code,
        message: "The demo A-Pass service is not configured.",
      },
    },
    503,
  );
}

function internalResponse(
  context: AppContext,
  operation: DemoAPassFailureLog["operation"],
  onFailure?: (failure: DemoAPassFailureLog) => void,
) {
  const code = "INTERNAL_SERVER_ERROR" satisfies DemoAPassErrorCode;
  logFailure(context, operation, code, 500, onFailure);
  return context.json(
    {
      requestId: context.get("requestId"),
      error: {
        code,
        message: "An unexpected error occurred.",
      },
    },
    500,
  );
}

function logFailure(
  context: AppContext,
  operation: DemoAPassFailureLog["operation"],
  code: string,
  status: number,
  onFailure?: (failure: DemoAPassFailureLog) => void,
): void {
  onFailure?.({
    event: "demo_apass_failure",
    operation,
    code,
    requestId: context.get("requestId"),
    status,
  });
}
