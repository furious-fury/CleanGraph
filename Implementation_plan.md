# CleanGraph Implementation Plan

**Status:** Backend and contract foundation implemented; deployment and frontend remain

**Last updated:** August 7, 2026

## 1. Architecture

```text
Browser wallet
  -> POST /api/v1/compliance/preflight
     -> Cleanverse queryAPass(sender)
     -> CleanGraph local policy
     -> Cleanverse queryAPass(recipient)
     -> CleanGraph local policy
  -> simulate and sign TRWA.transfer only when approved
  -> Monad testnet
  -> POST /api/v1/transactions/evidence (trusted operator/backend)
     -> best-effort Cleanverse index and report
```

The browser owns wallet connection and signing. The API owns Cleanverse
credentials and policy. The TRWA contract is an unrestricted fixed-supply
ERC-20. No component should claim the local gate is on-chain enforcement.

## 2. Repository responsibilities

```text
apps/api/                  Hono preflight and evidence orchestration
apps/web/                  Wallet and compliance user experience
packages/cleanverse-client Node-only Cleanverse adapter
packages/contracts/        TRWA Solidity contract and viem helpers
packages/shared/           Public request, decision, and evidence schemas
```

The Cleanverse client's A-Token methods are retained and tested as optional
adapter functionality. They are not exposed through Hono and are outside the
self-deployed TRWA demo.

## 3. Contract PR — implemented

Branch: `feat/monad-trwa-contract`

- Foundry project and pnpm workspace package
- OpenZeppelin 5.4.0 and Solidity 0.8.28 pins
- fixed `1,000,000 TRWA` constructor mint to nonzero treasury
- no mint, owner, pause, allowlist, upgrade, or privileged supply path
- guarded deployment script reading deployer key, treasury, chain ID, and RPC
- Solidity metadata, allocation, transfer, fuzz, failure, and no-mint tests
- viem ABI, metadata, chain validation, amount conversion, reads, simulation,
  receipt, and explorer helpers
- root workspace build, lint, test, and type-check participation

## 4. Deployment checkpoint — user controlled

The contract PR is merged. Complete this user-controlled checkpoint before
configuring a live API or integrating wallet settlement:

1. Install Foundry and confirm `forge`, `cast`, and `anvil` versions.
2. Choose the Monad testnet chain ID, HTTPS RPC, and explorer.
3. Fund a controlled deployer with testnet MON.
4. Set `DEPLOYER_PRIVATE_KEY`, `TRWA_TREASURY_ADDRESS`, `MONAD_CHAIN_ID`, and
   `MONAD_RPC_URL` only in the deployment shell or an ignored environment file.
5. Run `forge fmt --check`, `forge build`, and `forge test`.
6. Run `DeployTRWA` without `--broadcast` and inspect the chain validation and
   simulated address.
7. Broadcast once.
8. Confirm bytecode, name, symbol, decimals, total supply, treasury balance, and
   one small test transfer with `cast`.
9. Verify source on the selected explorer when supported.
10. Record only public address, deployment transaction, chain ID, and explorer
    links. Never record or commit the key or seed.

## 5. Backend preflight PR — implemented

Branch: `feat/server-self-deployed-trwa-preflight`

### Configuration

The API accepts these backend-only values:

```dotenv
CLEANVERSE_API_ID=
CLEANVERSE_API_KEY=
TRWA_TOKEN_ADDRESS=
TRWA_ALLOWED_GROUP=Institutional Investor
TRWA_ALLOWED_SUBGROUP=Accredited Investor
TRWA_ALLOWED_COUNTRIES=US,GB,DE,SG
OPERATOR_TOKEN=
```

All four TRWA policy values are optional as a group. With none, preflight is
unavailable and returns safe `503`. Partial, duplicate-country, lowercase-
country, empty, or malformed address configuration is rejected during
environment validation.

### Request and evaluation order

1. Strictly validate `chain`, `sender`, `recipient`, `tokenAddress`, and
   decimal-string `amount`.
2. Reject a token other than `TRWA_TOKEN_ADDRESS` without a Cleanverse call.
3. Call `queryAPass` for the sender with the incoming request ID.
4. Deny immediately for inactive, expired, or local policy mismatch.
5. Call `queryAPass` for the recipient with the same request ID.
6. Apply the same policy and return approval only when both pass.
7. Return the final CleanGraph-owned `LOCAL_ASSET_POLICY_PASSED` check.

No request calls `verifyAPassForToken` or `queryATokenRules`, because TRWA is
not a registered A-Token. No tier, sub-tier, or amount limit is evaluated.

### Failure and privacy behavior

- Cleanverse configuration failure -> `503 SERVICE_NOT_CONFIGURED`
- Cleanverse timeout -> `504 CLEANVERSE_TIMEOUT`
- HTTP, network, business, or malformed response ->
  `502 CLEANVERSE_UNAVAILABLE`
- unexpected exception -> `500 INTERNAL_SERVER_ERROR`

Only completed sanitized checks survive an infrastructure failure. Responses
and logs omit raw A-Pass data, CV record IDs, KYC hashes, credentials, addresses,
amounts, and upstream messages.

### Removed API surface

The Hono asset launch and application-status routes, asset service, route tests,
and public asset lifecycle schemas are removed. Requests to those paths return
`404`. `OPERATOR_TOKEN` replaces `ASSET_OPERATOR_TOKEN` for the evidence route.
Authentication still runs before its fixed-window rate limiter.

## 6. Evidence behavior — implemented

Evidence accepts a confirmed Monad hash and wallet, performs at most three
index queries, and requests a report only after indexing. Known report failures
preserve indexed settlement and return `UNAVAILABLE`. Responses use no-store
cache headers; logs contain only operation, safe code, request ID, and status.

Because TRWA is not registered with Cleanverse, indexing and report support are
best-effort and may be unavailable. The application must not interpret report
availability as transfer validity.

## 7. Frontend integration — remaining

1. Add `@cleangraph/shared` and `@cleangraph/contracts` to the web package.
2. Load the public chain, explorer, and verified token address configuration.
3. Connect a Monad-compatible external wallet; do not construct one in shared
   helpers.
4. Validate and submit the strict preflight request.
5. Render normalized checks and failure states with request correlation.
6. On approval, read balance, simulate `transfer`, ask for signature, submit,
   and wait for a successful receipt.
7. On denial, prove no wallet signature method is invoked.
8. Render explorer and best-effort evidence/report states.

## 8. Live demo data — remaining

- Wallet A: active, unexpired, configured group/subgroup, allowed country
- Wallet B: active and otherwise matching, but country outside the allowlist
- Treasury: holds initial fixed supply and funds the transfer scenario

Create A-Passes through the trusted backend/client workflow. Store no raw
identity documents or bank data in repository fixtures or logs.

## 9. Verification strategy

Completed automated coverage includes:

- contract metadata, supply, treasury, zero address, normal/fuzz transfers,
  insufficient balance, and absent mint path;
- chain validation, amount precision/overflow, contract reads, simulation,
  receipt reverts, and explorer URLs;
- strict `tokenAddress`, local unsupported-token rejection, all sender and
  recipient policy denials, fail-fast order, request IDs, sanitized failures,
  environment parsing, evidence auth rename, and removed route `404`s.

Remaining live checks are deployment verification, an approved transfer, a
pre-signature denial, best-effort evidence, frontend end-to-end tests, secret
scanning, and production smoke tests.

## 10. Release sequence

1. Complete the deployment checkpoint and record public outputs.
2. Configure the verified address in deployment settings.
3. Implement frontend preflight and wallet settlement.
4. Implement evidence UI and end-to-end hardening.
5. Deploy the API and frontend, run smoke tests, and prepare the submission.

## 11. Main risks

- Application bypass: direct ERC-20 calls skip preflight. Keep the limitation
  explicit and never describe TRWA as transfer-restricted.
- A-Pass access: live demo data depends on valid Cleanverse credentials and
  correct group/subgroup values.
- Evidence support: an unregistered token may not be indexed or reportable.
- Secrets: deployer and operator tokens must remain backend-only and ignored.
- Network mismatch: deployment script and browser must validate the selected
  chain before sending transactions.
