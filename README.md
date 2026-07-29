# CleanGraph

CleanGraph is an API-driven compliance orchestration layer powered by
Cleanverse. It combines Cleanverse Verified Identity (CVI), Cleanverse
Verified Assets (CVA), and the Cleanverse Compliance Protocol (CCP) before
allowing a transaction to settle.

## Current status

The repository is in the planning stage for the Cleanverse Build: Trusted
Assets Hackathon. Product requirements, architecture decisions, and build
tasks will be developed in the root planning documents.

Do not commit API keys, wallet private keys, access codes, or other secrets.
Copy `.env.example` to a local `.env` file when implementation begins.

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
