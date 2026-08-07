# CleanGraph Task List

**Status:** Active self-deployed TRWA MVP

**Last reconciled with code:** August 7, 2026

## Critical path

1. [x] Implement and test the fixed-supply TRWA contract package.
2. [x] Review and merge the contract PR.
3. [ ] Deploy and verify TRWA on Monad testnet.
4. [x] Refactor backend preflight to Cleanverse A-Pass reads plus local policy.
5. [x] Merge the backend preflight PR.
6. [ ] Provision Wallet A and Wallet B A-Passes.
7. [ ] Integrate frontend preflight, wallet signing, and receipt confirmation.
8. [ ] Run live approved and pre-signature-denied journeys.
9. [ ] Finish evidence UI, deployment, smoke tests, and submission.

## 1. Product and policy decisions

1. [x] Choose `Tokenized Real-World Asset`, `TRWA`, and 18 decimals.
2. [x] Fix supply at `1,000,000 TRWA` in the constructor.
3. [x] Mint the full initial supply to a nonzero deployment treasury.
4. [x] Define TRWA as a self-deployed hackathon ERC-20, not an official
   Cleanverse A-Token.
5. [x] Define compliance as application-level only.
6. [x] Document that direct ERC-20 transfers can bypass preflight.
7. [x] Choose local group `Institutional Investor`.
8. [x] Choose local subgroup `Accredited Investor`.
9. [x] Choose country allowlist `US`, `GB`, `DE`, and `SG`.
10. [x] Exclude tier, sub-tier, and transfer amount policy from the MVP.
11. [x] Define Wallet A with allowed country `GB`.
12. [x] Define Wallet B with denied country `BR`.
13. [ ] Confirm live Cleanverse group and subgroup values.
14. [ ] Confirm final Monad testnet RPC, chain ID, and explorer.

## 2. Contract package

1. [x] Initialize `packages/contracts` as Foundry and pnpm package.
2. [x] Pin OpenZeppelin Contracts and Solidity.
3. [x] Implement the fixed-supply TRWA constructor.
4. [x] Reject a zero treasury.
5. [x] Exclude mint, owner, pause, allowlist, upgrade, and admin paths.
6. [x] Add metadata and exact-supply tests.
7. [x] Add treasury allocation and zero-treasury tests.
8. [x] Add normal and fuzz transfer tests.
9. [x] Add insufficient-balance and zero-recipient tests.
10. [x] Test that no callable mint path exists.
11. [x] Add guarded Foundry deployment script.
12. [x] Read deployer key, treasury, chain ID, and RPC configuration.
13. [x] Validate the connected chain before deployment.
14. [x] Add contract checks to root workspace gates.

## 3. TypeScript contract helpers

1. [x] Export a minimal verified TRWA ABI.
2. [x] Export name, symbol, decimals, and fixed supply.
3. [x] Validate caller-supplied Monad chain, HTTPS RPC, and explorer values.
4. [x] Parse and format TRWA amounts without floating point.
5. [x] Reject zero, excessive precision, malformed values, and uint256 overflow.
6. [x] Read token balance and metadata.
7. [x] Simulate transfer using an external wallet account.
8. [x] Wait for receipts and throw explicitly on revert.
9. [x] Generate validated explorer address and transaction URLs.
10. [x] Confirm helpers never read a private key or create a wallet.
11. [x] Add focused viem helper tests.

## 4. Deployment checkpoint

Warning: complete only after contract review. Never commit the deployer key,
seed, funded environment file, or operator token.

1. [ ] Install Foundry permanently and confirm `forge`, `cast`, and `anvil`.
2. [ ] Fund a controlled deployer with Monad testnet MON.
3. [ ] Run `forge fmt --check`, `forge build`, and `forge test`.
4. [ ] Run the deployment script without `--broadcast`.
5. [ ] Confirm the simulation uses the intended chain and treasury.
6. [ ] Broadcast exactly once.
7. [ ] Confirm contract bytecode exists.
8. [ ] Confirm name, symbol, and 18 decimals.
9. [ ] Confirm total supply is `1,000,000 × 10^18`.
10. [ ] Confirm the treasury owns the initial supply.
11. [ ] Perform one small test transfer.
12. [ ] Verify source on the selected explorer when supported.
13. [ ] Record public address, deployment transaction, chain ID, and links.

## 5. Backend configuration

1. [x] Add `TRWA_TOKEN_ADDRESS`.
2. [x] Add exact `TRWA_ALLOWED_GROUP` and `TRWA_ALLOWED_SUBGROUP`.
3. [x] Parse `TRWA_ALLOWED_COUNTRIES` as unique uppercase comma-separated codes.
4. [x] Require all four policy values together.
5. [x] Leave preflight safely unavailable when all policy values are absent.
6. [x] Reject partial or malformed policy configuration.
7. [x] Replace `ASSET_OPERATOR_TOKEN` with `OPERATOR_TOKEN`.
8. [x] Keep `OPERATOR_TOKEN` backend-only.
9. [ ] Configure the verified testnet address in the deployed API.

## 6. Preflight orchestration

1. [x] Rename request field to `tokenAddress`.
2. [x] Reject `atokenAddress` and unknown request properties.
3. [x] Reject unsupported token addresses before Cleanverse calls.
4. [x] Query sender with `queryAPass` and the incoming request ID.
5. [x] Deny and stop when sender fails.
6. [x] Query recipient only after sender passes.
7. [x] Require `ACTIVE` status.
8. [x] Require expiration strictly after current Unix time.
9. [x] Require exact group and subgroup matches.
10. [x] Require at least one allowed country.
11. [x] Avoid tier, sub-tier, and amount-limit policy.
12. [x] Return sender/recipient inactive, expired, and policy-mismatch codes.
13. [x] Return a CleanGraph-owned local asset policy success check.
14. [x] Preserve only sanitized completed checks on infrastructure failure.
15. [x] Preserve request IDs across both A-Pass calls.

## 7. Removed official A-Token API path

1. [x] Remove Hono asset launch route.
2. [x] Remove Hono application-status route.
3. [x] Remove the asset lifecycle service and route tests.
4. [x] Remove public asset lifecycle schemas and tests.
5. [x] Return `404` for removed route paths.
6. [x] Retain tested low-level A-Token client methods as optional functionality.
7. [x] Remove documentation claims that Cleanverse deploys, registers, mints,
   or enforces TRWA.

## 8. Evidence API

1. [x] Protect evidence with `OPERATOR_TOKEN`.
2. [x] Authenticate before rate limiting.
3. [x] Limit to 20 authenticated requests per 60 seconds.
4. [x] Exclude unauthorized requests from the count.
5. [x] Poll transaction index at most three times.
6. [x] Request reports only after indexed evidence.
7. [x] Preserve indexed evidence on known report failures.
8. [x] Set `Cache-Control: no-store`.
9. [x] Redact transaction inputs, report URLs, filenames, and upstream messages.
10. [x] Document unregistered TRWA indexing/report support as best-effort.
11. [ ] Verify live index and report behavior after a testnet transfer.

## 9. Frontend and wallet work

1. [ ] Add shared and contracts workspace dependencies to the web app.
2. [ ] Configure public Monad chain, explorer, and TRWA address.
3. [ ] Connect and restore a Monad-compatible wallet session.
4. [ ] Detect and switch the active chain.
5. [ ] Validate recipient and decimal amount.
6. [ ] Submit strict preflight using `tokenAddress`.
7. [ ] Render normalized checks and request ID.
8. [ ] Ensure denial never invokes a wallet signature request.
9. [ ] Read balance and simulate transfer after approval.
10. [ ] Request the external wallet signature and broadcast.
11. [ ] Render pending, confirmed, reverted, and rejected-signature states.
12. [ ] Link the confirmed transaction to the explorer.
13. [ ] Render evidence pending/indexed and report available/unavailable states.
14. [ ] Warn that report URLs expire.

## 10. Live demo preparation

1. [ ] Create or confirm Wallet A A-Pass.
2. [ ] Confirm Wallet A is active, unexpired, and policy matching.
3. [ ] Create or confirm Wallet B A-Pass.
4. [ ] Confirm Wallet B fails only the intended country policy.
5. [ ] Fund the sender wallet with MON for gas when needed.
6. [ ] Transfer demo TRWA from the treasury to the intended sender if needed.
7. [ ] Record only safe public identifiers.

## 11. Quality and security

1. [x] Run contract formatting, build, and tests for the contract PR.
2. [x] Run repository lint, type-check, tests, and build for the contract PR.
3. [ ] Run all gates after final documentation changes and Foundry installation.
4. [ ] Add frontend component and end-to-end tests.
5. [ ] Run approved-transfer end-to-end test.
6. [ ] Run denied-before-signature end-to-end test.
7. [ ] Scan the repository and deployment configuration for secrets.
8. [ ] Review logs for identity, wallet, hash, and report URL leakage.
9. [ ] Review every demo and pitch claim for the application-level limitation.

## 12. Deployment and submission

1. [ ] Deploy the API with backend-only Cleanverse, policy, and operator values.
2. [ ] Restrict production CORS to the deployed frontend.
3. [ ] Deploy the frontend with public Monad and API values only.
4. [ ] Verify `/health`, `/ready`, preflight, and evidence behavior.
5. [ ] Run live approved and denied smoke tests.
6. [ ] Add the public TRWA address and explorer links to the README.
7. [ ] Record the successful and denied demo journeys.
8. [ ] Prepare the one-page summary and demo video.
9. [ ] Perform the final secret scan.
10. [ ] Submit before the hackathon deadline.
