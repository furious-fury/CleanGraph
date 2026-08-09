import { Pool, type PoolClient } from "pg";

import type {
  DemoAPassChallengePurpose,
  DemoAPassProfile,
} from "@cleangraph/shared";

export type DemoAPassWorkflowState =
  | "CREATING"
  | "PENDING"
  | "ACTIVE"
  | "RETRY_REQUIRED";

export type DemoAPassChallengeRecord = {
  id: string;
  walletAddress: string;
  purpose: DemoAPassChallengePurpose;
  profile?: DemoAPassProfile;
  message: string;
  expiresAt: Date;
  consumedAt?: Date;
};

export type DemoAPassOnboardingRecord = {
  id: string;
  walletAddress: string;
  profile: DemoAPassProfile;
  state: DemoAPassWorkflowState;
  registrationTransactionHash?: string;
  attemptCount: number;
  lastErrorKind?: string;
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date;
};

export type ChallengeConsumption =
  | { kind: "consumed"; challenge: DemoAPassChallengeRecord }
  | { kind: "not_found" | "expired" | "replayed" };

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export interface DemoAPassStore {
  createChallenge(challenge: DemoAPassChallengeRecord): Promise<void>;
  getChallenge(id: string): Promise<DemoAPassChallengeRecord | undefined>;
  consumeChallenge(id: string, now: Date): Promise<ChallengeConsumption>;
  consumeRateLimit(input: {
    scope: string;
    subjectHash: string;
    limit: number;
    windowMs: number;
    now: Date;
  }): Promise<RateLimitResult>;
  createOrGetOnboarding(input: {
    id: string;
    walletAddress: string;
    profile: DemoAPassProfile;
    now: Date;
  }): Promise<{ onboarding: DemoAPassOnboardingRecord; created: boolean }>;
  getOnboardingForWallet(
    walletAddress: string,
  ): Promise<DemoAPassOnboardingRecord | undefined>;
  claimRetry(
    id: string,
    now: Date,
  ): Promise<DemoAPassOnboardingRecord | undefined>;
  markPending(input: {
    id: string;
    registrationTransactionHash: string;
    now: Date;
  }): Promise<DemoAPassOnboardingRecord>;
  markActive(id: string, now: Date): Promise<DemoAPassOnboardingRecord>;
  markRetryRequired(
    id: string,
    errorKind: string,
    now: Date,
  ): Promise<DemoAPassOnboardingRecord>;
  purge(before: Date, now: Date): Promise<{
    onboardings: number;
    challenges: number;
    rateLimits: number;
  }>;
  close(): Promise<void>;
}

export class PostgresDemoAPassStore implements DemoAPassStore {
  readonly #pool: Pool;

  constructor(connectionString: string) {
    this.#pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
    });
  }

  async createChallenge(challenge: DemoAPassChallengeRecord): Promise<void> {
    await this.#pool.query(
      `INSERT INTO demo_apass_challenges
       (id, wallet_address, purpose, profile, message, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        challenge.id,
        challenge.walletAddress,
        challenge.purpose,
        challenge.profile ?? null,
        challenge.message,
        challenge.expiresAt,
      ],
    );
  }

  async getChallenge(
    id: string,
  ): Promise<DemoAPassChallengeRecord | undefined> {
    const result = await this.#pool.query(
      `SELECT id, wallet_address, purpose, profile, message,
              expires_at, consumed_at
       FROM demo_apass_challenges WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? mapChallenge(result.rows[0]) : undefined;
  }

  async consumeChallenge(
    id: string,
    now: Date,
  ): Promise<ChallengeConsumption> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query(
        `SELECT id, wallet_address, purpose, profile, message,
                expires_at, consumed_at
         FROM demo_apass_challenges WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const row = selected.rows[0];
      if (!row) return finishChallenge(client, { kind: "not_found" });
      const challenge = mapChallenge(row);
      if (challenge.consumedAt) {
        return finishChallenge(client, { kind: "replayed" });
      }
      if (challenge.expiresAt.getTime() <= now.getTime()) {
        return finishChallenge(client, { kind: "expired" });
      }
      await client.query(
        "UPDATE demo_apass_challenges SET consumed_at = $2 WHERE id = $1",
        [id, now],
      );
      await client.query("COMMIT");
      return { kind: "consumed", challenge: { ...challenge, consumedAt: now } };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async consumeRateLimit(input: {
    scope: string;
    subjectHash: string;
    limit: number;
    windowMs: number;
    now: Date;
  }): Promise<RateLimitResult> {
    const nextExpiry = new Date(input.now.getTime() + input.windowMs);
    const result = await this.#pool.query(
      `INSERT INTO demo_apass_rate_limits
       (scope, subject_hash, window_started_at, request_count, expires_at)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (scope, subject_hash) DO UPDATE SET
         window_started_at = CASE WHEN demo_apass_rate_limits.expires_at <= $3
           THEN $3 ELSE demo_apass_rate_limits.window_started_at END,
         request_count = CASE WHEN demo_apass_rate_limits.expires_at <= $3
           THEN 1 ELSE demo_apass_rate_limits.request_count + 1 END,
         expires_at = CASE WHEN demo_apass_rate_limits.expires_at <= $3
           THEN $4 ELSE demo_apass_rate_limits.expires_at END
       RETURNING request_count, expires_at`,
      [input.scope, input.subjectHash, input.now, nextExpiry],
    );
    const row = result.rows[0]!;
    if (Number(row.request_count) <= input.limit) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          (new Date(String(row.expires_at)).getTime() - input.now.getTime()) /
            1_000,
        ),
      ),
    };
  }

  async createOrGetOnboarding(input: {
    id: string;
    walletAddress: string;
    profile: DemoAPassProfile;
    now: Date;
  }): Promise<{ onboarding: DemoAPassOnboardingRecord; created: boolean }> {
    const inserted = await this.#pool.query(
      `INSERT INTO demo_apass_onboardings
       (id, wallet_address, profile, state, created_at, updated_at)
       VALUES ($1, $2, $3, 'CREATING', $4, $4)
       ON CONFLICT DO NOTHING RETURNING *`,
      [input.id, input.walletAddress, input.profile, input.now],
    );
    if (inserted.rows[0]) {
      return { onboarding: mapOnboarding(inserted.rows[0]), created: true };
    }
    const existing = await this.getOnboardingForWallet(input.walletAddress);
    if (!existing) {
      throw new Error("Onboarding conflict without an existing row");
    }
    return { onboarding: existing, created: false };
  }

  async getOnboardingForWallet(
    walletAddress: string,
  ): Promise<DemoAPassOnboardingRecord | undefined> {
    const result = await this.#pool.query(
      `SELECT * FROM demo_apass_onboardings
       WHERE lower(wallet_address) = lower($1) LIMIT 1`,
      [walletAddress],
    );
    return result.rows[0] ? mapOnboarding(result.rows[0]) : undefined;
  }

  async claimRetry(
    id: string,
    now: Date,
  ): Promise<DemoAPassOnboardingRecord | undefined> {
    const result = await this.#pool.query(
      `UPDATE demo_apass_onboardings
       SET state = 'CREATING', attempt_count = attempt_count + 1,
           last_error_kind = NULL, updated_at = $2
       WHERE id = $1 AND (
         state = 'RETRY_REQUIRED' OR
         (state = 'CREATING' AND updated_at < $2 - interval '5 minutes')
       )
       RETURNING *`,
      [id, now],
    );
    return result.rows[0] ? mapOnboarding(result.rows[0]) : undefined;
  }

  async markPending(input: {
    id: string;
    registrationTransactionHash: string;
    now: Date;
  }): Promise<DemoAPassOnboardingRecord> {
    return this.#update(
      `UPDATE demo_apass_onboardings
       SET state = 'PENDING', registration_transaction_hash = $2,
           last_error_kind = NULL, updated_at = $3
       WHERE id = $1 RETURNING *`,
      [input.id, input.registrationTransactionHash, input.now],
    );
  }

  async markActive(
    id: string,
    now: Date,
  ): Promise<DemoAPassOnboardingRecord> {
    return this.#update(
      `UPDATE demo_apass_onboardings
       SET state = 'ACTIVE', last_error_kind = NULL,
           updated_at = $2, activated_at = COALESCE(activated_at, $2)
       WHERE id = $1 RETURNING *`,
      [id, now],
    );
  }

  async markRetryRequired(
    id: string,
    errorKind: string,
    now: Date,
  ): Promise<DemoAPassOnboardingRecord> {
    return this.#update(
      `UPDATE demo_apass_onboardings
       SET state = 'RETRY_REQUIRED', last_error_kind = $2, updated_at = $3
       WHERE id = $1 AND state = 'CREATING' RETURNING *`,
      [id, errorKind, now],
    );
  }

  async purge(before: Date, now: Date) {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const onboardings = await client.query(
        "DELETE FROM demo_apass_onboardings WHERE updated_at < $1",
        [before],
      );
      const challenges = await client.query(
        `DELETE FROM demo_apass_challenges
         WHERE created_at < $1 OR expires_at < $1 OR
               (consumed_at IS NOT NULL AND consumed_at < $1)`,
        [before],
      );
      const rateLimits = await client.query(
        "DELETE FROM demo_apass_rate_limits WHERE expires_at < $1",
        [now],
      );
      await client.query("COMMIT");
      return {
        onboardings: onboardings.rowCount ?? 0,
        challenges: challenges.rowCount ?? 0,
        rateLimits: rateLimits.rowCount ?? 0,
      };
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }

  async #update(
    sql: string,
    values: unknown[],
  ): Promise<DemoAPassOnboardingRecord> {
    const result = await this.#pool.query(sql, values);
    if (!result.rows[0]) {
      throw new Error("Demo A-Pass onboarding state transition failed");
    }
    return mapOnboarding(result.rows[0]);
  }
}

function mapChallenge(row: Record<string, unknown>): DemoAPassChallengeRecord {
  return {
    id: String(row.id),
    walletAddress: String(row.wallet_address),
    purpose: String(row.purpose) as DemoAPassChallengePurpose,
    ...(row.profile ? { profile: String(row.profile) as DemoAPassProfile } : {}),
    message: String(row.message),
    expiresAt: new Date(String(row.expires_at)),
    ...(row.consumed_at
      ? { consumedAt: new Date(String(row.consumed_at)) }
      : {}),
  };
}

function mapOnboarding(row: Record<string, unknown>): DemoAPassOnboardingRecord {
  return {
    id: String(row.id),
    walletAddress: String(row.wallet_address),
    profile: String(row.profile) as DemoAPassProfile,
    state: String(row.state) as DemoAPassWorkflowState,
    ...(row.registration_transaction_hash
      ? { registrationTransactionHash: String(row.registration_transaction_hash) }
      : {}),
    attemptCount: Number(row.attempt_count),
    ...(row.last_error_kind
      ? { lastErrorKind: String(row.last_error_kind) }
      : {}),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
    ...(row.activated_at
      ? { activatedAt: new Date(String(row.activated_at)) }
      : {}),
  };
}

async function finishChallenge(
  client: PoolClient,
  result: ChallengeConsumption,
): Promise<ChallengeConsumption> {
  await client.query("ROLLBACK");
  return result;
}

async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original database error.
  }
}
