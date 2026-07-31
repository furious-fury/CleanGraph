# CleanGraph

CleanGraph is an API-driven compliance orchestration layer powered by
Cleanverse. It combines Cleanverse Verified Identity (CVI), Cleanverse
Verified Assets (CVA), and the Cleanverse Compliance Protocol (CCP) before
allowing a transaction to settle.

## Current status

The frontend is a Vite/React application using shadcn/ui, and the backend is a
Hono API running on Node.js. The backend preflight endpoint is connected to
Cleanverse A-Pass verification and A-Token rule reads.

The Node-only Cleanverse client supports secure transport, A-Pass generation,
A-Pass and A-Token compliance reads, encrypted A-Token launch, application
status reads, bounded status polling, transaction-index queries, and
time-limited report downloads. The launch and evidence clients are not exposed
through public Hono routes, and no live A-Pass or A-Token records have been
created by the repository.

The frontend is currently a static visual shell. Wallet connection, API
integration, Monad smart-contract settlement, transaction evidence, live demo
provisioning, and deployment remain.

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

## Remaining MVP work

The critical path is:

1. Confirm Cleanverse Issue Member access, group/subgroup codes, Monad network
   details, the A-Token ABI, and role/mint instructions.
2. Add protected asset-lifecycle and transaction-evidence API routes.
3. Build the contracts package and Monad transfer helpers.
4. Provision the two demo A-Passes, issue `TRWA`, grant `MINTER_ROLE`, and mint
   `1,000,000 TRWA`.
5. Connect the frontend to preflight, render ordered compliance checks, and
   add the selected Monad wallet provider.
6. Prove an eligible transfer confirms and the Wallet B scenario stops before
   signing.
7. Complete evidence/report states, end-to-end tests, deployment, and
   submission.

See [PRD.md](./PRD.md), [Implementation_plan.md](./Implementation_plan.md), and
[tasklist.md](./tasklist.md) for requirements, PR sequencing, and detailed
acceptance tasks.

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
  contracts/            Placeholder for A-Token ABI and Monad helpers
  shared/               Shared schemas, types, and utilities
docs/
  decisions/            Placeholder for architecture decision records
scripts/                Placeholder for setup and deployment helpers
tests/
  e2e/                  Placeholder for end-to-end demo flows
  fixtures/             Placeholder for cross-package demo fixtures
```
