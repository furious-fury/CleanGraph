

---

# Project Name: CleanGraph (Powered by Cleanverse)

**Tagline:**
The API-driven programmable compliance layer for Web3—combining Cleanverse A-Pass verified identity, A-Token verified assets, and programmable transfer rules for institutional RWA settlement.

## Confirmed Hackathon Scope and Source of Truth

* **Track:** Track 1 — Real-World Assets (RWA).
* **Network:** Monad, using the Cleanverse sandbox at `https://uatapi.cleanverse.com/api/cooperate`.
* **Frontend:** Vite, React, and TypeScript. Privy or a comparable wallet library will be selected after validation.
* **Backend:** Node.js, TypeScript, and Hono.
* **Deployment:** Deferred until the application is ready. The intended targets are Vercel for the frontend and a private VPS for the backend.
* **Out of Scope:** Zero-knowledge proof implementation.
* **Technical Source:** Cleanverse Cooperate API v5.6, dated July 21, 2026.

The Cleanverse v5.6 A-Token rule model supports A-Pass tier, sub-tier, group, sub-group, and country allow/deny rules. It does not document native per-transaction or daily spending limits. The CleanGraph MVP will not add an application-level amount cap.

### Confirmed MVP Asset and Policy

* **Underlying asset:** A demo beneficial interest in a fictional portfolio of short-term United States Treasury bills. It is not a real security or claim on actual Treasury assets.
* **Token:** `Tokenized Real-World Asset` (`TRWA`), displayed as `$TRWA`, with 18 decimals and a demo supply of `1,000,000 TRWA`.
* **Customer:** Regulated traditional-finance institutions, represented in the product by RWA issuer, treasury, and compliance operators.
* **Investor mapping:** A-Pass group `Institutional Investor` and subgroup `Accredited Investor`. Exact Cleanverse sandbox identifiers must be confirmed before issuance.
* **Country policy:** Allowlist `US`, `GB`, `DE`, and `SG`.
* **Wallet A:** Active and unexpired, with the required investor mapping and country `GB`.
* **Wallet B:** Active and unexpired, with the same investor mapping and country `BR`; it fails only the country rule.
* **Amount policy:** No additional CleanGraph per-transfer, daily, or cumulative cap.

These labels and country choices are demo configuration, not legal advice, a sanctions list, or a production accreditation determination.

### Current Repository Status

The backend foundation is implemented: secure Cleanverse transport, encrypted
A-Pass and A-Token writes, compliance reads, A-Token application polling, and
the Hono preflight route. The frontend has the responsive transfer and
compliance-terminal shell but is not connected to a wallet, the API, or Monad.

The remaining MVP is the live system around that foundation:

1. confirm external Cleanverse and Monad contract prerequisites;
2. expose protected asset lifecycle and transaction-evidence routes;
3. add bounded transaction-index polling in the evidence service;
4. implement the Monad contracts package;
5. provision both A-Passes and the issued/minted `TRWA` token;
6. connect preflight, terminal rendering, wallet signing, and settlement in the
   frontend;
7. test both live demo paths; and
8. deploy and prepare the submission.

### The Problem: "Dirty" Liquidity and Rigid Compliance

Institutional capital wants to enter Web3, but it is entirely bottlenecked by current infrastructure. Traditional DeFi mixes verified and unverified funds ("radioactive liquidity"), making it impossible for institutions to participate without massive compliance risks.

Furthermore, current Web3 compliance relies on binary, static KYC—a wallet is either "in" or "out." This model fails to support cross-border routing, dynamic jurisdictional rules, and the incoming wave of autonomous AI trading agents. Institutions need a way to ensure that clean assets only ever interact with clean wallets, without slowing down execution speeds.

## The Solution: The CleanGraph Orchestration Engine

CleanGraph transforms static compliance into a high-speed, API-driven permissions layer utilizing Cleanverse primitives. Rather than building risky custom smart contracts, CleanGraph acts as an orchestration middleware.

When a transaction is initiated, CleanGraph queries Cleanverse APIs to compute: *"Does this wallet's A-Pass satisfy the rules of this A-Token right now?"*

It chains Cleanverse endpoints together into a single authorization pipeline, outputting a simple boolean (True/False) that dictates whether a transaction is permitted to execute, ensuring an isolated, institutional-grade environment.

###  Key Features & Use Cases

* **Institutional RWA Transfers:** Before an A-Token transfer, CleanGraph calls `POST /verify_apass` for the sender and receiver. A verification result of `data.code: 4` means the wallet has a valid A-Pass and is allowed to transfer the specified A-Token.
* **Programmable Asset Eligibility:** CleanGraph reads the issued asset's tier, group, and country rules with `POST /atoken/rules` and displays the rule evaluation to the operator.
* **Audit-Ready Settlement:** After an approved on-chain transfer, CleanGraph queries the indexed transaction with `POST /query_txs` and requests a time-limited transaction or Travel Rule report with `POST /download_travel_rule`.
* **Future AI-Agent Mandates:** Delegated AI-agent spending policies remain a future extension. They are not part of the v5.6 API-backed MVP.

###  How It Works (API Architecture)

CleanGraph uses the documented Cleanverse v5.6 lifecycle:

1. **Identity Issuance (`POST /generate_apass`):** Creates an A-Pass record for a wallet. The encrypted request can include KYC references, identity-document country tags, optional sub-tier/subgroup metadata, and an expiration time. Cleanverse assigns the returned tier; this endpoint does not accept a tier or group.
2. **RWA Issuance (`POST /atoken/launch`):** Submits a new A-Token application with its initial tier, group, and country compliance rule. CleanGraph polls `GET /atoken/query_apply_status/{requestId}` until the asset reaches `ISSUED`.
3. **Pre-Transfer Verification (`POST /verify_apass`):** Checks each counterparty against the specified A-Token. `data.code: 4` is the documented approval result.
4. **On-Chain Settlement:** The connected wallet signs and broadcasts the A-Token transfer on Monad. A-Token rules provide on-chain transfer enforcement.
5. **Audit Evidence (`POST /query_txs` and `POST /download_travel_rule`):** Retrieves the indexed transfer and a time-limited report download URL.

###  The Vision

CleanGraph is an orchestration layer for tokenized capital. By combining Cleanverse A-Pass identity with A-Token transfer rules, the hackathon project demonstrates an integration pattern that RWA issuers, fintechs, and dApps can evaluate and extend.

---
---

# Project Architecture: CleanGraph Engine

**Tagline:** An API-driven compliance orchestration layer connecting Cleanverse A-Pass identity, A-Token rules, and Monad settlement.

```
                  +--------------------------------------------------+
                  |               USER / CLIENT TIER                 |
                  | (Web App / Mobile Wallet / Autonomous AI Agent)  |
                  +------------------------+-------------------------+
                                           |
                                 1. Initiates Action
                                           |
                                           v
                  +--------------------------------------------------+
                  |               CLEANGRAPH ENGINE                  |
                  |          (API Middleware / Orchestrator)          |
                  +----+-------------------+--------------------+----+
                       |                   |                    |
       2. POST /verify_apass               |          3. POST /atoken/rules
                       |                   |                    |
                       v                   |                    v
         +---------------------------+     |      +---------------------------+
         |   CLEANVERSE A-PASS API   |     |      |   CLEANVERSE A-TOKEN API  |
         |  - Active / Frozen        |     |      |  - Issued A-Token         |
         |  - Tier & Group           |     |      |  - Country Rules          |
         |  - Country Tags           |     |      |  - Tier & Group Rules     |
         +---------------------------+     |      +---------------------------+
                                           |
                              4. A-Token Transfer
                           (On-Chain Rule Enforcement)
                                           |
                                           v
                         +-----------------------------------+
                         |        MONAD SETTLEMENT            |
                         |   - Connected Wallet Signature    |
                         |   - A-Token Transfer Rules        |
                         |   - Transaction Confirmation      |
                         +-----------------+-----------------+
                                           |
                                5. Transaction Approved
                                           |
                                           v
                         +-----------------------------------+
                         |        EXECUTION & RECEIPT        |
                         |  - On-Chain Settlement (Monad)    |
                         |  - POST /download_travel_rule     |
                         |  - Exportable Audit-Ready Logs    |
                         +-----------------------------------+

```

---

## System Architecture Blueprint

### 1. Client Tier (The Originators)

* **Entities:** RWA issuer operators, institutional treasuries, and connected investor wallets.
* **Role:** Initiates value transfers, collateral deposits, or micro-payments without needing to handle raw compliance logic on the frontend.

### 2. CleanGraph Middleware (Orchestration Layer)

Your core hackathon project—an API gateway that chains Cleanverse endpoints together into a single, high-speed authorization pipeline. Instead of a binary "Yes/No," it continuously computes:


$$\text{Permission} = f(\text{A-Pass attributes}, \text{A-Token rules}, \text{Transaction context})$$

### 3. Cleanverse Core API Integration

* **`POST /query_apass` (Identity Details):** Returns A-Pass status, expiration, tier, group, KYC hash, and country tags.
* **`POST /verify_apass` (Asset-Specific Eligibility):** Returns whether a wallet may receive or transfer a specified A-Token.
* **`POST /atoken/rules` (Asset Rules):** Returns the A-Token's tier, group, and country compliance rules.
* **`POST /query_txs` (Transaction Index):** Returns indexed A-Token transfer records for a wallet.

### 4. Settlement & Audit Tier

* **Execution:** Settlement occurs on high-throughput execution rails (such as Monad).
* **`POST /download_travel_rule`:** Returns a time-limited download URL and report filename for supported A-Token transfers or withdrawals.

---

## System Flow: Step-by-Step API Sequence

```
Client               CleanGraph Middleware            Cleanverse APIs            Blockchain
  |                            |                             |                       |
  |--- 1. Initiate Transfer -->|                             |                       |
  |    (Amount, Recipient)     |                             |                       |
  |                            |--- 2. POST /verify_apass -->|                       |
  |                            |<-- Sender Eligibility ------|                       |
  |                            |                             |                       |
  |                            |--- 3. POST /verify_apass -->|                       |
  |                            |<-- Receiver Eligibility ----|                       |
  |                            |                             |                       |
  |                            |--- 4. POST /atoken/rules -->|                       |
  |                            |<-- Display Asset Rules -----|                       |
  |                            |                             |                       |
  |                            |---------------- 5. Execute Settlement ------------->|
  |                            |                             |                       |
  |                            |--- 6. POST /query_txs ------>|                       |
  |                            |--- 7. POST /download_travel_rule ------------------->|
  |<-- 8. Confirmation + Report Download URL ----------------|                       |

```

---

## 3 Core Hackathon Use Cases Powered by this Architecture

### 1. AI Agent Financial Mandates

* **MVP status:** Future extension. The v5.6 API document does not define a delegated sub-A-Pass or agent mandate endpoint, so the hackathon MVP will not claim this as implemented.

### 2. Cross-Border Micro-Payments & Tax Routing

* **How it works via API:** A future payment flow can check A-Pass and country eligibility with `POST /verify_apass`, settle a supported A-Token, then request an eligible transaction or Travel Rule report with `POST /download_travel_rule`.

### 3. Institutional Gated Liquidity Pools

* **How it works via API:** Before a wallet interacts with a registered pool, CleanGraph can use `POST /validator/verify` to check the wallet against the pool's A-Pass tier, group, and country rules.

---
## Integration Plan

The workspace, Cleanverse client, preflight orchestration, and frontend shell
are complete. The remaining work should be delivered as small PRs in this
order:

1. Cleanverse transaction evidence client (implemented in the current PR)
2. Protected asset lifecycle API
3. Monad contract foundation
4. Transaction evidence API
5. Frontend preflight and ordered terminal
6. Frontend wallet settlement
7. Evidence UI and end-to-end hardening
8. Deployment and submission

Live A-Pass and A-Token provisioning occurs after the external identifiers,
ABI, network values, and admin wallet are confirmed.

## External Access and Demo Preparation


1. **Register & Claim API Keys:** Registration triggers an automated email with your Sandbox API keys. Keep these in your local `.env` file; never commit them to the repo.
2. **Confirm API Role:** Verify that the issued `api-id` has the Issue Member role required for A-Token launch and rule management.
3. **Prepare the Demo A-Token:** Submit `POST /atoken/launch` for Monad, wait for `ISSUED`, grant the documented `MINTER_ROLE`, and mint the demo supply. Contract ABI and role-grant instructions must be obtained from the Cleanverse contract materials.
4. **Prepare Demo A-Passes:** Use `POST /generate_apass` to create two Monad test profiles:
* **Wallet A (Eligible):** Active, unexpired A-Pass with the required investor mapping and country `GB`.
* **Wallet B (Ineligible):** Active, unexpired A-Pass with the same investor mapping and country `BR`, which is outside the A-Token allowlist.



---

## Remaining Execution Roadmap

### Backend

The core Hono preflight endpoint already accepts a transaction intent, verifies
both counterparties, loads the A-Token rules, and returns an ordered decision.
The remaining backend work is:

1. **Use the transaction evidence methods:** `queryTransactions` and
   `downloadTravelRuleReport` are implemented in the client. Add bounded
   index-delay handling in the future Hono evidence service.

2. **Expose asset lifecycle routes:** Add protected launch and application
   status endpoints backed by the implemented Cleanverse client.

3. **Add the transaction evidence route:** Accept a confirmed hash and return
   normalized indexed/report states.

4. **Build Monad helpers:** Add the supplied ABI, network configuration,
   decimal conversion, balance reads, transfer preparation, receipt waiting,
   and explorer links.

5. **Harden the API:** Protect operator-only routes, add rate limiting, and
   preserve the existing redaction and request-correlation guarantees.

The implemented preflight route is
`POST /api/v1/compliance/preflight`; there is no
`POST /api/cleangraph/execute` route.

### Frontend

Hackathons are visual competitions. The judges cannot see backend API calls unless they are exposed clearly. Use Vite, React, TypeScript, and Tailwind CSS.

* **The UI Concept - "The Terminal":** Build a split-screen interface. The left side is a standard DeFi swap/transfer interface. The right side is a dark-mode "Compliance Terminal."
* **Live Event Logging:** When the user clicks "Transfer A-Token", run CleanGraph preflight before requesting the connected wallet signature.
* **Visualizing the API:** Render the ordered checks returned by preflight in the right-side terminal:
```json
[10:02:41] Intercepting TX: 50,000 $TRWA
[10:02:42] Cleanverse API -> /verify_apass (Sender: 0x...) -> ELIGIBLE (code 4)
[10:02:43] Cleanverse API -> /verify_apass (Receiver: 0x...) -> ELIGIBLE (code 4)
[10:02:44] Cleanverse API -> /atoken/rules -> OK (tier and country rules loaded)
[10:02:45] CleanGraph Engine -> ALL CLEAR. Requesting wallet signature.
[10:02:46] Monad -> A-Token transfer confirmed (0x...)
[10:02:47] Cleanverse API -> /download_travel_rule -> REPORT READY

```


* **The Failure State:** Switch the recipient to Wallet B. Its active A-Pass has the required investor mapping but country `BR`, which is outside the `US`/`GB`/`DE`/`SG` allowlist. Show the same flow, but stop before wallet signing and display the documented `verify_apass` result. Explain the configured country difference as demo setup; do not claim that result code `3` exposes a country-specific upstream reason.

---

## The Pitch Strategy for Judges



1. **The Hook (30 seconds):** "Institutions want to trade tokenized RWAs on Monad, but current DeFi routing forces them to mix verified capital with radioactive liquidity. Cleanverse provides the primitives; CleanGraph provides the orchestration."
2. **The Demo (90 seconds):** Show the frontend. Complete the eligible A-Token transfer first, then show the ineligible wallet being blocked before signing. Emphasize the live terminal, Monad transaction, and downloadable report.
3. **The Extensibility (60 seconds):** Conclude by explaining that the same preflight interface can support future automated clients, including AI agents, after delegated identity and mandate requirements are defined.
