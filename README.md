# CleanGraph

CleanGraph is an API-driven compliance orchestration layer powered by
Cleanverse. It combines Cleanverse Verified Identity (CVI), Cleanverse
Verified Assets (CVA), and the Cleanverse Compliance Protocol (CCP) before
allowing a transaction to settle.

## Current status

The frontend is a Vite/React application using shadcn/ui, and the backend is a
Hono API running on Node.js. The backend preflight endpoint is connected to
Cleanverse A-Pass verification and A-Token rule reads. Smart-contract
settlement is not connected yet.

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
```

`CLEANVERSE_BASE_URL` and `CLEANVERSE_TIMEOUT_MS` are optional. The base URL
defaults to the Cleanverse sandbox and the timeout defaults to 10 seconds.
`CLEANVERSE_API_BASE_URL` remains accepted as a backwards-compatible base URL
name. Cleanverse credentials must exist only in the backend environment.

Useful checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The API currently exposes:

- `GET /health` for liveness
- `GET /ready` for validated Cleanverse client readiness
- `POST /api/v1/compliance/preflight` for ordered sender, recipient, and
  A-Token rule checks

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
  contracts/            CVA and settlement smart contracts
  shared/               Shared schemas, types, and utilities
docs/
  decisions/            Architecture decision records
scripts/                Development and deployment helpers
tests/
  e2e/                  End-to-end demo flows
  fixtures/             Deterministic sandbox and fallback data
```
