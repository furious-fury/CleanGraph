import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set.");
}

const migrationsDirectory = fileURLToPath(
  new URL("../../migrations/", import.meta.url),
);
const pool = new Pool({ connectionString, allowExitOnIdle: true });
const client = await pool.connect();
const lockName = "cleangraph_schema_migrations";
let locked = false;

try {
  await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);
  locked = true;
  await client.query(`CREATE TABLE IF NOT EXISTS cleangraph_schema_migrations (
    name text PRIMARY KEY,
    checksum char(64) NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const migrationNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  let applied = 0;
  let skipped = 0;
  for (const name of migrationNames) {
    const sql = await readFile(join(migrationsDirectory, name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query<{ checksum: string }>(
      "SELECT checksum FROM cleangraph_schema_migrations WHERE name = $1",
      [name],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration checksum changed: ${name}`);
      }
      skipped += 1;
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO cleangraph_schema_migrations (name, checksum)
         VALUES ($1, $2)`,
        [name, checksum],
      );
      await client.query("COMMIT");
      applied += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log(
    JSON.stringify({
      event: "database_migrations_complete",
      applied,
      skipped,
      total: migrationNames.length,
    }),
  );
} finally {
  if (locked) {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]);
  }
  client.release();
  await pool.end();
}
