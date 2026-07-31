# CleanGraph web application

Vite, React, and TypeScript frontend for the CleanGraph RWA transfer demo. It
uses Tailwind CSS, shadcn/ui, and Phosphor Icons.

## Current state

Implemented:

- responsive application shell;
- initial asset, recipient, and amount fields; and
- static compliance-terminal layout.

Remaining:

- choose and configure a Monad-compatible wallet provider;
- add `@cleangraph/shared` and client-side validation;
- connect `POST /api/v1/compliance/preflight`;
- render ordered pending, approved, denied, and error checks;
- request an A-Token signature only after approval;
- show transaction confirmation, explorer, and evidence/report states; and
- add frontend and end-to-end tests.

## Development

From the repository root:

```bash
pnpm dev:web
```

The default development URL is `http://localhost:5173`.

The browser must never receive the Cleanverse API ID, API key, decoded AES
key, plaintext identity data, or encrypted request bodies.
