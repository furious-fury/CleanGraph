# CleanGraph

CleanGraph is an API-driven compliance orchestration layer powered by
Cleanverse. It combines Cleanverse Verified Identity (CVI), Cleanverse
Verified Assets (CVA), and the Cleanverse Compliance Protocol (CCP) before
allowing a transaction to settle.

## Current status

The product plan and initial application shells are in place. The frontend is
a Vite/React application using shadcn/ui, and the backend is a Hono API running
on Node.js. Cleanverse calls and smart contracts are not connected yet.

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

Useful checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The API currently exposes:

- `GET /health` for liveness
- `GET /ready` for backend credential readiness
- `POST /api/v1/compliance/preflight` for request-shape validation; it returns
  `501` until the Cleanverse compliance adapter is implemented

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
