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
      "code": "3",
      "message": "Recipient is not eligible to receive this A-Token",
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
- `501`: compliance integration not implemented
- `503`: backend not configured
- `502`: Cleanverse unavailable or returned an invalid response
- `504`: Cleanverse request timed out
- `500`: unexpected internal failure
