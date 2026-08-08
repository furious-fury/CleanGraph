import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import {
  confirmTrwaTransfer,
  readTrwaBalance,
  readTrwaMetadata,
  simulateTrwaTransfer,
  TrwaTransactionRevertedError,
} from "../src/client.js";

const TOKEN = "0x1111111111111111111111111111111111111111";
const ACCOUNT = "0x2222222222222222222222222222222222222222";
const RECIPIENT = "0x3333333333333333333333333333333333333333";
const HASH = `0x${"ab".repeat(32)}` as const;

describe("TRWA client helpers", () => {
  it("reads a balance with the expected contract arguments", async () => {
    const readContract = vi.fn().mockResolvedValue(42n);
    const result = await readTrwaBalance({ readContract } as unknown as PublicClient, TOKEN, ACCOUNT);
    expect(result).toBe(42n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: TOKEN, functionName: "balanceOf", args: [ACCOUNT] }),
    );
  });

  it("reads token metadata", async () => {
    const values = ["Tokenized Real-World Asset", "TRWA", 18, 1_000_000n * 10n ** 18n];
    const readContract = vi.fn().mockImplementation(({ functionName }: { functionName: string }) => {
      const names = ["name", "symbol", "decimals", "totalSupply"];
      return Promise.resolve(values[names.indexOf(functionName)]);
    });
    await expect(
      readTrwaMetadata({ readContract } as unknown as PublicClient, TOKEN),
    ).resolves.toEqual({
      name: values[0],
      symbol: values[1],
      decimals: values[2],
      totalSupply: values[3],
    });
  });

  it("simulates using the external wallet account", async () => {
    const simulation = { request: { to: TOKEN } };
    const simulateContract = vi.fn().mockResolvedValue(simulation);
    await expect(
      simulateTrwaTransfer({ simulateContract } as unknown as PublicClient, {
        tokenAddress: TOKEN,
        account: ACCOUNT,
        recipient: RECIPIENT,
        amount: 5n,
      }),
    ).resolves.toBe(simulation);
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TOKEN,
        functionName: "transfer",
        args: [RECIPIENT, 5n],
        account: ACCOUNT,
      }),
    );
  });

  it("returns successful receipts and explicitly rejects reverted receipts", async () => {
    const successful = { status: "success", transactionHash: HASH };
    await expect(
      confirmTrwaTransfer(
        { waitForTransactionReceipt: vi.fn().mockResolvedValue(successful) } as unknown as PublicClient,
        HASH,
      ),
    ).resolves.toBe(successful);

    await expect(
      confirmTrwaTransfer(
        {
          waitForTransactionReceipt: vi
            .fn()
            .mockResolvedValue({ status: "reverted", transactionHash: HASH }),
        } as unknown as PublicClient,
        HASH,
      ),
    ).rejects.toBeInstanceOf(TrwaTransactionRevertedError);
  });
});
