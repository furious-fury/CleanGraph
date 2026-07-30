import { randomUUID } from "node:crypto";

import { createMiddleware } from "hono/factory";

export type AppVariables = {
  requestId: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requestContext = createMiddleware<{
  Variables: AppVariables;
}>(async (context, next) => {
  const incomingRequestId = context.req.header("X-Request-ID");
  const requestId =
    incomingRequestId && uuidPattern.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  context.set("requestId", requestId);
  await next();
  context.header("X-Request-ID", requestId);
});
