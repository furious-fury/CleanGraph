import type {
  Account,
  Address,
  Hash,
  PublicClient,
  SimulateContractReturnType,
} from "viem";

import { trwaAbi } from "./abi.js";

type TrwaReader = Pick<PublicClient, "readContract">;
type TrwaSimulator = Pick<PublicClient, "simulateContract">;
type ReceiptReader = Pick<PublicClient, "waitForTransactionReceipt">;

export async function readTrwaBalance(
  client: TrwaReader,
  tokenAddress: Address,
  account: Address,
): Promise<bigint> {
  return client.readContract({
    address: tokenAddress,
    abi: trwaAbi,
    functionName: "balanceOf",
    args: [account],
  });
}

export async function readTrwaMetadata(client: TrwaReader, tokenAddress: Address) {
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    client.readContract({ address: tokenAddress, abi: trwaAbi, functionName: "name" }),
    client.readContract({ address: tokenAddress, abi: trwaAbi, functionName: "symbol" }),
    client.readContract({ address: tokenAddress, abi: trwaAbi, functionName: "decimals" }),
    client.readContract({ address: tokenAddress, abi: trwaAbi, functionName: "totalSupply" }),
  ]);
  return { name, symbol, decimals, totalSupply };
}

export interface SimulateTrwaTransferInput {
  tokenAddress: Address;
  account: Account | Address;
  recipient: Address;
  amount: bigint;
}

export async function simulateTrwaTransfer(
  client: TrwaSimulator,
  input: SimulateTrwaTransferInput,
): Promise<SimulateContractReturnType<typeof trwaAbi, "transfer", readonly [Address, bigint]>> {
  const result = await client.simulateContract({
    address: input.tokenAddress,
    abi: trwaAbi,
    functionName: "transfer",
    args: [input.recipient, input.amount],
    account: input.account,
  });
  return result as SimulateContractReturnType<
    typeof trwaAbi,
    "transfer",
    readonly [Address, bigint]
  >;
}

export class TrwaTransactionRevertedError extends Error {
  readonly transactionHash: Hash;

  constructor(transactionHash: Hash) {
    super("TRWA transfer transaction reverted");
    this.name = "TrwaTransactionRevertedError";
    this.transactionHash = transactionHash;
  }
}

export async function confirmTrwaTransfer(client: ReceiptReader, hash: Hash) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new TrwaTransactionRevertedError(hash);
  return receipt;
}
