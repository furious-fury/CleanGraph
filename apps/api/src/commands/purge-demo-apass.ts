import { PostgresDemoAPassStore } from "../db/demo-apass-store.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set.");
}

const store = new PostgresDemoAPassStore(connectionString);
const now = new Date();
const before = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);

try {
  const deleted = await store.purge(before, now);
  console.log(
    JSON.stringify({
      event: "demo_apass_retention_purge",
      retentionDays: 30,
      deleted,
    }),
  );
} finally {
  await store.close();
}
