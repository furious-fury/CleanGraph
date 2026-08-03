# CleanGraph Current Scope

CleanGraph is a hackathon application for a self-deployed fixed-supply Monad
ERC-20 named `Tokenized Real-World Asset` (`TRWA`). Before the frontend asks a
wallet to sign, the backend queries Cleanverse A-Pass data for sender and
recipient and applies a configured CleanGraph policy.

TRWA is not an official or registered Cleanverse A-Token. Cleanverse does not
deploy, register, mint, pause, or enforce it. The ERC-20 remains freely
transferable, so direct contract calls can bypass the application preflight.

The local policy requires active, unexpired A-Passes, exact configured group
and subgroup values, and at least one configured country. The MVP does not use
tier, sub-tier, daily, cumulative, or per-transfer amount limits.

After settlement, CleanGraph can make best-effort transaction index and report
requests. An unregistered token may be unsupported or delayed, and report
availability never changes the validity of a confirmed Monad transfer.

See [the product requirements](../PRD.md),
[implementation plan](../Implementation_plan.md), and
[task list](../tasklist.md) for the current source of truth.
