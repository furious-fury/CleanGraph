# CleanGraph Implementation Plan

**Status:** Draft v0.1  
**Depends on:** `PRD.md` open product decisions  
**Technical source:** Cleanverse Cooperate API v5.6

## 1. Implementation Objective

Build a Vite and React frontend plus a Node.js and TypeScript backend that:

1. exposes the Cleanverse A-Pass and A-Token lifecycle safely;
2. preflights both parties to an RWA transfer;
3. requests a wallet signature only after approval;
4. settles the A-Token transfer on Monad; and
5. displays indexed transaction evidence and a downloadable report.

Deployment is intentionally scheduled as the final phase. The intended targets
are Vercel for the frontend and the team's VPS for the backend.

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

Use a package-workspace tool so shared packages can be consumed without
publishing. The final package manager remains an implementation decision.

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

Candidate libraries:

- Vite
- React
- TypeScript
- Tailwind CSS
- Privy for wallet onboarding
- viem for EVM contract reads, writes, and receipt polling
- TanStack Query for server and chain request state
- Zod using schemas shared with the backend

Privy must be validated against Monad before it becomes final.

### 3.2 Orchestration API

Responsibilities:

- validate all client payloads;
- keep Cleanverse credentials server-side;
- encrypt protected Cleanverse request bodies;
- normalize Cleanverse envelopes and business codes;
- orchestrate sender and recipient verification;
- apply optional CleanGraph amount rules;
- emit sanitized progress events; and
- query post-settlement evidence.

Recommended framework for the hackathon: Hono on the Node.js adapter with Zod
validation. Its typed RPC client can share route contracts directly with the
Vite frontend. Fastify is the preferred alternative when the team values a
more Node-specific plugin system, built-in structured logging, and schema-based
response serialization over the smaller Hono surface. Express is supported but
would require more manual validation and response typing.

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

Initial typed methods:

- `generateAPass`
- `queryAPass`
- `launchAToken`
- `queryATokenApplication`
- `queryATokenRules`
- `verifyAPassForToken`
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
the demo operator and must never expose the API key.

### `GET /api/v1/assets/applications/:requestId`

Returns the normalized issuance application state.

### `POST /api/v1/transactions/evidence`

Accepts a confirmed transaction hash and returns indexed transaction details
plus report availability.

### Progress transport

Use Server-Sent Events if live step-by-step backend progress materially
improves the terminal. For the MVP, returning the ordered check array after
preflight is simpler and more reliable. The team must select one approach.

## 6. Decision Model

The decision pipeline is:

1. Validate chain, addresses, token address, and amount.
2. Verify the sender with `verify_apass`.
3. Verify the recipient with `verify_apass`.
4. Load A-Token rules for display and evidence.
5. Apply the optional CleanGraph per-transfer amount limit.
6. Return `approved: true` only when every required check passes.

Example normalized denial codes:

- `ATOKEN_NOT_FOUND`
- `SENDER_APASS_MISSING`
- `RECIPIENT_APASS_MISSING`
- `SENDER_NOT_ELIGIBLE`
- `RECIPIENT_NOT_ELIGIBLE`
- `AMOUNT_LIMIT_EXCEEDED`
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
- amount-rule edge cases
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

### Phase 0: Resolve external prerequisites

- Confirm the API ID has Issue Member permissions.
- Obtain the A-Token ABI and role/mint instructions.
- Confirm Monad sandbox RPC and explorer details.
- Select the RWA and exact compliance attributes.

### Phase 1: Workspace and shared contracts

- Configure the TypeScript workspace.
- Add shared schemas, decision codes, and environment validation.
- Configure linting, formatting, tests, and secret checks.

### Phase 2: Cleanverse client

- Implement authentication headers and request IDs.
- Implement AES encryption for protected request bodies.
- Add typed client methods and normalized errors.
- Validate against sandbox read endpoints before write operations.

### Phase 3: RWA and identity preparation

- Generate or confirm demo A-Passes.
- Launch the Monad A-Token with its initial rule.
- Poll to `ISSUED`.
- Grant `MINTER_ROLE` and mint the demo supply.
- Record only non-secret addresses and transaction hashes.

### Phase 4: Orchestration API

- Implement preflight and evidence routes.
- Add sender/recipient verification.
- Add A-Token rule retrieval.
- Add optional CleanGraph amount enforcement.
- Add safe structured logging.

### Phase 5: Frontend

- Build wallet and network state.
- Build transfer form and validation.
- Build compliance terminal.
- Integrate preflight and A-Token transfer.
- Build confirmation and report states.

### Phase 6: Verification and demo hardening

- Run unit, contract, frontend, and end-to-end tests.
- Test the complete flow against the sandbox and Monad.
- Prepare sanitized deterministic fixtures if approved.
- Record successful and denied demo checkpoints.

### Phase 7: Deployment and submission

- Deploy the API to the VPS.
- Configure the frontend on Vercel.
- Restrict CORS and set production environment variables.
- Run live smoke tests.
- Record the demo video.
- Prepare the one-page summary and final submission.

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
- **Unsupported claims:** OFAC screening, accreditation, and amount limits must
  be described using their actual implemented mappings.

## 12. Remaining Technical Decisions

1. Hono or Fastify
2. pnpm, npm, or another workspace package manager
3. Privy versus another wallet library
4. Polling response versus Server-Sent Events for terminal progress
5. Whether a database is required
6. Whether deterministic demo fixtures are permitted
7. Which Cleanverse contract artifacts and Monad environment are available
