CREATE TABLE IF NOT EXISTS demo_apass_challenges (
  id uuid PRIMARY KEY,
  wallet_address text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('CREATE', 'STATUS')),
  profile text CHECK (profile IN ('ELIGIBLE_GB', 'RESTRICTED_BR')),
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (purpose = 'CREATE' AND profile IS NOT NULL) OR
    (purpose = 'STATUS' AND profile IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS demo_apass_challenges_expiry_idx
  ON demo_apass_challenges (expires_at);

CREATE TABLE IF NOT EXISTS demo_apass_onboardings (
  id uuid PRIMARY KEY,
  wallet_address text NOT NULL,
  profile text NOT NULL CHECK (profile IN ('ELIGIBLE_GB', 'RESTRICTED_BR')),
  state text NOT NULL CHECK (state IN (
    'CREATING',
    'PENDING',
    'ACTIVE',
    'RETRY_REQUIRED'
  )),
  registration_transaction_hash text,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  last_error_kind text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS demo_apass_onboardings_wallet_idx
  ON demo_apass_onboardings (lower(wallet_address));

CREATE INDEX IF NOT EXISTS demo_apass_onboardings_retention_idx
  ON demo_apass_onboardings (updated_at);

CREATE TABLE IF NOT EXISTS demo_apass_rate_limits (
  scope text NOT NULL,
  subject_hash text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (scope, subject_hash)
);

CREATE INDEX IF NOT EXISTS demo_apass_rate_limits_expiry_idx
  ON demo_apass_rate_limits (expires_at);

