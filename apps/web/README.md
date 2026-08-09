# CleanGraph web application

Vite, React, and TypeScript frontend for the CleanGraph RWA transfer demo. It
uses Tailwind CSS, shadcn/ui, and Phosphor Icons.

## Current state

Implemented:

- responsive landing page and transfer workspace;
- Mera passkey and optional Privy external-wallet connections;
- wallet-authenticated fictional A-Pass onboarding;
- ordered compliance preflight decisions; and
- approved TRWA settlement with Monad confirmation.

Set `VITE_PRIVY_APP_ID` to the public App ID from the Privy dashboard to enable
MetaMask, Coinbase Wallet, Rainbow, detected EVM extensions, and WalletConnect.
Without it, the Mera passkey flow remains available and the external-wallet
button explains that configuration is required.

## Development

From the repository root:

```bash
pnpm dev:web
```

The default development URL is `http://localhost:5173`.

The browser must never receive the Cleanverse API ID, API key, decoded AES
key, `OPERATOR_TOKEN`, deployer private key, plaintext identity data, or
encrypted request bodies. TRWA compliance is an application preflight and does
not restrict direct ERC-20 calls.
