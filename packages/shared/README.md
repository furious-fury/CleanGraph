# `@cleangraph/shared`

Runtime Zod schemas and inferred TypeScript types shared by the CleanGraph API
and frontend. This package contains public application contracts only. It must
not contain Cleanverse credentials, encryption helpers, or sensitive identity
data.

## Frontend setup

Add the workspace dependency from the repository root:

```bash
pnpm --filter @cleangraph/web add '@cleangraph/shared@workspace:*'
```

Import a schema and its inferred type:

```ts
import {
  preflightDecisionSchema,
  type PreflightDecision,
} from "@cleangraph/shared";

const payload: unknown = await response.json();
const decision: PreflightDecision = preflightDecisionSchema.parse(payload);
```

## Preflight request

```json
{
  "chain": "monad",
  "sender": "0x1111111111111111111111111111111111111111",
  "recipient": "0x2222222222222222222222222222222222222222",
  "atokenAddress": "0x3333333333333333333333333333333333333333",
  "amount": "100.5"
}
```

Amounts are decimal strings, not JavaScript numbers. They must be greater than
zero and have at most 18 fractional digits.

## Completed decision

Policy approvals and denials both use HTTP `200` because both are completed
policy evaluations:

```json
{
  "requestId": "123e4567-e89b-42d3-a456-426614174000",
  "approved": false,
  "decisionCode": "RECIPIENT_NOT_ELIGIBLE",
  "checks": [
    {
      "id": "recipient-eligibility",
      "source": "cleanverse",
      "status": "denied",
      "code": "APASS_NOT_ELIGIBLE",
      "message": "Recipient is not eligible to receive this A-Token.",
      "checkedAt": "2026-07-30T12:00:00.000Z"
    }
  ]
}
```

Validation, configuration, upstream, timeout, and internal failures use non-2xx
statuses. A preflight error may include sanitized checks that completed before
the failure.

The preflight endpoint uses these HTTP statuses:

- `200`: completed approval or denial
- `422`: invalid request
- `503`: backend not configured
- `502`: Cleanverse unavailable or returned an invalid response
- `504`: Cleanverse request timed out
- `500`: unexpected internal failure

## Asset lifecycle contracts

The package exports `assetLaunchRequestSchema`, `assetLaunchResponseSchema`,
`assetApplicationResponseSchema`, and `assetErrorResponseSchema` for the
protected operator flow. It also owns the v5.6 Cleanverse country-code schema,
which is shared by the browser contract and Node-only Cleanverse client.

```ts
import {
  assetApplicationResponseSchema,
  assetLaunchRequestSchema,
  type AssetLaunchRequest,
} from "@cleangraph/shared";

const launch: AssetLaunchRequest = assetLaunchRequestSchema.parse({
  chain: "monad",
  tokenName: "Tokenized Real-World Asset",
  tokenSymbol: "TRWA",
  decimals: 18,
  adminAddress: "0x1111111111111111111111111111111111111111",
  rule: {
    allowedGroup: "II",
    allowedSubGroup: "AI",
    minTier: 1,
    minSubTier: 0,
    countries: ["NG"],
  },
  icon: "https://assets.example.com/trwa.svg",
});

const snapshot = assetApplicationResponseSchema.parse(await response.json());
```

Only `IA...` standard launch identifiers are public. `ISSUED` is the only
successful state and requires an A-Token address, transaction hash, and issue
timestamp. `REJECTED` and `ISSUE_FAILED` remain successful HTTP `200` status
reads with normalized failure evidence.

## Transaction evidence contracts

The package exports `transactionEvidenceRequestSchema`,
`transactionEvidenceResponseSchema`, and `evidenceErrorResponseSchema` for the
protected post-settlement evidence flow. Requests contain the Monad transaction
hash and involved wallet address. Responses keep index and report state
separate: an empty index is `PENDING`, while an indexed transaction may have an
`AVAILABLE` or `UNAVAILABLE` report.

Amounts and fees remain base-unit strings and block times remain Unix seconds.
Available report URLs must use HTTPS and may be time-limited, so callers must
not cache, persist, or log them.
