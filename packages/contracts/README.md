# CleanGraph TRWA contract

This package contains CleanGraph's self-deployed hackathon ERC-20 and reusable
viem helpers. `TRWA` is **not** an officially issued or registered Cleanverse
A-Token. Cleanverse A-Pass data is evaluated by the CleanGraph backend before
the browser requests a signature.

The contract itself is a standard, unrestricted ERC-20. A user can bypass the
application preflight by calling the contract directly. The demo must describe
the control as application-level compliance, not on-chain enforcement.

## Contract

- Name: `Tokenized Real-World Asset`
- Symbol: `TRWA`
- Decimals: `18`
- Fixed supply: `1,000,000 TRWA`
- Initial holder: the nonzero treasury passed to the constructor
- Administration: none; there is no mint, owner, pause, allowlist, proxy, or
  privileged supply-changing path

The ERC-20 implementation is OpenZeppelin Contracts 5.4.0. Solidity is pinned
to 0.8.28 in `foundry.toml`.

## Local checks

Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then
run:

```bash
forge --version
cast --version
anvil --version
pnpm --filter @cleangraph/contracts lint
pnpm --filter @cleangraph/contracts typecheck
pnpm --filter @cleangraph/contracts test
pnpm --filter @cleangraph/contracts build
```

## Deployment checkpoint

Warning: never commit the deployer key, seed phrase, or a funded environment
file. The contract PR is merged; complete the checks below before broadcasting.

Set these backend-only shell variables:

```dotenv
DEPLOYER_PRIVATE_KEY=0x...
TRWA_TREASURY_ADDRESS=0x...
MONAD_CHAIN_ID=10143
MONAD_RPC_URL=https://...
MONAD_EXPLORER_URL=https://...
```

Simulate without broadcasting:

```bash
forge script script/DeployTRWA.s.sol:DeployTRWA \
  --rpc-url "$MONAD_RPC_URL"
```

Broadcast exactly once after confirming the simulated chain and output:

```bash
forge script script/DeployTRWA.s.sol:DeployTRWA \
  --rpc-url "$MONAD_RPC_URL" \
  --broadcast
```

The script validates the connected chain ID before broadcast. Forge prints the
deployment transaction, and the script emits only the public deployed address.
Afterward, use `cast code` and read `name`, `symbol`, `decimals`, `totalSupply`,
and the treasury `balanceOf`; then perform one small test transfer. Record only
the public contract address, transaction hash, chain ID, and explorer links.

Source verification is explorer-dependent. Follow the selected Monad
[deployment guide](https://docs.monad.xyz/guides) when verification is
supported. Contract behavior follows the OpenZeppelin
[ERC-20 API](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20).
