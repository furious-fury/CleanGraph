# CleanGraph Product Requirements

**Status:** Hackathon MVP

**Last updated:** August 3, 2026

## 1. Product definition

CleanGraph demonstrates an application-level identity gate for a token transfer
on Monad. CleanGraph reads Cleanverse A-Pass identity data, evaluates a local
backend policy, and asks the connected wallet to sign only after both sender and
recipient pass.

The asset is CleanGraph's own ERC-20:

- Name: `Tokenized Real-World Asset`
- Symbol: `TRWA`
- Decimals: `18`
- Fixed supply: `1,000,000 TRWA`
- Initial allocation: the full supply is minted to the deployment treasury

TRWA is not an official, issued, or registered Cleanverse A-Token. Cleanverse
does not deploy, register, mint, pause, or enforce TRWA on-chain.

## 2. Critical limitation

Compliance is enforced by the CleanGraph application, not by the ERC-20.
Direct contract transfers can bypass preflight. This limitation must be visible
in the README, technical explanation, demo, and pitch.

## 3. Demo outcomes

The MVP is successful when:

1. The verified TRWA contract is deployed on the selected Monad testnet.
2. Wallet A has an active, unexpired A-Pass matching the configured policy.
3. Wallet B fails at least one configured policy attribute.
4. A Wallet A transfer is approved before signing and confirms on Monad.
5. The Wallet B scenario is denied before any signature request.
6. The interface shows normalized checks, request correlation, transaction
   confirmation, explorer evidence, and report availability.

## 4. Users and ownership

- The operator/backend owner configures Cleanverse credentials, the verified
  TRWA address, local policy, and the protected evidence token.
- The transfer user connects a Monad-compatible wallet, enters a recipient and
  amount, reviews checks, and signs only after approval.
- The frontend owner integrates wallet connection and renders backend results.

Backend credentials, private keys, raw identity records, and signed report URLs
must never be exposed to the browser or logs.

## 5. TRWA contract requirements

The Solidity contract must:

- use OpenZeppelin ERC-20;
- reject a zero treasury;
- mint exactly `1,000,000 × 10^18` base units in the constructor;
- expose standard transfers and reads; and
- have no public mint, ownership, pause, allowlist, proxy, upgrade, or
  administrative supply path.

Reusable TypeScript helpers must validate caller-supplied Monad configuration,
parse and format amounts without floating point, read token data, simulate a
transfer with an external wallet account, detect reverted receipts, and build
safe explorer links. Reusable helpers must not create a wallet or read a key.

## 6. Preflight API

`POST /api/v1/compliance/preflight` accepts a strict request:

```json
{
  "chain": "monad",
  "sender": "0x1111111111111111111111111111111111111111",
  "recipient": "0x2222222222222222222222222222222222222222",
  "tokenAddress": "0x3333333333333333333333333333333333333333",
  "amount": "100.5"
}
```

The obsolete `atokenAddress` field and all unknown fields are rejected.

The backend must reject an unsupported token locally, query the sender A-Pass,
stop on sender denial, then query the recipient A-Pass. A wallet passes only
when all conditions hold:

- status is `ACTIVE`;
- expiration is strictly later than the current Unix time;
- group exactly matches `TRWA_ALLOWED_GROUP`;
- subgroup exactly matches `TRWA_ALLOWED_SUBGROUP`; and
- at least one A-Pass country is in `TRWA_ALLOWED_COUNTRIES`.

The MVP has no tier, sub-tier, or per-transfer amount policy. The amount remains
validated as a positive decimal with at most 18 decimal places.

Approvals and policy denials return HTTP `200`. Invalid input returns `422`;
missing service or policy configuration returns `503`; Cleanverse failures use
sanitized `502` or `504`; unexpected failures return sanitized `500`.

## 7. Public decision data

Public denial codes distinguish unsupported token, inactive A-Pass, expired
A-Pass, and local policy mismatch for sender and recipient. Checks may identify
that local policy matched or failed, but must never expose:

- CV record IDs;
- KYC hashes;
- raw A-Pass records;
- tier or sub-tier values;
- credentials; or
- upstream messages.

One UUID request ID must be preserved in the request header, response body,
Cleanverse calls, and sanitized structured failure logs.

## 8. Transaction evidence

`POST /api/v1/transactions/evidence` remains protected by backend-only
`OPERATOR_TOKEN`. It validates a confirmed Monad transaction hash and wallet,
polls the Cleanverse index up to three times, and requests a report only after
the transaction is indexed.

For self-deployed, unregistered TRWA, indexing and report generation are
best-effort. `UNAVAILABLE` must not imply settlement failure or invent a
Cleanverse business explanation. Signed HTTPS report URLs are time-limited,
bearer-like values and must use `Cache-Control: no-store` and never be logged or
persisted.

## 9. Frontend requirements

The frontend must:

1. validate chain, addresses, token address, and amount;
2. call preflight before requesting a signature;
3. render checks in returned order with the request ID;
4. stop completely on a policy denial or infrastructure error;
5. simulate and submit the ERC-20 transfer only after approval;
6. show pending, confirmed, reverted, and rejected-signature states; and
7. link to the configured Monad explorer and evidence report when available.

The frontend must never receive `CLEANVERSE_API_KEY`, `OPERATOR_TOKEN`, or a
deployer private key.

## 10. Out of scope

- Official Cleanverse A-Token issuance or registration
- Cleanverse-driven TRWA deployment or minting
- On-chain identity enforcement or restricted transfers
- Mutable token rules, roles, admin controls, or upgrades
- Databases, webhooks, background polling workers, or persistent evidence state
- Live contract deployment before contract review and merge

Low-level Cleanverse A-Token client methods remain tested optional adapter
functionality, not part of the primary demo API.

## 11. Acceptance gates

Before submission, the repository must pass `forge fmt --check`, `forge build`,
`forge test`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
The team must also run one real approved transfer, one pre-signature denial,
secret scanning, and a review of all claims against the application-level
enforcement limitation.
