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
| `POST` | `/api/v1/compliance/preflight` | None | Validates a proposed Monad TRWA transfer, checks the sender then recipient A-Pass, and evaluates the local token policy. | Required immediately before any transfer signature. It is the main frontend endpoint. |
| `POST` | `/api/v1/transactions/evidence` | `Authorization: Bearer <OPERATOR_TOKEN>` | Looks up a confirmed Monad transaction in Cleanverse and, when possible, returns time-limited report availability. | Do not call from the browser. It is for a trusted backend or operator-only service because the bearer token must remain secret. |

The frontend host must match `API_CORS_ORIGIN`, normally
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

- `packages/shared/src/preflight.ts`: request and response schema
- `apps/api/src/routes/preflight.ts`: HTTP status behavior
- `apps/api/src/services/preflight.ts`: policy evaluation
- `apps/api/src/config/env.ts`: environment validation