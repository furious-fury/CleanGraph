# CleanGraph Task List

**Status:** Active v0.3
**Rule:** Complete sections in order unless a task is explicitly marked as
parallel-safe.
**Last reconciled with code:** August 3, 2026

## Remaining MVP Critical Path

This summary is the build order. The detailed acceptance tasks remain in the
numbered sections below.

1. [ ] Resolve Cleanverse group codes and Monad network values.
2. [x] Add protected asset-lifecycle and transaction-evidence API routes.
3. [x] Initialize the contracts package and implement Monad balance, transfer,
   receipt, and explorer helpers.
4. [ ] Review, deploy, and verify the fixed-supply `TRWA` contract on Monad
   testnet, then provision Wallet A and Wallet B A-Passes.
5. [ ] Connect the frontend to shared contracts and the preflight API, then
   render the ordered compliance terminal.
6. [ ] Connect a Monad wallet and complete the approved transfer flow while
   proving the denied flow stops before signing.
7. [ ] Complete transaction-evidence orchestration, end-to-end tests, secret
   scanning, and demo hardening.
8. [ ] Deploy to the VPS and Vercel, run production smoke tests, and finish the
   submission package.

## 0. Product Decisions and External Access

1. [x] Define the RWA as a demo interest in a fictional short-term United
   States Treasury-bill portfolio.
2. [x] Define regulated traditional-finance institutions as the primary
   customer.
3. [x] Choose `Tokenized Real-World Asset`, symbol `TRWA`, 18 decimals, and a
   `1,000,000 TRWA` demo supply.
4. [x] Map accreditation logically to group `Institutional Investor` and
   subgroup `Accredited Investor`.
5. [x] Choose the country allowlist: `US`, `GB`, `DE`, and `SG`.
6. [x] Define Wallet A as active, unexpired, correctly grouped, and tagged
   with country `GB`.
7. [x] Define Wallet B with the same valid investor attributes and country
   `BR`, so only the country rule fails.
8. [x] Exclude a CleanGraph per-transfer amount limit from the MVP.
9. [ ] Decide whether to include clearly labelled deterministic demo mode.
10. [x] Record the ownership split: project lead handles backend work and the
    project partner handles frontend work.
11. [ ] Confirm the sandbox IDs for the `Institutional Investor` and
    `Accredited Investor` mapping.
12. [ ] Confirm the Cleanverse API ID has Issue Member permissions.
13. [x] Replace the official A-Token path with a self-deployed demo ERC-20.
14. [x] Remove mint-role requirements by fixing supply in the constructor.
15. [ ] Confirm the Monad sandbox chain ID, RPC URL, and explorer URL.

## 1. Workspace Foundation

1. [x] Choose pnpm as the package manager.
2. [x] Configure the root workspace.
3. [x] Initialize `apps/web` with Vite, React, and TypeScript.
4. [x] Initialize `apps/api` with Node.js and TypeScript.
5. [x] Select and configure Hono.
6. [x] Initialize `packages/shared`.
7. [x] Initialize `packages/cleanverse-client`.
8. [x] Initialize `packages/contracts`.
9. [x] Add TypeScript workspace aliases for the frontend.
10. [x] Configure Oxlint for the frontend.
11. [x] Configure Foundry formatting for contracts.
12. [x] Configure the test runner.
13. [x] Add root type-check, lint, and build scripts.
14. [ ] Add secret-scanning checks.
15. [x] Verify `.env` files and private keys are ignored.

## 2. Shared Types and Configuration

1. [x] Define environment-variable schemas.
2. [x] Define EVM address and transaction-intent schemas.
3. [x] Define CleanGraph decision and check schemas.
4. [x] Define normalized denial codes.
5. [ ] Define compliance-terminal event types.
6. [x] Define A-Token application states.
7. [x] Define transaction-evidence states.
8. [x] Export shared types for the web and API apps.
9. [x] Add schema validation tests.

## 3. Cleanverse Client Foundation

1. [x] Configure the sandbox base URL.
2. [x] Add the `api-id` header.
3. [x] Generate a UUID `X-Request-ID` for each operation.
4. [x] Decode the Base64 API key only on the backend.
5. [x] Implement AES/CBC encryption with a 16-byte zero IV.
6. [x] Encode protected payloads as `{ "data": "<ciphertext>" }`.
7. [x] Add request timeout handling.
8. [x] Parse the Cleanverse response envelope.
9. [x] Separate HTTP failures from Cleanverse business failures.
10. [x] Redact secrets and sensitive values from errors and logs.
11. [x] Add known-vector encryption tests.
12. [x] Add response-envelope tests.

## 4. Cleanverse Read Endpoints

1. [x] Implement `queryAPass`.
2. [x] Implement `queryATokenRules`.
3. [x] Implement `verifyAPassForToken`.
4. [x] Map verification code `1` to `ATOKEN_NOT_FOUND`.
5. [x] Map verification code `2` to `APASS_MISSING`.
6. [x] Map verification code `3` to `APASS_NOT_ELIGIBLE`.
7. [x] Map verification code `4` to `ELIGIBLE`.
8. [x] Implement `queryTransactions`.
9. [x] Implement `downloadTravelRuleReport`.
10. [x] Add sanitized fixtures for every implemented read-result state.
11. [x] Test all implemented read methods with mocked v5.6 responses.
12. [x] Run a sandbox read-endpoint smoke test.

## 5. A-Pass Setup Flow

1. [x] Implement the encrypted `generateAPass` client method.
2. [x] Validate 12-character alphanumeric customer IDs.
3. [x] Validate Monad wallet addresses.
4. [x] Validate expiration timestamps.
5. [x] Validate ISO country codes.
6. [x] Avoid storing raw identity and bank data in application logs.
7. [ ] Create Wallet A's sandbox A-Pass.
8. [ ] Confirm Wallet A is active with `queryAPass`.
9. [ ] Create Wallet B's sandbox A-Pass.
10. [ ] Confirm Wallet B has the intended ineligible attributes.
11. [ ] Record only safe record IDs, addresses, and transaction hashes.

## 6. A-Token Issuance Flow

1. [x] Implement the encrypted `launchAToken` client method.
2. [x] Validate token metadata and admin address.
3. [x] Build the initial tier/group/country rule.
4. [x] Implement `queryATokenApplication`.
5. [x] Add bounded polling for application status.
6. [x] Treat only `ISSUED` as success.
7. [x] Normalize rejection and issuance-failure reasons safely in the client.
8. [ ] Display normalized rejection and issuance-failure reasons in the
   operator UI.
9. [ ] Submit the Monad A-Token launch request.
10. [ ] Wait for the application to reach `ISSUED`.
11. [ ] Record the issued A-Token address and transaction hash.
12. [ ] Load and verify the on-chain A-Token rule.
13. [ ] Grant `MINTER_ROLE` using the supplied contract instructions.
14. [ ] Mint the demo supply.
15. [ ] Verify Wallet A's A-Token balance.

## 7. Orchestration API

1. [x] Implement `GET /health`.
2. [x] Implement request validation for transaction intents.
3. [x] Implement `POST /api/v1/compliance/preflight`.
4. [x] Verify the sender against the selected A-Token.
5. [x] Verify the recipient against the selected A-Token.
6. [x] Load A-Token rules for display evidence.
7. [x] Confirm that preflight has no application-level amount-limit check.
8. [x] Build the ordered check result.
9. [x] Return approval only when every required check passes.
10. [x] Implement `POST /api/v1/assets/launch`.
11. [x] Restrict the asset-launch route to the demo operator.
12. [x] Implement `GET /api/v1/assets/applications/:requestId`.
13. [x] Implement `POST /api/v1/transactions/evidence`.
14. [x] Add structured, redacted logging.
15. [x] Configure rate limits.
16. [x] Configure restricted single-origin CORS from `API_CORS_ORIGIN`.
17. [x] Test policy denial separately from API failure.

## 8. Monad Contract Integration

1. [x] Add validated caller-supplied Monad network construction.
2. [x] Add the minimal verified TRWA ABI.
3. [x] Add fixed TRWA metadata and supply constants.
4. [x] Implement TRWA balance and metadata reads.
5. [x] Implement decimal-safe amount parsing and formatting.
6. [x] Implement TRWA transfer simulation with an external wallet account.
7. [ ] Implement the wallet-signed transfer.
8. [x] Implement receipt confirmation with explicit revert handling.
9. [x] Implement Monad explorer address and transaction links.
10. [ ] Test an eligible transfer.
11. [ ] Confirm an ineligible transfer is blocked before signing.

## 9. Wallet Integration

1. [ ] Validate Privy support for Monad.
2. [ ] Compare an alternative if Privy cannot support the required flow.
3. [ ] Configure the selected wallet provider.
4. [ ] Implement connect and disconnect.
5. [ ] Display the connected address.
6. [ ] Detect the active chain.
7. [ ] Prompt the user to switch to Monad.
8. [ ] Disable transfer actions on the wrong chain.
9. [ ] Test connection restoration.
10. [ ] Test rejected signature handling.

## 10. Frontend Transfer Experience

1. [x] Build the application shell and responsive split layout.
2. [x] Build the initial asset summary.
3. [x] Build the recipient field.
4. [x] Build the amount field.
5. [ ] Add client-side validation.
6. [ ] Add Wallet A and Wallet B demo selectors.
7. [ ] Connect the form to the preflight API.
8. [ ] Prevent duplicate submission.
9. [ ] Request a signature only after approval.
10. [ ] Show transaction pending state.
11. [ ] Show transaction confirmation.
12. [ ] Show transaction failure safely.

## 11. Compliance Terminal

1. [x] Choose one ordered preflight response; defer Server-Sent Events.
2. [ ] Define terminal event labels.
3. [ ] Build pending event styling.
4. [ ] Build approved event styling.
5. [ ] Build denied event styling.
6. [ ] Build infrastructure-error styling.
7. [ ] Show timestamps and request correlation IDs.
8. [ ] Show safe Cleanverse result codes.
9. [ ] Hide credentials, ciphertext, and sensitive identity data.
10. [ ] Test the complete eligible sequence.
11. [ ] Test the complete denied sequence.

## 12. Transaction Evidence and Reports

1. [x] Query the confirmed transaction by hash.
2. [x] Handle indexer delay with bounded polling.
3. [x] Request the transaction or Travel Rule report.
4. [ ] Display the returned filename.
5. [ ] Display the time-limited download link.
6. [ ] Explain that the download link expires.
7. [x] Keep settlement confirmed if report generation is delayed.
8. [ ] Test indexed, delayed, unsupported, and failed report states.

## 13. Deterministic Demo Mode

Complete this section only if the team approves demo mode.

1. [ ] Create sanitized success fixtures.
2. [ ] Create sanitized denial fixtures.
3. [ ] Create sanitized report-pending fixtures.
4. [ ] Add a backend-only demo-mode flag.
5. [ ] Display a persistent “Demo Data” label when enabled.
6. [ ] Prevent fixture responses from being presented as live API responses.
7. [ ] Test that production configuration disables demo mode.

## 14. Quality Verification

The foundation currently passes type-check, lint, unit/contract tests, and
build. Keep the final gates below unchecked until the complete MVP is tested.

1. [ ] Run formatting checks.
2. [ ] Run lint checks.
3. [ ] Run type checks.
4. [ ] Run unit tests.
5. [ ] Run Cleanverse client contract tests.
6. [ ] Run frontend component tests.
7. [ ] Run eligible-transfer end-to-end tests.
8. [ ] Run denied-transfer end-to-end tests.
9. [ ] Scan the repository for secrets.
10. [ ] Test with the real Cleanverse sandbox.
11. [ ] Test the real Monad transaction.
12. [ ] Review all UI and pitch claims against v5.6.

## 15. Deployment

Complete this section after implementation and verification.

1. [ ] Prepare the VPS runtime.
2. [ ] Configure backend environment variables on the VPS.
3. [ ] Configure HTTPS and the API domain.
4. [ ] Deploy the API.
5. [ ] Verify `GET /health`.
6. [ ] Configure restricted production CORS.
7. [ ] Configure the Vercel project.
8. [ ] Add public frontend environment variables.
9. [ ] Deploy the frontend.
10. [ ] Run the live eligible-transfer smoke test.
11. [ ] Run the live denied-transfer smoke test.
12. [ ] Verify explorer and report links.

## 16. Submission

1. [ ] Confirm the repository is public.
2. [ ] Confirm implementation commits fall within the required UTC window.
3. [ ] Write the one-page summary.
4. [ ] List CVI/A-Pass and CVA/A-Token integration points.
5. [ ] List Monad as the deployed chain.
6. [ ] Record the successful demo.
7. [ ] Record the denied demo.
8. [ ] Show the compliance terminal and report.
9. [ ] Publish the demo video.
10. [ ] Add the live URL and contract addresses to the README.
11. [ ] Perform a final secret scan.
12. [ ] Send the submission before August 9, 23:59 UTC.
