# `@cleangraph/cleanverse-client`

Node-only transport and security foundation for the Cleanverse Cooperate API.
The package keeps Cleanverse credentials, encryption, response parsing, and
safe error mapping outside the browser.

## Configuration

```ts
import { CleanverseClient } from "@cleangraph/cleanverse-client";

const client = new CleanverseClient({
  apiId: process.env.CLEANVERSE_API_ID!,
  apiKey: process.env.CLEANVERSE_API_KEY!,
});
```

Defaults:

- Base URL: `https://uatapi.cleanverse.com/api/cooperate`
- Timeout: 10 seconds
- Request ID: generated UUID
- Retry policy: no automatic retries

Tests may inject `fetch` and `requestIdFactory`. Production callers may pass a
valid incoming Hono request ID to future endpoint methods for end-to-end
correlation.

## Security boundary

- The API key must be standard Base64 and decode to 16, 24, or 32 bytes.
- Protected bodies use AES-128/192/256-CBC according to the key length.
- Encryption uses the documented 16-byte zero IV and JSON UTF-8 plaintext.
- Encrypted requests contain only `{ "data": "<Base64 ciphertext>" }`.
- The raw Base64 key is not retained after client construction.
- Errors never serialize keys, plaintext, ciphertext, or upstream bodies.
- The package does not emit logs.

The zero IV is required for Cleanverse protocol compatibility. It must not be
copied into unrelated encryption designs.

## Error handling

Failures use typed exceptions:

- `CleanverseConfigurationError`
- `CleanverseTimeoutError`
- `CleanverseNetworkError`
- `CleanverseHttpError`
- `CleanverseMalformedResponseError`
- `CleanverseBusinessError`

HTTP status alone is not business success. A successful Cleanverse envelope
must contain top-level code `"0000"`. Endpoint data is validated separately
with Zod.

## Current boundary

This package intentionally exposes no Cleanverse endpoint methods yet.
Read-only A-Pass, A-Token rule, eligibility, transaction, and report methods
will be added in the next backend PR.
