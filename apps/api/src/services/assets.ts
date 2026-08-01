import {
  CleanverseMalformedResponseError,
  type CleanverseClient,
  type LaunchATokenResult,
  type QueryATokenApplicationResult,
} from "@cleangraph/cleanverse-client";
import type { AssetLaunchRequest } from "@cleangraph/shared";

export type CleanverseAssetClient = Pick<
  CleanverseClient,
  "launchAToken" | "queryATokenApplication"
>;

export type AssetLifecycleService = {
  launch(input: AssetLaunchRequest, requestId: string): Promise<LaunchATokenResult>;
  getApplication(applicationRequestId: string, requestId: string): Promise<QueryATokenApplicationResult>;
};

export function createAssetLifecycleService(client: CleanverseAssetClient): AssetLifecycleService {
  return {
    async launch(input, requestId) {
      const response = await client.launchAToken(input, { requestId });
      if (!/^IA\d+$/.test(response.data.applicationRequestId)) {
        throw new CleanverseMalformedResponseError(requestId);
      }
      return response.data;
    },
    async getApplication(applicationRequestId, requestId) {
      const response = await client.queryATokenApplication({ applicationRequestId }, { requestId });
      if (response.data.flowType !== "LAUNCH") {
        throw new CleanverseMalformedResponseError(requestId);
      }
      return response.data;
    },
  };
}
