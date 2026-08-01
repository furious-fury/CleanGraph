# CleanGraph Implementation Plan

**Status:** Active v0.3
**Depends on:** external Cleanverse and Monad prerequisites in `tasklist.md`
**Technical source:** Cleanverse Cooperate API v5.6
**Last updated:** July 31, 2026

## 1. Implementation Objective

Build a Vite and React frontend plus a Node.js and TypeScript backend that:

1. exposes the Cleanverse A-Pass and A-Token lifecycle safely;
2. preflights both parties to an RWA transfer;
3. requests a wallet signature only after approval;
4. settles the A-Token transfer on Monad; and
5. displays indexed transaction evidence and a downloadable report.

Deployment is intentionally scheduled as the final phase. The intended targets
are Vercel for the frontend and the team's VPS for the backend.

### 1.1 Confirmed MVP configuration

- Underlying asset: demo beneficial interest in a fictional portfolio of
  short-term United States Treasury bills
- Token: `Tokenized Real-World Asset` (`TRWA`)
- Decimals and supply: 18 decimals and `1,000,000 TRWA`
- Primary customer: regulated traditional-finance institutions
- Primary operator: RWA issuer, treasury, or compliance operations staff
- Investor mapping: A-Pass group `Institutional Investor` and subgroup
  `Accredited Investor`, with exact sandbox identifiers still to be confirmed
- Country allowlist: `US`, `GB`, `DE`, and `SG`
- Wallet A: required investor mapping and country `GB`
- Wallet B: same investor mapping and country `BR`, causing only the country
  rule to fail
- CleanGraph amount cap: excluded from the MVP

### 1.2 Implementation snapshot

Completed and merged:

- workspace, Vite/React shell, Hono API, shared Zod contracts, and root quality
  commands;
- Cleanverse secure transport, A-Pass provisioning, compliance reads, A-Token
  launch, application-status normalization, and bounded polling;
- health/readiness routes and the complete preflight orchestration endpoint;
- ordered approval, denial, and infrastructure-error responses with request
  correlation; and
- unit and contract tests for the implemented backend packages.

Not yet implemented:

- protected asset-launch/application routes and the evidence route;
- the contracts package, Monad configuration, A-Token ABI helpers, balance
  reads, minting support, and transfer execution;
- wallet connection and all live frontend/API integration;
- sandbox A-Pass and A-Token provisioning;
- final end-to-end tests, deployment, and submission artifacts.

## 2. Proposed Repository Architecture

```text
apps/
  web/                    Vite + React operator and transfer UI
  api/                    Node.js + TypeScript orchestration service
packages/
  cleanverse-client/      Typed API client, AES encryption, response mapping
  contracts/              A-Token ABI, Monad configuration, contract helpers
  shared/                 Shared schemas, decision codes, event types
tests/
  fixtures/               Sanitized Cleanverse success and denial responses
  e2e/                    Eligible and ineligible transfer journeys
docs/
  decisions/              Architecture decision records
scripts/                  Setup, sandbox checks, and deployment helpers
```

The repository uses pnpm workspaces. `packages/contracts`, `tests`, `scripts`,
and `docs/decisions` currently contain placeholders and must not be described
as implemented packages or test suites until their tasks are completed.

## 3. System Components

### 3.1 Web application

Responsibilities:

- connect a Monad-compatible wallet;
- collect the token, recipient, and amount;
- initiate preflight through the API;
- render compliance events;
- request the A-Token transfer signature after approval;
- wait for Monad confirmation; and
- request indexed transaction and report status.

Selected libraries:

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Phosphor Icons

Still to select and install:

- Privy or a verified Monad-compatible alternative for wallet onboarding
- viem for EVM contract reads, writes, and receipt polling
- TanStack Query if the frontend needs server and chain request caching
- `@cleangraph/shared` for runtime response validation

Privy must be validated against Monad before it becomes final.

### 3.2 Orchestration API

Responsibilities:

- validate all client payloads;
- keep Cleanverse credentials server-side;
- encrypt protected Cleanverse request bodies;
- normalize Cleanverse envelopes and business codes;
- orchestrate sender and recipient verification;
- return sanitized ordered checks; and
- query post-settlement evidence.

The selected framework is Hono on the Node.js adapter. Public frontend/API
contracts are the Zod schemas in `@cleangraph/shared`; Hono RPC is not the
frontend contract for this project.

### 3.3 Cleanverse client package

The client must use:

- base URL `https://uatapi.cleanverse.com/api/cooperate`;
- `api-id` request header;
- optional UUID `X-Request-ID`;
- Base64-decoded API key used locally for protected requests;
- AES/CBC encryption with a 16-byte zero IV and PKCS5-compatible padding; and
- `{ "data": "<Base64 ciphertext>" }` for encrypted endpoints.

The client must never infer success from HTTP status alone. It must parse the
top-level Cleanverse `code` and endpoint-specific result fields.

Implemented typed methods:

- `generateAPass`
- `queryAPass`
- `launchAToken`
- `queryATokenApplication`
- `pollATokenApplication`
- `queryATokenRules`
- `verifyAPassForToken`

Remaining MVP typed methods:

- `queryTransactions`
- `downloadTravelRuleReport`

Deferred methods:

- Wrapped A-Token operations
- Validator pool administration
- Fiat ramp
- Institutional deposit whitelists
- A-Token pause and rule mutation after issuance

### 3.4 Monad integration

The browser signs user transfers; the API must not hold the user's private key.

Required inputs:

- Monad chain ID and RPC URL
- block explorer URL
- issued A-Token address
- A-Token ABI
- token decimals
- contract role and minting instructions

The attached v5.6 API guide explains that the A-Token admin must grant
`MINTER_ROLE` after issuance, but it does not include the contract ABI or
on-chain method signatures. Those materials must be obtained from Cleanverse
before contract implementation is finalized.

## 4. Cleanverse Endpoint Mapping

### 4.1 A-Pass setup

`POST /generate_apass`

- Encrypted request
- Supports `chain: "monad"`
- Requires a customer ID of at least 12 alphanumeric characters
- Derives country tags from `identityDataList[].issuingCountryISO2`
- Returns record and transaction identifiers

`POST /query_apass`

- Plain JSON request
- Returns status, expiration, tier, group, KYC hash, and countries

### 4.2 A-Token issuance

`POST /atoken/launch`

- Encrypted request
- Includes token metadata, admin address, icon, and initial rule
- Returns `requestId`; it does not mean the asset is issued

`GET /atoken/query_apply_status/{requestId}`

- Poll until a terminal state
- Only `ISSUED` is success
- Returns A-Token address and transaction hash after issuance

`POST /atoken/rules`

- Plain JSON request
- Returns all configured tier, group, and country rules

### 4.3 Transfer eligibility

`POST /verify_apass`

- Plain JSON request
- Input: chain, A-Token address, and user address
- Result codes:
  - `1`: A-Token not found
  - `2`: user has no A-Pass
  - `3`: A-Pass exists but cannot transfer
  - `4`: eligible and allowed to transfer

Call the endpoint once for the sender and once for the recipient.

### 4.4 Audit evidence

`POST /query_txs`

- Plain JSON request
- Query by wallet, token, hash, type, and time range

`POST /download_travel_rule`

- Plain JSON request
- Supports Monad
- Returns a time-limited download URL and filename
- Supports transaction reports for A-Token transfers and Travel Rule reports
  for eligible withdrawals

## 5. CleanGraph API Design

### `GET /health`

Returns API health without exposing configuration values.

### `POST /api/v1/compliance/preflight`

Request:

```json
{
  "chain": "monad",
  "sender": "0x...",
  "recipient": "0x...",
  "atokenAddress": "0x...",
  "amount": "100"
}
```

Response:

```json
{
  "requestId": "uuid",
  "approved": true,
  "checks": [
    {
      "id": "sender-apass",
      "status": "approved",
      "source": "cleanverse",
      "code": "4",
      "message": "Sender may transfer this A-Token"
    }
  ]
}
```

The response must distinguish:

- approved policy decisions;
- denied policy decisions;
- invalid client requests;
- Cleanverse business failures; and
- infrastructure failures.

### `POST /api/v1/assets/launch`

Submits the encrypted A-Token launch request. This route must be restricted to
the demo operator and must never expose the API key. The implemented route uses
a backend-only bearer token, returns `202` with the standard `IA...`
application identifier, and applies a process-global limit of 5 authenticated
requests per 60 seconds.

### `GET /api/v1/assets/applications/:requestId`

Returns one normalized issuance application snapshot for standard `LAUNCH`
applications. The caller controls subsequent reads. Rejected and failed
applications return HTTP `200` with normalized failure evidence. The route uses
the same backend-only bearer token and allows 120 authenticated reads per 60
seconds.

### `POST /api/v1/transactions/evidence`

Accepts a confirmed transaction hash and returns indexed transaction details
plus report availability.

### Progress transport

The MVP uses one ordered preflight response. Each completed check contains a
timestamp, status, safe code, and message. Server-Sent Events are deferred
unless the existing response proves inadequate during demo testing.

## 6. Decision Model

The decision pipeline is:

1. Validate chain, addresses, token address, and amount.
2. Verify the sender with `verify_apass`.
3. Verify the recipient with `verify_apass`.
4. Load A-Token rules for display and evidence.
5. Return `approved: true` only when every required check passes.

Example normalized denial codes:

- `ATOKEN_NOT_FOUND`
- `SENDER_APASS_MISSING`
- `RECIPIENT_APASS_MISSING`
- `SENDER_NOT_ELIGIBLE`
- `RECIPIENT_NOT_ELIGIBLE`
- `CLEANVERSE_UNAVAILABLE`

CleanGraph should not claim the specific underlying reason for result code `3`
unless a separate documented response provides it.

## 7. Data and State

The MVP can avoid a database if:

- issued asset configuration is stored in environment/config files;
- issuance is performed before the main demo; and
- daily or cumulative amount limits are excluded.

Persistent storage becomes necessary for:

- daily transaction limits;
- operator accounts;
- durable compliance event history;
- webhook idempotency; or
- managing multiple issued assets.

Recommendation: begin without a database and add SQLite or PostgreSQL only if
an approved requirement needs persistence.

## 8. Security Design

- Keep Cleanverse credentials in backend environment variables.
- Never prefix secrets with `VITE_`.
- Redact credentials, ciphertext, identity numbers, bank accounts, and private
  keys from logs.
- Validate EVM addresses and decimal amounts.
- Apply CORS only to approved frontend origins.
- Apply rate limits to orchestration and issuance routes.
- Add request timeouts and bounded retries only where safe.
- Use constant-time comparison if the optional A-Token result webhook is
  implemented.
- Verify webhook HMAC over the exact raw body using the Base64-decoded API key.
- Reject duplicate webhook delivery IDs.

## 9. Testing Strategy

### Unit tests

- AES request encryption against a known vector
- Cleanverse envelope parsing
- `verify_apass` result-code mapping
- A-Pass and A-Token input validation
- A-Token application-state and polling behavior
- decimal amount conversion
- secret redaction

### Contract tests

- Mock each Cleanverse endpoint with sanitized v5.6-shaped fixtures
- Verify success, denial, business failure, malformed data, and timeout cases
- Ensure HTTP 200 with business failure does not become approval

### Frontend tests

- wrong-network handling
- approved preflight
- denied preflight
- signature requested only after approval
- transaction pending, confirmed, and failed states
- report pending and available states

### End-to-end tests

- Wallet A: eligible transfer completes
- Wallet B: denied before signature
- Sandbox unavailable: safe error or clearly labelled demo fixture
- Cleanverse report delayed: transaction remains confirmed

## 10. Implementation Phases

### Phase 0: Resolve external prerequisites — blocked externally

- Confirm the API ID has Issue Member permissions.
- Obtain the A-Token ABI and role/mint instructions.
- Confirm Monad sandbox RPC and explorer details.
- Confirm the exact Cleanverse sandbox identifiers for the logical investor
  group and subgroup.

These checks can run in parallel with the remaining mocked implementation, but
they block live provisioning and settlement.

### Phase 1: Workspace and core shared contracts — substantially complete

- Completed: pnpm workspace, Vite/React, Hono, shared preflight schemas,
  decision codes, environment validation, linting, tests, and root build
  commands.
- Remaining: contracts package, formatting command, secret scanning, terminal
  event types, application-state contracts for browser/API use, and
  transaction-evidence contracts.

### Phase 2: Cleanverse client — MVP methods complete

- Completed: authentication, request IDs, encryption, safe errors, A-Pass
  generation, compliance reads, A-Token launch/status/polling, mocked v5.6
  coverage, transaction-index queries, time-limited report downloads, empty
  index-result handling, and one read-only sandbox connectivity check.

### Phase 3: RWA and identity preparation — not started live

- Generate or confirm demo A-Passes.
- Launch `TRWA` with 18 decimals, the country allowlist, and the confirmed
  investor rule.
- Poll to `ISSUED`.
- Grant `MINTER_ROLE` and mint `1,000,000 TRWA`.
- Record only non-secret addresses and transaction hashes.

### Phase 4: Orchestration API — preflight and asset lifecycle complete

- Completed: health, readiness, preflight validation, sender/recipient
  verification, rule retrieval, ordered decisions, restricted single-origin
  CORS, and redacted failure logging.
- Completed: protected standard A-Token launch, application-status snapshots,
  operator bearer authentication, shared lifecycle schemas, and fixed-window
  rate limits.
- Remaining: the transaction-evidence route.

### Phase 5: Frontend — visual shell only

- Completed: responsive split shell, initial asset/recipient/amount fields, and
  static compliance-terminal layout.
- Remaining: wallet provider, network switching, shared schemas, form
  validation, demo-wallet selectors, preflight request state, ordered terminal
  rendering, signing, confirmation, explorer link, and report states.

### Phase 6: Verification and demo hardening — not started end to end

- Run unit, contract, frontend, and end-to-end tests.
- Test the complete flow against the sandbox and Monad.
- Prepare sanitized deterministic fixtures if approved.
- Record successful and denied demo checkpoints.

### Phase 7: Deployment and submission — deferred

- Deploy the API to the VPS.
- Configure the frontend on Vercel.
- Restrict CORS and set production environment variables.
- Run live smoke tests.
- Record the demo video.
- Prepare the one-page summary and final submission.

## 10.1 Remaining PR sequence

Use a separate branch and PR for each independently reviewable unit:

1. `feat/cleanverse-transaction-evidence` (this PR)
   - Add `queryTransactions` and `downloadTravelRuleReport`.
   - Normalize indexed, delayed, unsupported, and malformed results.
2. `feat/server-asset-lifecycle` (implemented)
   - Add protected launch and application-status routes.
   - Add operator authentication, shared schemas, rate limits, and route tests.
3. `feat/monad-contract-foundation`
   - Initialize `packages/contracts`.
   - Add verified Monad configuration, the supplied A-Token ABI, metadata,
     decimal conversion, balance reads, and transfer preparation.
4. `feat/server-transaction-evidence`
   - Add transaction-hash validation, bounded index polling, and report
     availability responses.
5. `feat/web-preflight-terminal` (frontend owner)
   - Add `@cleangraph/shared`, client validation, API integration, demo-wallet
     selectors, and ordered terminal states.
6. `feat/web-wallet-settlement` (frontend owner, paired with contract work)
   - Add the selected wallet provider, Monad switching, simulation/signing,
     receipt confirmation, and explorer links.
7. `feat/web-transaction-evidence` (frontend owner)
   - Render index/report pending, ready, unsupported, and failed states.
8. `test/demo-e2e-hardening`
   - Add eligible and denied end-to-end journeys, secret scanning, final
     sandbox checks, and optional clearly labelled deterministic fixtures.
9. `chore/deploy-and-submit`
   - Configure the VPS and Vercel, run production smoke tests, and finish the
     video, one-page summary, links, and submission.

Live sandbox preparation is an operational checkpoint between PRs 3 and 6:
create both A-Passes, issue `TRWA`, grant `MINTER_ROLE`, mint the supply, and
record only safe identifiers.

## 11. Key Risks

- **API role not approved:** A-Token launch requires Issue Member access.
- **Asynchronous issuance:** The asset may not reach `ISSUED` during the live
  presentation; prepare it before the main demo.
- **Missing contract artifacts:** v5.6 does not provide the A-Token ABI or
  minting calls.
- **Business codes inside HTTP 200:** Incorrect parsing could approve a failed
  request.
- **Indexer/report delay:** Evidence may appear after settlement.
- **Wallet library compatibility:** Privy must support the selected Monad
  configuration.
- **Unsupported claims:** The demo accreditation labels and country allowlist
  must not be described as legal advice, production screening, or an OFAC
  integration.

## 12. Remaining Technical Decisions

1. Privy versus another wallet library
2. Operator authentication for the asset-lifecycle API
3. Whether deterministic demo fixtures are permitted
4. Which Cleanverse contract artifacts and Monad environment are available
5. Whether the sandbox supports transaction reports for the final Monad
   transfer flow
