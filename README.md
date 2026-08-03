# CleanGraph

CleanGraph is a hackathon application that checks Cleanverse A-Pass identity
data before asking a wallet to transfer a self-deployed Monad ERC-20.

## Current status

The frontend is a Vite/React application using shadcn/ui, and the backend is a
Hono API running on Node.js. The repository now contains a fixed-supply
self-deployed `TRWA` ERC-20 and viem helpers for Monad. Backend preflight
queries sender and recipient A-Passes and evaluates CleanGraph's configured
group, subgroup, country, status, and expiration policy.

The Node-only Cleanverse client supports secure transport, A-Pass generation,
A-Pass and A-Token compliance reads, encrypted A-Token launch, application
status reads, bounded status polling, transaction-index queries, and
time-limited report downloads. A-Token client methods remain optional adapter
functionality outside the primary demo. Hono exposes preflight and protected
bounded transaction-evidence reads; it does not expose A-Token launch or status
routes. No live A-Pass records have been created by the repository.

`TRWA` is a CleanGraph hackathon token, not an officially issued or registered
Cleanverse A-Token. CleanGraph's Cleanverse gate is application-level;
direct ERC-20 calls are unrestricted and can bypass the backend preflight.

The frontend is currently a static visual shell. Contract deployment, wallet
connection, API integration, Monad settlement, transaction evidence UI, live
demo provisioning, and application deployment remain.

Do not commit API keys, wallet private keys, access codes, or other secrets.
Copy `.env.example` to a local `.env` file and provide credentials only to the
backend process.

## Local development

Prerequisites: Node.js 22 or newer and pnpm 10.

```bash
pnpm install
pnpm dev
```

The frontend runs at `http://localhost:5173` and the API defaults to
`http://localhost:3000`.

Backend Cleanverse configuration:

```dotenv
CLEANVERSE_API_ID=your-api-id
CLEANVERSE_API_KEY=your-base64-aes-key
CLEANVERSE_BASE_URL=https://uatapi.cleanverse.com/api/cooperate
CLEANVERSE_TIMEOUT_MS=10000
OPERATOR_TOKEN=replace-with-at-least-32-random-characters
TRWA_TOKEN_ADDRESS=0x...
TRWA_ALLOWED_GROUP=Institutional Investor
TRWA_ALLOWED_SUBGROUP=Accredited Investor
TRWA_ALLOWED_COUNTRIES=US,GB,DE,SG
```

`CLEANVERSE_BASE_URL` and `CLEANVERSE_TIMEOUT_MS` are optional. The base URL
defaults to the Cleanverse sandbox and the timeout defaults to 10 seconds.
`CLEANVERSE_API_BASE_URL` remains accepted as a backwards-compatible base URL
name. Configure all four `TRWA_*` policy variables together; partial or
malformed policy configuration is rejected. `OPERATOR_TOKEN` protects evidence
requests and must remain only in the backend environment.

Useful checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Remaining MVP work

The critical path is:

1. Review and merge the self-deployed TRWA contract package.
2. Deploy and verify TRWA on Monad testnet, then record only its public address,
   deployment transaction, chain ID, and explorer links.
3. Configure the verified token address and local policy in the API.
4. Provision the two demo A-Passes.
5. Connect the frontend to preflight, render ordered compliance checks, and
   add the selected Monad wallet provider.
6. Prove an eligible transfer confirms and the Wallet B scenario stops before
   signing.
7. Complete evidence/report UI states, end-to-end tests, deployment, and
   submission.

See [PRD.md](./PRD.md), [Implementation_plan.md](./Implementation_plan.md), and
[tasklist.md](./tasklist.md) for requirements, PR sequencing, and detailed
acceptance tasks.

The API currently exposes:

- `GET /health` for liveness
- `GET /ready` for configured Cleanverse and local TRWA preflight readiness
- `POST /api/v1/compliance/preflight` for ordered sender, recipient, and local
  TRWA policy checks over Cleanverse A-Pass data
- `POST /api/v1/transactions/evidence` for authenticated indexed transaction
  evidence and report availability

The evidence route accepts a confirmed Monad transaction hash and wallet
address. It makes up to three index reads one second apart and returns HTTP
`200` with either `index.status: "PENDING"` or `"INDEXED"`. Reports are requested
only for indexed transactions. A known report failure returns
`report.status: "UNAVAILABLE"` without changing the indexed settlement state.
The route allows 20 authenticated requests per 60-second process window and
sets `Cache-Control: no-store` because available report URLs are time-limited
and may contain bearer-like tokens. It requires `Authorization: Bearer
<OPERATOR_TOKEN>`. Never log or persist report URLs.

For the unregistered self-deployed TRWA token, Cleanverse transaction indexing
and report generation are best-effort. An unavailable report does not invalidate
a confirmed Monad transfer.

Preflight returns HTTP `200` for completed approved or denied policy
decisions. Invalid requests return `422`; missing server configuration returns
`503`; Cleanverse availability and response failures return `502`; Cleanverse
timeouts return `504`; and unexpected failures return `500`.

One UUID request ID is preserved in the `X-Request-ID` header, response body,
and every Cleanverse operation. Public decisions, errors, and structured logs
use fixed sanitized messages and never include credentials, raw upstream
responses, KYC data, or registration URLs.

## Repository layout

```text
apps/
  api/                  CleanGraph orchestration API
  web/                  User interface and compliance terminal
packages/
  cleanverse-client/    Cleanverse API adapter
  contracts/            Self-deployed TRWA ERC-20 and Monad/viem helpers
  shared/               Shared schemas, types, and utilities
docs/
  decisions/            Placeholder for architecture decision records
scripts/                Placeholder for setup and deployment helpers
tests/
  e2e/                  Placeholder for end-to-end demo flows
  fixtures/             Placeholder for cross-package demo fixtures
```
