# Frontend API handoff

## Purpose

Implement CleanGraph as a compliance preflight followed by a TRWA ERC-20
transfer on Monad Testnet:

1. Connect the user wallet.
2. Submit the proposed transfer to the API.
3. Display the returned compliance checks.
4. Open a wallet signature prompt only when the API explicitly approves.
5. Submit the ERC-20 transfer and wait for a successful receipt.

The API is an application-level preflight gate. It does not restrict direct
ERC-20 calls outside CleanGraph. Do not describe TRWA as on-chain
transfer-restricted.

## Public frontend configuration

Use public values only. Never expose Cleanverse credentials, the operator token,
or any private key in a `VITE_` variable.

```dotenv
VITE_API_BASE_URL=http://localhost:3000
VITE_MONAD_CHAIN_ID=10143
VITE_MONAD_RPC_URL=<Monad Testnet RPC URL>
VITE_MONAD_EXPLORER_URL=<Monad Testnet explorer URL>
```

```ts
export const TRWA_TOKEN_ADDRESS =
  "0x07DF3e225e2a7e67056078cF240eF5A3bD966CB4" as const;
export const MONAD_TESTNET_CHAIN_ID = 10143;
export const TRWA_DECIMALS = 18;
```

## Backend startup

The API reads variables from the current shell. Start it from Git Bash in the
repository root:

```bash
unset TRWA_ALLOWED_GROUP TRWA_ALLOWED_SUBGROUP
set -a
source .env
set +a
pnpm --filter @cleangraph/api exec tsx watch src/index.ts
```

The current country-only demo policy requires:

```dotenv
TRWA_TOKEN_ADDRESS=0x07DF3e225e2a7e67056078cF240eF5A3bD966CB4
TRWA_ALLOWED_GROUP=
TRWA_ALLOWED_SUBGROUP=
TRWA_ALLOWED_COUNTRIES=US,GB,DE,SG
```

Token address and country allowlist are required together. Group and subgroup
are optional exact, case-sensitive two-character provider codes. Leave both
blank for the current demo because its A-Passes have blank values.

Confirm readiness before starting the transfer screen:

```bash
curl -i http://localhost:3000/ready
```

Proceed only with HTTP `200` and `checks.preflightService: true`.

## Complete endpoint reference

These are all endpoints currently exposed by the API.

| Method | Path | Authentication | What it does | Frontend use |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | None | Returns `200` with `{ status: "ok", service, requestId }` whenever the HTTP process is running. | Optional liveness indicator only. It does not prove Cleanverse or preflight is configured. |
| `GET` | `/ready` | None | Returns `200` with `preflightService: true` when Cleanverse credentials and the TRWA policy are loaded; otherwise returns `503` with `status: "degraded"`. | Call at startup and before a live demo. Show a non-blocking service-status message. |
| `POST` | `/api/v1/compliance/preflight` | None | Validates a proposed Monad TRWA transfer, checks the sender then recipient A-Pass, and evaluates the local token policy. | Required immediately before any transfer signature. It is the main transfer endpoint. |
| `POST` | `/api/v1/demo/apass/challenges` | Wallet signature follows | Creates a five-minute, one-time message bound to the wallet, action, origin, and fictional profile. | Request before demo creation and before every status check. |
| `POST` | `/api/v1/demo/apasses` | One-time CREATE challenge signature | Creates a fictional GB or BR A-Pass through backend-only Cleanverse credentials. | Submit the exact signed challenge; never send identity fields. |
| `POST` | `/api/v1/demo/apasses/status` | One-time STATUS challenge signature | Safely checks whether the wallet onboarding is creating, pending, or active. | Poll using a new challenge and signature each time. |
| `POST` | `/api/v1/transactions/evidence` | `Authorization: Bearer <OPERATOR_TOKEN>` | Looks up a confirmed Monad transaction in Cleanverse and, when possible, returns time-limited report availability. | Do not call from the browser. It is for a trusted backend or operator-only service because the bearer token must remain secret. |

The frontend host must match `FRONTEND_URL`, normally
`http://localhost:5173`. Read `VITE_API_BASE_URL` instead of hard-coding the
API host in components.

### `GET /health`

Use this only to establish that the HTTP server is alive. It always returns
HTTP `200` while the process is running, even if Cleanverse credentials or the
TRWA policy are missing. Do not use it to enable the transfer action.

### `GET /ready`

Use this as the frontend readiness check. A ready response is:

```json
{
  "status": "ready",
  "checks": { "preflightService": true },
  "requestId": "<uuid>"
}
```

If it returns HTTP `503`, show a service-status message and keep transfer
submission unavailable. The body is safe to display; it does not reveal secrets.

### `POST /api/v1/compliance/preflight`

This endpoint is described in the next section. It is public to the configured
frontend origin, but approval is not authorization to skip the wallet: the
user must still sign from the connected wallet.

### `POST /api/v1/transactions/evidence`

This endpoint is not part of the browser transfer flow. It requires the
backend-only operator bearer token, allows at most 20 requests per minute per
API process, and returns `Cache-Control: no-store` because report URLs can be
time-limited and bearer-like.

A trusted service sends this body after a transaction has a confirmed receipt:

```json
{
  "chain": "monad",
  "transactionHash": "0x<64 hexadecimal characters>",
  "walletAddress": "0x<40 hexadecimal characters>"
}
```

It returns HTTP `200` with either `index.status: "PENDING"` or
`index.status: "INDEXED"`. An indexed response can have a report status of
`AVAILABLE` or `UNAVAILABLE`; unavailable evidence does not invalidate a
confirmed Monad transaction. Errors use `401` for missing/invalid operator
authentication, `429` for rate limiting, `422` for an invalid request, `502` or
`504` for Cleanverse failures, and `503` when the service is unconfigured.
Never expose, log, or persist a returned report download URL in the frontend.

## Fictional demo A-Pass onboarding

> **UAT only:** the GB and BR profiles are fictional hackathon test data. They
> are not identity verification or real Know Your Customer (KYC). Production
> must replace the profile selector with a trusted KYC-provider result.

The browser sends only the wallet, profile choice, one-time challenge ID, and
signature. The API constructs the fictional name, deterministic customer ID,
document value, country, and one-year expiry in memory. Those identity values,
the customer ID, signatures, credentials, and raw Cleanverse responses are not
returned, logged, or stored.

Every response from these endpoints has `Cache-Control: no-store`. The API
uses the exact `FRONTEND_URL` for Cross-Origin Resource Sharing (CORS).
When `DEMO_MODE` is false, all three paths return `404` without calling
Cleanverse.

### Backend configuration and database

Add these backend-only values:

```dotenv
DEMO_MODE=true
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
FRONTEND_URL=http://localhost:5173
DEMO_CLIENT_IP_HEADER=X-Forwarded-For
```

`CLEANVERSE_API_ID` and `CLEANVERSE_API_KEY` must also be loaded. The API
will refuse an enabled demo configuration unless the database and both
Cleanverse credentials are present. `FRONTEND_URL` defaults to
`http://localhost:5173` and must be set to the deployed frontend URL.

The configured client-IP header is trusted only when the deployment proxy
removes incoming copies and sets its own value. Do not expose a deployment that
blindly trusts a user-controlled forwarded header.

Run all pending migrations before enabling the routes and on every deployment:

```bash
pnpm --filter @cleangraph/api db:migrate
```

The runner discovers every numbered SQL file in `apps/api/migrations`, applies
pending files in filename order, records a SHA-256 checksum in
`cleangraph_schema_migrations`, and uses a PostgreSQL advisory lock so only one
deployment migrates at a time. It is safe to run on every deployment. Never edit
an applied migration; add the next numbered SQL file instead.

Run this command daily from the deployment scheduler to remove challenges,
rate-limit buckets, and onboarding audit rows after 30 days:

```bash
pnpm --filter @cleangraph/api purge:demo-apass
```

### 1. Request the creation challenge

```http
POST /api/v1/demo/apass/challenges
Content-Type: application/json

{
  "walletAddress": "0x1111111111111111111111111111111111111111",
  "purpose": "CREATE",
  "profile": "ELIGIBLE_GB"
}
```

Allowed profiles are:

- `ELIGIBLE_GB`: fictional GB identity intended to pass the current country policy.
- `RESTRICTED_BR`: fictional BR identity intended to demonstrate policy denial.

The HTTP `201` response is:

```json
{
  "challengeId": "223e4567-e89b-42d3-a456-426614174000",
  "message": "<exact message to sign>",
  "expiresAt": "2026-08-09T12:05:00.000Z"
}
```

Do not modify, reconstruct, or normalize `message` in the frontend.

### 2. Sign the exact message

For an injected EIP-1193 wallet:

```ts
const [walletAddress] = (await window.ethereum.request({
  method: "eth_requestAccounts",
})) as [`0x${string}`];

const signature = (await window.ethereum.request({
  method: "personal_sign",
  params: [challenge.message, walletAddress],
})) as `0x${string}`;
```

Some wallet libraries abstract `personal_sign`; use their standard
`signMessage` operation with the exact plain-text message.

### 3. Submit fictional onboarding

```http
POST /api/v1/demo/apasses
Content-Type: application/json
X-Request-ID: <new UUID>

{
  "walletAddress": "0x1111111111111111111111111111111111111111",
  "profile": "ELIGIBLE_GB",
  "challengeId": "223e4567-e89b-42d3-a456-426614174000",
  "signature": "0x<130 hexadecimal signature characters>"
}
```

A submitted registration returns HTTP `202`:

```json
{
  "walletAddress": "0x1111111111111111111111111111111111111111",
  "status": "PENDING",
  "registrationTransactionHash": "0x<64 hexadecimal characters>"
}
```

If Cleanverse is already active immediately, the endpoint can return HTTP
`200` with `status: "ACTIVE"`. If any A-Pass already exists for the wallet,
it returns HTTP `409` without overwriting it:

```json
{
  "walletAddress": "0x1111111111111111111111111111111111111111",
  "status": "ALREADY_EXISTS"
}
```

Never send `country`, `fullName`, `customerId`, `documentHash`,
`expirationTime`, `group`, `subGroup`, or `override`. Unknown fields are
rejected with HTTP `422`.

### 4. Request a fresh status challenge

A creation signature cannot read status. Request a new challenge for each poll:

```http
POST /api/v1/demo/apass/challenges
Content-Type: application/json

{
  "walletAddress": "0x1111111111111111111111111111111111111111",
  "purpose": "STATUS"
}
```

Sign the returned exact message, then submit:

```http
POST /api/v1/demo/apasses/status
Content-Type: application/json
X-Request-ID: <new UUID>

{
  "walletAddress": "0x1111111111111111111111111111111111111111",
  "challengeId": "<fresh status challenge UUID>",
  "signature": "0x<130 hexadecimal signature characters>"
}
```

The safe HTTP `200` response contains only the wallet, status, and transaction
hash when known:

```json
{
  "walletAddress": "0x1111111111111111111111111111111111111111",
  "status": "ACTIVE",
  "registrationTransactionHash": "0x<64 hexadecimal characters>"
}
```

### UI state and errors

- `CREATING`: the backend has claimed the one allowed issuance attempt.
- `PENDING`: Cleanverse returned a registration transaction but has not yet
  reported an active A-Pass.
- `ACTIVE`: `queryAPass()` confirmed the A-Pass is active.
- `ALREADY_EXISTS`: an A-Pass existed before this demo request; do not offer an
  overwrite button.

Handle `404` as demo mode disabled, `503` as missing demo configuration,
`401` as an invalid signature, and `409` as a mismatched/replayed
challenge or existing A-Pass, `410` as an expired challenge, `422` as
invalid input, `429` using the `Retry-After` header, and `502`/`504` as
safe Cleanverse failures. Obtain a fresh challenge before retrying creation.

A demo A-Pass is not transfer approval. The frontend must still call
`POST /api/v1/compliance/preflight` immediately before every transfer wallet
prompt and must not sign when preflight denies or fails.

## Preflight request

Send exactly these fields. Unknown fields and the old `atokenAddress` field are
rejected.

```json
{
  "chain": "monad",
  "sender": "0x1111111111111111111111111111111111111111",
  "recipient": "0x2222222222222222222222222222222222222222",
  "tokenAddress": "0x07DF3e225e2a7e67056078cF240eF5A3bD966CB4",
  "amount": "1"
}
```

- `chain` is exactly `"monad"`.
- `sender` is the connected wallet.
- All address fields are EVM addresses.
- `amount` is a positive decimal string with up to 18 decimal places. Do not
  send a JavaScript number.
- Send `X-Request-ID: crypto.randomUUID()` when available; the API generates one
  when omitted.

```ts
export async function requestPreflight(input: {
  sender: `0x${string}`;
  recipient: `0x${string}`;
  amount: string;
}) {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/v1/compliance/preflight`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": crypto.randomUUID(),
      },
      body: JSON.stringify({
        chain: "monad",
        sender: input.sender,
        recipient: input.recipient,
        tokenAddress: TRWA_TOKEN_ADDRESS,
        amount: input.amount,
      }),
    },
  );

  return { status: response.status, body: await response.json() };
}
```

## Required decision handling

HTTP `200` does not automatically mean approval. Check `body.approved`.

| Response | Required UI behavior |
| --- | --- |
| `200` with `approved: true` and `TRANSFER_APPROVED` | Render approved checks and enable the final transfer action. |
| `200` with `approved: false` | Render the denial. Do not simulate, sign, or send a transaction. |
| `422` | Show recipient, token, or amount validation feedback. |
| `502`, `504`, or `500` | Show a retryable service error. Do not ask the wallet to sign. |
| `503` | Show that compliance is unconfigured; re-check `/ready`. Do not ask the wallet to sign. |

Common denial codes: `TOKEN_NOT_SUPPORTED`, `SENDER_APASS_INACTIVE`,
`RECIPIENT_APASS_INACTIVE`, `SENDER_APASS_EXPIRED`, `RECIPIENT_APASS_EXPIRED`,
`SENDER_POLICY_MISMATCH`, and `RECIPIENT_POLICY_MISMATCH`.

## Wallet transaction after approval

Only when `approved === true`:

1. Confirm the connected wallet is on Monad Testnet (`10143`).
2. Convert the exact amount using `parseUnits(amount, 18)`. Never use
   floating-point arithmetic.
3. Simulate the call if the wallet library supports it.
4. Call `transfer(recipient, parsedAmount)` on `TRWA_TOKEN_ADDRESS` from the
   connected wallet.
5. Wait for a successful receipt, then show the transaction hash and explorer
   link.

Never use `DEPLOYER_PRIVATE_KEY` in the browser.

## Demo scenarios

The current policy requires active, unexpired A-Passes and an allowed country.
Group and subgroup are intentionally blank and not enforced.

- Approval: a `GB` sender transfers to a `GB` recipient.
- Denial: a `GB` sender transfers to the `BR` demo recipient. The API returns
  `RECIPIENT_POLICY_MISMATCH`; the frontend must not open a wallet prompt.

Every transaction sender needs test MON for gas and enough TRWA for the amount.

## Completion checklist

- [ ] Read `VITE_API_BASE_URL` from environment configuration.
- [ ] Label demo onboarding as fictional UAT, not real KYC.
- [ ] Request and sign the exact CREATE challenge before onboarding.
- [ ] Poll with a fresh signed STATUS challenge each time.
- [ ] Never send or display identity, customer, or Cleanverse credential data.
- [ ] Show `/ready` state on startup.
- [ ] Validate recipient and amount before preflight.
- [ ] Disable transfer controls while preflight is pending.
- [ ] Render returned compliance checks.
- [ ] Block every signature path unless `approved === true`.
- [ ] Verify Monad Testnet before signing.
- [ ] Use 18-decimal integer units for the contract call.
- [ ] Handle wallet rejection, reverts, and receipt timeouts.
- [ ] Keep credentials, operator tokens, and private keys out of the client.

## Source of truth

- `packages/shared/src/demo-apass.ts`: demo onboarding request and safe response schemas
- `apps/api/src/routes/demo-apass.ts`: demo HTTP status and error behavior
- `apps/api/src/services/demo-apass.ts`: challenge, issuance, retry, and polling behavior
- `apps/api/migrations/001_demo_apass.sql`: PostgreSQL tables and indexes
- `packages/shared/src/preflight.ts`: transfer preflight request and response schema
- `apps/api/src/routes/preflight.ts`: HTTP status behavior
- `apps/api/src/services/preflight.ts`: policy evaluation
- `apps/api/src/config/env.ts`: environment validation