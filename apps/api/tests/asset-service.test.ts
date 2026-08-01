import { CleanverseMalformedResponseError } from "@cleangraph/cleanverse-client";
import { describe, expect, it, vi } from "vitest";

import { createAssetLifecycleService, type CleanverseAssetClient } from "../src/services/assets.js";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const launchInput = {
  chain: "monad" as const,
  tokenName: "Tokenized Real-World Asset",
  tokenSymbol: "TRWA",
  decimals: 18,
  adminAddress: "0x1111111111111111111111111111111111111111",
  rule: { allowedGroup: "II", allowedSubGroup: "AI", minTier: 1, minSubTier: 0, isBlackList: false, countries: ["NG"] },
  icon: "https://assets.example.com/trwa.svg",
};

describe("asset lifecycle service", () => {
  it("propagates the API request ID and returns launch identifiers", async () => {
    const launchAToken = vi.fn<CleanverseAssetClient["launchAToken"]>().mockResolvedValue({ requestId, data: { applicationRequestId: "IA123", issueAssetId: 28 } });
    const client = { launchAToken, queryATokenApplication: vi.fn() } as unknown as CleanverseAssetClient;
    const result = await createAssetLifecycleService(client).launch(launchInput, requestId);
    expect(launchAToken).toHaveBeenCalledWith(launchInput, { requestId });
    expect(result).toEqual({ applicationRequestId: "IA123", issueAssetId: 28 });
  });

  it("rejects wrapped and registration applications from the public status route", async () => {
    const queryATokenApplication = vi.fn<CleanverseAssetClient["queryATokenApplication"]>().mockResolvedValue({
      requestId,
      data: {
        applicationRequestId: "IA123", flowType: "LAUNCH_WRAPPED", status: "PENDING", terminal: false,
        successful: false, chain: "monad", tokenSymbol: "TRWA",
      },
    });
    const client = { launchAToken: vi.fn(), queryATokenApplication } as unknown as CleanverseAssetClient;
    await expect(createAssetLifecycleService(client).getApplication("IA123", requestId)).rejects.toBeInstanceOf(CleanverseMalformedResponseError);
    expect(queryATokenApplication).toHaveBeenCalledWith({ applicationRequestId: "IA123" }, { requestId });
  });
});
