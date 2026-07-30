

---

# Project Name: CleanGraph (Powered by Cleanverse)

**Tagline:**
The API-driven programmable compliance layer for Web3—combining Cleanverse A-Pass verified identity, A-Token verified assets, and programmable transfer rules for institutional RWA settlement.

## Confirmed Hackathon Scope and Source of Truth

* **Track:** Track 1 — Real-World Assets (RWA).
* **Network:** Monad, using the Cleanverse sandbox at `https://uatapi.cleanverse.com/api/cooperate`.
* **Frontend:** Vite, React, and TypeScript. Privy or a comparable wallet library will be selected after validation.
* **Backend:** Node.js and TypeScript. The framework will be selected during implementation planning.
* **Deployment:** Deferred until the application is ready. The intended targets are Vercel for the frontend and a private VPS for the backend.
* **Out of Scope:** Zero-knowledge proof implementation.
* **Technical Source:** Cleanverse Cooperate API v5.6, dated July 21, 2026.

The Cleanverse v5.6 A-Token rule model supports A-Pass tier, sub-tier, group, sub-group, and country allow/deny rules. It does not document native per-transaction or daily spending limits. If the MVP needs an amount limit, CleanGraph must enforce that additional policy in its middleware and label it as a CleanGraph rule.

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

1. **Identity Issuance (`POST /generate_apass`):** Creates an A-Pass record for a wallet. The encrypted request can include KYC references, identity-document country tags, tier metadata, and an expiration time.
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

Since the Cleanverse Build hackathon hacking period runs from August 8-9, here is the exact execution roadmap to build CleanGraph from registration to demo.

## Pre-Hackathon: Environment & Onboarding (Before Aug 8)


1. **Register & Claim API Keys:** Registration triggers an automated email with your Sandbox API keys. Keep these in your local `.env` file; never commit them to the repo.
2. **Confirm API Role:** Verify that the issued `api-id` has the Issue Member role required for A-Token launch and rule management.
3. **Prepare the Demo A-Token:** Submit `POST /atoken/launch` for Monad, wait for `ISSUED`, grant the documented `MINTER_ROLE`, and mint the demo supply. Contract ABI and role-grant instructions must be obtained from the Cleanverse contract materials.
4. **Prepare Demo A-Passes:** Use `POST /generate_apass` to create two Monad test profiles:
* **Wallet A (Eligible):** Active A-Pass with a country and tier that satisfy the A-Token rule.
* **Wallet B (Ineligible):** A-Pass attributes that intentionally fail either the country or tier rule selected by the team.



---

## 48-Hour Execution Roadmap

### Day 1: API Orchestration & Middleware (Backend)

The core of CleanGraph is a lightweight Node.js and TypeScript backend that sits between the Vite frontend and the Cleanverse Cooperate API v5.6.

1. **Initialize the Orchestration Endpoint:** POST /api/cleangraph/execute.
Create a single endpoint that accepts the transaction intent from the frontend. The payload should include the sender's wallet address, the receiver's wallet address, the A-Token address, and the transfer amount.


2. **Verify Both Counterparties:** `POST /verify_apass`.
Call the endpoint separately for the sender and receiver with `chain: "monad"` and the issued A-Token address. Continue only when both responses return top-level `code: "0000"` and `data.code: 4`. A non-eligible user is a policy denial, not an HTTP authentication error.


3. **Load the A-Token Rules:** `POST /atoken/rules`.
Retrieve and display the tier, group, and country rules bound to the asset. Cleanverse performs the authoritative eligibility check through `POST /verify_apass`.


4. **Enforce CleanGraph-Only Rules:**
If an amount limit is part of the demo, enforce it in the middleware and identify it as an application policy because v5.6 does not document transaction limits in the A-Token rule object.


5. **Return the Preflight Decision:**
Return a normalized decision, reason code, request ID, and per-check evidence. Do not treat HTTP 200 alone as approval; Cleanverse uses business codes inside successful HTTP responses.


### Day 2: Frontend Dashboard & Visualization (UI)

Hackathons are visual competitions. The judges cannot see backend API calls unless they are exposed clearly. Use Vite, React, TypeScript, and Tailwind CSS.

* **The UI Concept - "The Terminal":** Build a split-screen interface. The left side is a standard DeFi swap/transfer interface. The right side is a dark-mode "Compliance Terminal."
* **Live Event Logging:** When the user clicks "Transfer A-Token", run CleanGraph preflight before requesting the connected wallet signature.
* **Visualizing the API:** As your backend pings the Cleanverse API, stream the logs to the right-side terminal in real-time:
```json
[10:02:41] Intercepting TX: 50,000 $CG-RWA
[10:02:42] Cleanverse API -> /verify_apass (Sender: 0x...) -> ELIGIBLE (code 4)
[10:02:43] Cleanverse API -> /verify_apass (Receiver: 0x...) -> ELIGIBLE (code 4)
[10:02:44] Cleanverse API -> /atoken/rules -> OK (tier and country rules loaded)
[10:02:45] CleanGraph Engine -> ALL CLEAR. Requesting wallet signature.
[10:02:46] Monad -> A-Token transfer confirmed (0x...)
[10:02:47] Cleanverse API -> /download_travel_rule -> REPORT READY

```


* **The Failure State:** Switch the demo to Wallet B, whose A-Pass attributes do not satisfy the A-Token rule. Show the same flow, but stop before wallet signing and display the documented `verify_apass` result plus a normalized CleanGraph reason.

---

## The Pitch Strategy for Judges



1. **The Hook (30 seconds):** "Institutions want to trade tokenized RWAs on Monad, but current DeFi routing forces them to mix verified capital with radioactive liquidity. Cleanverse provides the primitives; CleanGraph provides the orchestration."
2. **The Demo (90 seconds):** Show the frontend. Complete the eligible A-Token transfer first, then show the ineligible wallet being blocked before signing. Emphasize the live terminal, Monad transaction, and downloadable report.
3. **The Extensibility (60 seconds):** Conclude by explaining that the same preflight interface can support future automated clients, including AI agents, after delegated identity and mandate requirements are defined.
