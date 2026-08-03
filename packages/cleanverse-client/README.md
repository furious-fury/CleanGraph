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
- `CleanversePollingExhaustedError`

HTTP status alone is not business success. A successful Cleanverse envelope
must contain top-level code `"0000"`. Endpoint data is validated separately
with Zod.

## Compliance reads

The self-deployed TRWA preflight uses `queryAPass` for each wallet and applies
CleanGraph's backend policy locally:

```ts
const apass = await client.queryAPass(
  {
    chain: "monad",
    address: "0x1111111111111111111111111111111111111111",
  },
  { requestId: incomingRequestId },
);
```

`queryATokenRules` and `verifyAPassForToken` remain tested optional adapter
methods for officially registered A-Tokens. They are not used by the primary
TRWA demo:

```ts
const rules = await client.queryATokenRules({
  chain: "monad",
  atokenAddress: "0x2222222222222222222222222222222222222222",
});

const verification = await client.verifyAPassForToken({
  chain: "monad",
  atokenAddress: "0x2222222222222222222222222222222222222222",
  address: "0x1111111111111111111111111111111111111111",
});
```

Supplying a valid request ID propagates the API correlation ID through
Cleanverse and the returned `CleanverseResponse`. If omitted, the client
generates one.

Successful results use normalized camelCase fields. Unknown response fields
are discarded, submitted address casing is preserved, and response identifiers
must match the request case-insensitively.

`verifyAPassForToken` retains the documented numeric verification code and
adds a named outcome:

- `1`: `ATOKEN_NOT_FOUND`
- `2`: `APASS_MISSING`
- `3`: `APASS_NOT_ELIGIBLE`
- `4`: `ELIGIBLE`

The Cleanverse result is authoritative. The client does not infer a more
specific denial reason from A-Pass attributes or A-Token rules.

## A-Pass provisioning

`generateAPass` sends the documented protected request through the encrypted
transport. Use fictional identity data for the demo:

```ts
const result = await client.generateAPass(
  {
    customerId: "DemoInvestor001",
    expirationTime: 4_102_444_800,
    wallet: {
      chain: "monad",
      address: "0x1111111111111111111111111111111111111111",
    },
    identityDataList: [
      {
        idType: "PASSPORT",
        fullName: "Demo Investor",
        idNumber:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        validUntil: "2099-12-31",
        issuingCountryISO2: "GB",
      },
    ],
  },
  { requestId: incomingRequestId },
);
```

Provisioning boundaries:

- At least one identity document is required so Cleanverse can derive an
  A-Pass country tag.
- `idNumber` accepts only a 64-character SHA-256 hash. Raw identity-document
  numbers are rejected.
- Country codes must be uppercase members of the Cleanverse v5.6 ISO
  appendix.
- Bank-account data is not accepted by the CleanGraph MVP client.
- `generate_apass` does not accept tier or group. Cleanverse assigns the
  returned tier, and the applicable sandbox group mapping must be confirmed
  separately.
- The default request has `override: false`. Business code `1000` is not
  retried automatically; a caller must review the overwrite warning and make
  a new explicit call with `override: true`.
- Request IDs are generated or propagated exactly like the compliance reads.
- Input identity data is encrypted in transit, never included in client
  errors, and never logged by this package.

The method only exposes normalized record, tier, wallet, transaction-hash, and
optional deposit-wallet data from successful responses. Live A-Pass creation
is a separate manual sandbox operation and is not performed by tests.

## Optional A-Token issuance adapter

The methods in this section are retained for other integrations. CleanGraph's
self-deployed TRWA demo does not call them, expose them through Hono, or claim
that Cleanverse issues or enforces TRWA.

`launchAToken` submits the v5.6 standard A-Token launch contract through the
encrypted transport:

```ts
const launch = await client.launchAToken(
  {
    chain: "monad",
    tokenName: "Example Registered Asset",
    tokenSymbol: "ERA",
    decimals: 18,
    adminAddress: "0x1111111111111111111111111111111111111111",
    rule: {
      allowedGroup: "II",
      allowedSubGroup: "AI",
      minTier: 0,
      minSubTier: 0,
      isBlackList: false,
      countries: ["US", "GB", "DE", "SG"],
    },
    icon: "https://assets.example.com/trwa.svg",
  },
  { requestId: incomingRequestId },
);
```

The group codes above are illustrative until the Cleanverse sandbox mapping
is confirmed. Both group fields must be empty or exactly two case-sensitive
characters. Country codes must be unique uppercase values from the v5.6 ISO
appendix. Cleanverse defines `minTier` and `minSubTier` as strict lower bounds:
the A-Pass values must be greater than the configured values.

The token name and symbol must be non-blank and have no surrounding
whitespace. Decimals must be an integer from 0 through 255. The admin address
must be a Monad EVM address, and the icon must use HTTP or HTTPS. An optional
HTTP(S) `callbackUrl` may contain at most 512 characters.

Launch metadata, the admin address, and the rule are present only inside the
AES-encrypted plaintext. The serialized request envelope contains only
`data`. A successful submission returns a normalized
`applicationRequestId` and `issueAssetId`; it does not mean the token has been
issued.

Use a single status read when the caller controls scheduling:

```ts
const status = await client.queryATokenApplication(
  { applicationRequestId: launch.data.applicationRequestId },
  { requestId: incomingRequestId },
);
```

Or use bounded polling:

```ts
const terminal = await client.pollATokenApplication(
  { applicationRequestId: launch.data.applicationRequestId },
  {
    requestId: incomingRequestId,
    maxAttempts: 30,
    intervalMs: 2_000,
  },
);
```

Application statuses are `PENDING`, `APPROVED`, `ISSUING`, `ISSUED`,
`REJECTED`, and `ISSUE_FAILED`. Only `ISSUED` sets `successful: true`.
`REJECTED` and `ISSUE_FAILED` are terminal failures. Their raw upstream
messages are discarded; the normalized result supplies a stable failure code,
a safe display message, and a flag indicating whether Cleanverse supplied a
reason.

Polling repeats only successfully parsed non-terminal status reads. It stops
immediately on a terminal result or any transport, HTTP, business, or malformed
response error. Reaching `maxAttempts` throws the retryable
`CleanversePollingExhaustedError`; it never converts a pending application into
success.

Any live launch is intentionally separate from tests and the TRWA demo. A
caller using this optional adapter must independently confirm permissions,
codes, thresholds, hosted metadata, contract artifacts, and administrator
instructions.

## Transaction evidence

`queryTransactions` reads the Cleanverse transaction index with plain JSON:

```ts
const indexed = await client.queryTransactions(
  {
    chain: "monad",
    address: "0x1111111111111111111111111111111111111111",
    symbol: "TRWA",
    transactionHash:
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    type: "transfer",
  },
  { requestId: incomingRequestId },
);
```

Pagination defaults to page `1` with `10` items and is capped at `100` items
per page. Timestamps use Unix seconds. Returned `amount` and `feeAmount` values
remain base-unit strings; decimal formatting belongs to the contracts and UI
layers.

An empty successful result is valid and may mean that Cleanverse has not
indexed the confirmed Monad transaction yet. This method does not poll and
does not convert an empty page into a settlement failure. The Hono
evidence service owns bounded index polling.

Indexing for CleanGraph's unregistered TRWA is best-effort and may be
unsupported. Empty or unavailable evidence does not invalidate Monad
settlement.

Use `downloadTravelRuleReport` for either a supported A-Token transfer report
or a Travel Rule withdrawal report. Cleanverse determines the report from the
transaction hash; the request does not invent a report-type field:

```ts
const report = await client.downloadTravelRuleReport(
  {
    transactionHash:
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    wallet: {
      chain: "monad",
      address: "0x1111111111111111111111111111111111111111",
    },
  },
  { requestId: incomingRequestId },
);
```

The returned HTTPS URL is time-limited and may contain a bearer-like token.
Callers may present it to the authorized user, but must not put it in logs or
errors. The client validates the URL and filename and discards unknown
upstream fields.

Non-`"0000"` report responses remain `CleanverseBusinessError` instances.
The v5.6 guide does not document enough business codes to safely distinguish
index delay, an unsupported report, or another upstream failure. Application
orchestration must keep report availability separate from confirmed settlement
status.

## Current boundary

Hono asset-launch, application-status, and transaction-evidence routes are
implemented. Live sandbox issuance, role grants, minting, and public A-Pass
provisioning routes remain intentionally deferred.
