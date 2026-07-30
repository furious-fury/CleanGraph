import { serve } from "@hono/node-server";

import { app } from "./app.js";
import { getEnvironment } from "./config/env.js";

const environment = getEnvironment();
const server = serve(
  {
    fetch: app.fetch,
    port: environment.PORT,
  },
  (address) => {
    console.log(
      JSON.stringify({
        level: "info",
        message: "CleanGraph API listening",
        address: address.address,
        port: address.port,
      }),
    );
  },
);

server.on("error", (error) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "CleanGraph API failed to start",
      error: error.message,
    }),
  );
  process.exitCode = 1;
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(
    JSON.stringify({
      level: "info",
      message: "CleanGraph API shutting down",
      signal,
    }),
  );

  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
