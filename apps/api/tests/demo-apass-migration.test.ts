import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("../migrations/001_demo_apass.sql", import.meta.url),
);
const migration = readFileSync(migrationPath, "utf8");
const runner = readFileSync(
  fileURLToPath(new URL("../src/commands/migrate.ts", import.meta.url)),
  "utf8",
);
const store = readFileSync(
  fileURLToPath(new URL("../src/db/demo-apass-store.ts", import.meta.url)),
  "utf8",
);

describe("demo A-Pass PostgreSQL migration", () => {
  it("discovers, locks, checksums, and transactionally tracks migrations", () => {
    expect(runner).toContain(
      'entry.isFile() && entry.name.endsWith(".sql")',
    );
    expect(runner).toContain(".sort((left, right) => left.localeCompare(right))");
    expect(runner).toContain("pg_advisory_lock");
    expect(runner).toContain(
      'createHash("sha256").update(sql).digest("hex")',
    );
    expect(runner).toContain(
      "INSERT INTO cleangraph_schema_migrations",
    );
    expect(runner).toContain(
      'await client.query("BEGIN")',
    );
    expect(runner).toContain(
      'await client.query("ROLLBACK")',
    );
  });

  it("stores only safe onboarding and audit metadata", () => {
    expect(migration).toContain("wallet_address");
    expect(migration).toContain("profile");
    expect(migration).toContain("registration_transaction_hash");
    expect(migration).toContain("attempt_count");
    expect(migration).not.toMatch(
      /full_name|document|id_number|customer_id|signature|credential|cleanverse_response/i,
    );
  });

  it("enforces one onboarding record per normalized wallet", () => {
    expect(migration).toContain(
      "ON demo_apass_onboardings (lower(wallet_address))",
    );
  });

  it("constrains public workflow states and challenge purposes", () => {
    expect(migration).toContain(
      "state IN (\n    'CREATING',\n    'PENDING',\n    'ACTIVE',\n    'RETRY_REQUIRED'",
    );
    expect(migration).toContain("purpose IN ('CREATE', 'STATUS')");
  });

  it("casts retry timestamps before subtracting the stale-attempt interval", () => {
    expect(store).toContain(
      "$2::timestamptz - interval '5 minutes'",
    );
  });
});
