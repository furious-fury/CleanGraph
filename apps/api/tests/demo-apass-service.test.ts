import {
  CleanverseBusinessError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
} from "@cleangraph/cleanverse-client";
import type {
  DemoAPassProfile,
} from "@cleangraph/shared";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";

import type {
  ChallengeConsumption,
  DemoAPassOnboardingRecord,
  DemoAPassStore,
  RateLimitResult,
} from "../src/db/demo-apass-store.js";
import {
  createDemoAPassService,
  DemoAPassServiceError,
  type DemoAPassClient,
} from "../src/services/demo-apass.js";

const wallet = "0x1111111111111111111111111111111111111111";
const otherWallet = "0x2222222222222222222222222222222222222222";
const requestId = "123e4567-e89b-42d3-a456-426614174000";
const challengeId = "223e4567-e89b-42d3-a456-426614174000";
const onboardingId = "323e4567-e89b-42d3-a456-426614174000";
const txHash = `0x${"a".repeat(64)}`;
const signature = `0x${"1".repeat(130)}`;

class MemoryStore implements DemoAPassStore {
  readonly challenges = new Map<string, DemoAPassChallengeRecord>();
  readonly onboardings = new Map<string, DemoAPassOnboardingRecord>();
  rateLimitResult: RateLimitResult = { allowed: true };

  async createChallenge(challenge: DemoAPassChallengeRecord): Promise<void> {
    this.challenges.set(challenge.id, challenge);
  }

  async getChallenge(id: string) {
    return this.challenges.get(id);
  }

  async consumeChallenge(id: string, now: Date): Promise<ChallengeConsumption> {
    const challenge = this.challenges.get(id);
    if (!challenge) return { kind: "not_found" };
    if (challenge.consumedAt) return { kind: "replayed" };
    if (challenge.expiresAt.getTime() <= now.getTime()) {
      return { kind: "expired" };
    }
    challenge.consumedAt = now;
    return { kind: "consumed", challenge };
  }

  async consumeRateLimit(): Promise<RateLimitResult> {
    return this.rateLimitResult;
  }

  async createOrGetOnboarding(input: {
    id: string;
    walletAddress: string;
    profile: DemoAPassProfile;
    now: Date;
  }) {
    const key = input.walletAddress.toLowerCase();
    const existing = this.onboardings.get(key);
    if (existing) return { onboarding: existing, created: false };
    const onboarding: DemoAPassOnboardingRecord = {
      id: input.id,
      walletAddress: input.walletAddress,
      profile: input.profile,
      state: "CREATING",
      attemptCount: 1,
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.onboardings.set(key, onboarding);
    return { onboarding, created: true };
  }

  async getOnboardingForWallet(walletAddress: string) {
    return this.onboardings.get(walletAddress.toLowerCase());
  }

  async claimRetry(id: string, now: Date) {
    const onboarding = this.find(id);
    const staleCreating =
      onboarding.state === "CREATING" &&
      onboarding.updatedAt.getTime() <= now.getTime() - 5 * 60_000;
    if (onboarding.state !== "RETRY_REQUIRED" && !staleCreating) {
      return undefined;
    }
    onboarding.state = "CREATING";
    onboarding.attemptCount += 1;
    onboarding.updatedAt = now;
    delete onboarding.lastErrorKind;
    return onboarding;
  }

  async markPending(input: {
    id: string;
    registrationTransactionHash: string;
    now: Date;
  }) {
    const onboarding = this.find(input.id);
    onboarding.state = "PENDING";
    onboarding.registrationTransactionHash =
      input.registrationTransactionHash;
    onboarding.updatedAt = input.now;
    return onboarding;
  }

  async markActive(id: string, now: Date) {
    const onboarding = this.find(id);
    onboarding.state = "ACTIVE";
    onboarding.updatedAt = now;
    onboarding.activatedAt = now;
    return onboarding;
  }

  async markRetryRequired(id: string, errorKind: string, now: Date) {
    const onboarding = this.find(id);
    onboarding.state = "RETRY_REQUIRED";
    onboarding.lastErrorKind = errorKind;
    onboarding.updatedAt = now;
    return onboarding;
  }

  async purge(before: Date) {
    let onboardings = 0;
    let challenges = 0;
    for (const [key, value] of this.onboardings) {
      if (value.updatedAt < before) {
        this.onboardings.delete(key);
        onboardings += 1;
      }
    }
    for (const [key, value] of this.challenges) {
      if (value.expiresAt < before) {
        this.challenges.delete(key);
        challenges += 1;
      }
    }
    return { onboardings, challenges, rateLimits: 0 };
  }

  async close(): Promise<void> {}

  private find(id: string): DemoAPassOnboardingRecord {
    const onboarding = [...this.onboardings.values()].find(
      (value) => value.id === id,
    );
    if (!onboarding) throw new Error("Missing onboarding");
    return onboarding;
  }
}

function cleanverseClient() {
  const queryAPass = vi.fn<DemoAPassClient["queryAPass"]>();
  const generateAPass = vi.fn<DemoAPassClient["generateAPass"]>();
  queryAPass.mockRejectedValue(new CleanverseBusinessError(requestId, "0002"));
  generateAPass.mockResolvedValue({
    requestId,
    encrypted: true,
    data: {
      customerId: `CGDEMO${onboardingId.replaceAll("-", "")}`,
      cvRecordId: "cv-record",
      tier: "1",
      wallet: {
        operation: "REGISTER",
        address: wallet,
        chain: "monad",
        transactionHash: txHash,
      },
    },
  });
  return { client: { queryAPass, generateAPass }, queryAPass, generateAPass };
}

function serviceFixture(profile: DemoAPassProfile = "ELIGIBLE_GB") {
  const store = new MemoryStore();
  const cleanverse = cleanverseClient();
  const ids = [challengeId, onboardingId];
  const now = new Date("2026-08-09T12:00:00.000Z");
  const verifyWalletProof = vi.fn().mockResolvedValue(true);
  const service = createDemoAPassService(
    cleanverse.client,
    store,
    "https://app.cleangraph.example",
    {
      now: () => now,
      uuid: () => ids.shift()!,
      verifyWalletProof,
    },
  );
  return { service, store, now, verifyWalletProof, ...cleanverse, profile };
}

async function challengeAndCreate(
  fixture: ReturnType<typeof serviceFixture>,
  profile = fixture.profile,
) {
  const challenge = await fixture.service.createChallenge({
    walletAddress: wallet,
    purpose: "CREATE",
    profile,
    clientIp: "192.0.2.10",
  });
  const response = await fixture.service.createAPass({
    walletAddress: wallet,
    profile,
    challengeId: challenge.challengeId,
    signature,
    clientIp: "192.0.2.10",
    requestId,
  });
  return { challenge, response };
}

describe("demo A-Pass onboarding service", () => {
  it.each([
    ["ELIGIBLE_GB", "GB", "CleanGraph Eligible Demo"],
    ["RESTRICTED_BR", "BR", "CleanGraph Restricted Demo"],
  ] as const)(
    "creates the fictional %s profile entirely on the backend",
    async (profile, country, fullName) => {
      const fixture = serviceFixture(profile);
      const { challenge, response } = await challengeAndCreate(fixture);

      expect(challenge.message).toContain("Chain ID: 10143");
      expect(challenge.message).toContain(`Profile: ${profile}`);
      expect(challenge.message).toContain(
        "URI: https://app.cleangraph.example",
      );
      expect(response).toEqual({
        walletAddress: wallet,
        status: "PENDING",
        registrationTransactionHash: txHash,
      });
      expect(fixture.generateAPass).toHaveBeenCalledWith(
        expect.objectContaining({
          kycSource: "CleanGraph Fictional UAT",
          override: false,
          wallet: { chain: "monad", address: wallet },
          identityDataList: [
            expect.objectContaining({
              fullName,
              issuingCountryISO2: country,
              idType: "PASSPORT",
              idNumber: expect.stringMatching(/^[0-9a-f]{64}$/),
              validUntil: "2027-08-09",
            }),
          ],
        }),
        { requestId },
      );
      expect(JSON.stringify([...fixture.store.onboardings.values()])).not.toContain(
        fullName,
      );
      expect(JSON.stringify([...fixture.store.onboardings.values()])).not.toContain(
        "customerId",
      );
    },
  );

  it("rejects an invalid wallet signature before consuming or issuing", async () => {
    const fixture = serviceFixture();
    fixture.verifyWalletProof.mockResolvedValue(false);
    const challenge = await fixture.service.createChallenge({
      walletAddress: wallet,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
      clientIp: "192.0.2.10",
    });

    await expect(
      fixture.service.createAPass({
        walletAddress: wallet,
        profile: "ELIGIBLE_GB",
        challengeId: challenge.challengeId,
        signature,
        clientIp: "192.0.2.10",
        requestId,
      }),
    ).rejects.toMatchObject({ code: "WALLET_SIGNATURE_INVALID" });
    expect(fixture.generateAPass).not.toHaveBeenCalled();
    expect(fixture.store.challenges.get(challengeId)?.consumedAt).toBeUndefined();
  });

  it.each([
    { walletAddress: otherWallet, profile: "ELIGIBLE_GB" as const },
    { walletAddress: wallet, profile: "RESTRICTED_BR" as const },
  ])("rejects a challenge bound to different request data", async (changed) => {
    const fixture = serviceFixture();
    await fixture.service.createChallenge({
      walletAddress: wallet,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
      clientIp: "192.0.2.10",
    });

    await expect(
      fixture.service.createAPass({
        ...changed,
        challengeId,
        signature,
        clientIp: "192.0.2.10",
        requestId,
      }),
    ).rejects.toMatchObject({ code: "CHALLENGE_INVALID" });
    expect(fixture.generateAPass).not.toHaveBeenCalled();
  });

  it("rejects an expired challenge before issuance", async () => {
    const fixture = serviceFixture();
    await fixture.service.createChallenge({
      walletAddress: wallet,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
      clientIp: "192.0.2.10",
    });
    fixture.store.challenges.get(challengeId)!.expiresAt = new Date(
      "2026-08-09T11:59:59.000Z",
    );

    await expect(
      fixture.service.createAPass({
        walletAddress: wallet,
        profile: "ELIGIBLE_GB",
        challengeId,
        signature,
        clientIp: "192.0.2.10",
        requestId,
      }),
    ).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });
    expect(fixture.generateAPass).not.toHaveBeenCalled();
  });

  it("prevents a signed challenge from being replayed", async () => {
    const fixture = serviceFixture();
    await challengeAndCreate(fixture);

    await expect(
      fixture.service.createAPass({
        walletAddress: wallet,
        profile: "ELIGIBLE_GB",
        challengeId,
        signature,
        clientIp: "192.0.2.10",
        requestId,
      }),
    ).rejects.toMatchObject({ code: "CHALLENGE_REPLAYED" });
    expect(fixture.generateAPass).toHaveBeenCalledTimes(1);
  });

  it("returns already exists and never overwrites an existing A-Pass", async () => {
    const fixture = serviceFixture();
    fixture.queryAPass.mockResolvedValue({
      requestId,
      encrypted: false,
      data: {
        cvRecordId: "existing",
        tier: "1",
        subTier: 1,
        statusCode: 1,
        status: "ACTIVE",
        expirationTime: 1_900_000_000,
        group: "",
        subGroup: "",
        currentKycHash: "hash",
        countries: ["GB"],
      },
    });

    const { response } = await challengeAndCreate(fixture);

    expect(response.status).toBe("ALREADY_EXISTS");
    expect(fixture.generateAPass).not.toHaveBeenCalled();
  });

  it.each([
    [new CleanverseTimeoutError(requestId), "CLEANVERSE_TIMEOUT"],
    [new CleanverseNetworkError(requestId), "CLEANVERSE_UNAVAILABLE"],
  ] as const)(
    "sanitizes issuance failure and records only a retry category",
    async (error, code) => {
      const fixture = serviceFixture();
      fixture.generateAPass.mockRejectedValue(error);

      await expect(challengeAndCreate(fixture)).rejects.toMatchObject({ code });
      const persisted = [...fixture.store.onboardings.values()][0]!;
      expect(persisted.state).toBe("RETRY_REQUIRED");
      expect(persisted.lastErrorKind).toMatch(/TIMEOUT|NETWORK/);
      expect(JSON.stringify(persisted)).not.toContain(requestId);
    },
  );

  it("queries Cleanverse before retrying an uncertain issuance", async () => {
    const fixture = serviceFixture();
    fixture.generateAPass.mockRejectedValueOnce(
      new CleanverseTimeoutError(requestId),
    );
    await expect(challengeAndCreate(fixture)).rejects.toMatchObject({
      code: "CLEANVERSE_TIMEOUT",
    });

    fixture.queryAPass.mockResolvedValue({
      requestId,
      encrypted: false,
      data: {
        cvRecordId: "created-during-timeout",
        tier: "1",
        subTier: 1,
        statusCode: 1,
        status: "ACTIVE",
        expirationTime: 1_900_000_000,
        group: "",
        subGroup: "",
        currentKycHash: "hash",
        countries: ["GB"],
      },
    });
    const retryChallengeId = "623e4567-e89b-42d3-a456-426614174000";
    const retryService = createDemoAPassService(
      fixture.client,
      fixture.store,
      "https://app.cleangraph.example",
      {
        now: () => fixture.now,
        uuid: () => retryChallengeId,
        verifyWalletProof: fixture.verifyWalletProof,
      },
    );
    const challenge = await retryService.createChallenge({
      walletAddress: wallet,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
      clientIp: "192.0.2.10",
    });
    const response = await retryService.createAPass({
      walletAddress: wallet,
      profile: "ELIGIBLE_GB",
      challengeId: challenge.challengeId,
      signature,
      clientIp: "192.0.2.10",
      requestId,
    });

    expect(response.status).toBe("ALREADY_EXISTS");
    expect(fixture.generateAPass).toHaveBeenCalledTimes(1);
    expect(fixture.queryAPass).toHaveBeenCalledTimes(2);
  });

  it("uses a fresh signed status challenge and confirms activation", async () => {
    const fixture = serviceFixture();
    await challengeAndCreate(fixture);
    const statusChallengeId = "423e4567-e89b-42d3-a456-426614174000";
    fixture.queryAPass.mockResolvedValue({
      requestId,
      encrypted: false,
      data: {
        cvRecordId: "cv-record",
        tier: "1",
        subTier: 1,
        statusCode: 1,
        status: "ACTIVE",
        expirationTime: 1_900_000_000,
        group: "",
        subGroup: "",
        currentKycHash: "hash",
        countries: ["GB"],
      },
    });
    const statusService = createDemoAPassService(
      fixture.client,
      fixture.store,
      "https://app.cleangraph.example",
      {
        now: () => fixture.now,
        uuid: () => statusChallengeId,
        verifyWalletProof: fixture.verifyWalletProof,
      },
    );
    const challenge = await statusService.createChallenge({
      walletAddress: wallet,
      purpose: "STATUS",
      clientIp: "192.0.2.10",
    });
    const response = await statusService.readStatus({
      walletAddress: wallet,
      challengeId: challenge.challengeId,
      signature,
      clientIp: "192.0.2.10",
      requestId,
    });

    expect(response.status).toBe("ACTIVE");
    expect(fixture.store.onboardings.get(wallet)?.state).toBe("ACTIVE");
  });

  it("returns a retry delay when a persistent rate limit denies a request", async () => {
    const fixture = serviceFixture();
    fixture.store.rateLimitResult = {
      allowed: false,
      retryAfterSeconds: 42,
    };

    await expect(
      fixture.service.createChallenge({
        walletAddress: wallet,
        purpose: "STATUS",
        clientIp: "192.0.2.10",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "RATE_LIMITED",
        retryAfterSeconds: 42,
      }),
    );
  });

  it("purges audit records older than thirty days in the store contract", async () => {
    const fixture = serviceFixture();
    await challengeAndCreate(fixture);
    const result = await fixture.store.purge(
      new Date("2026-09-09T12:00:00.000Z"),
      new Date("2026-09-09T12:00:00.000Z"),
    );

    expect(result.onboardings).toBe(1);
    expect(result.challenges).toBe(1);
  });

  it("verifies a real EVM signature over the exact origin-bound message", async () => {
    const fixture = serviceFixture();
    const account = privateKeyToAccount(
      "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
    const ids = [challengeId, onboardingId];
    const realService = createDemoAPassService(
      fixture.client,
      fixture.store,
      "https://app.cleangraph.example",
      {
        now: () => fixture.now,
        uuid: () => ids.shift()!,
      },
    );
    const challenge = await realService.createChallenge({
      walletAddress: account.address,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
      clientIp: "192.0.2.10",
    });
    const validSignature = await account.signMessage({
      message: challenge.message,
    });

    await expect(
      realService.createAPass({
        walletAddress: account.address,
        profile: "ELIGIBLE_GB",
        challengeId,
        signature: validSignature,
        clientIp: "192.0.2.10",
        requestId,
      }),
    ).resolves.toMatchObject({ status: "PENDING" });
  });

  it("rejects a signature made over a different application origin", async () => {
    const fixture = serviceFixture();
    const account = privateKeyToAccount(
      "0x1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
    const realService = createDemoAPassService(
      fixture.client,
      fixture.store,
      "https://app.cleangraph.example",
      {
        now: () => fixture.now,
        uuid: () => challengeId,
      },
    );
    const challenge = await realService.createChallenge({
      walletAddress: account.address,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
      clientIp: "192.0.2.10",
    });
    const wrongOriginSignature = await account.signMessage({
      message: challenge.message.replace(
        "https://app.cleangraph.example",
        "https://evil.example",
      ),
    });

    await expect(
      realService.createAPass({
        walletAddress: account.address,
        profile: "ELIGIBLE_GB",
        challengeId,
        signature: wrongOriginSignature,
        clientIp: "192.0.2.10",
        requestId,
      }),
    ).rejects.toMatchObject({ code: "WALLET_SIGNATURE_INVALID" });
    expect(fixture.generateAPass).not.toHaveBeenCalled();
  });

  it("allows only one of two concurrent submissions to consume a challenge", async () => {
    const fixture = serviceFixture();
    await fixture.service.createChallenge({
      walletAddress: wallet,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
      clientIp: "192.0.2.10",
    });
    const input = {
      walletAddress: wallet,
      profile: "ELIGIBLE_GB" as const,
      challengeId,
      signature,
      clientIp: "192.0.2.10",
      requestId,
    };

    const results = await Promise.allSettled([
      fixture.service.createAPass(input),
      fixture.service.createAPass(input),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(fixture.generateAPass).toHaveBeenCalledTimes(1);
  });

  it("recovers a stale CREATING lease by querying before issuance", async () => {
    const fixture = serviceFixture();
    fixture.store.onboardings.set(wallet, {
      id: onboardingId,
      walletAddress: wallet,
      profile: "ELIGIBLE_GB",
      state: "CREATING",
      attemptCount: 1,
      createdAt: new Date("2026-08-09T11:50:00.000Z"),
      updatedAt: new Date("2026-08-09T11:50:00.000Z"),
    });
    const challenge = await fixture.service.createChallenge({
      walletAddress: wallet,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
      clientIp: "192.0.2.10",
    });
    const response = await fixture.service.createAPass({
      walletAddress: wallet,
      profile: "ELIGIBLE_GB",
      challengeId: challenge.challengeId,
      signature,
      clientIp: "192.0.2.10",
      requestId,
    });

    expect(response.status).toBe("PENDING");
    expect(fixture.queryAPass).toHaveBeenCalledBefore(fixture.generateAPass);
    expect(fixture.generateAPass).toHaveBeenCalledTimes(1);
    expect(fixture.store.onboardings.get(wallet)?.attemptCount).toBe(2);
  });

  it("does not issue again for a fresh duplicate request while pending", async () => {
    const fixture = serviceFixture();
    await challengeAndCreate(fixture);
    const duplicateChallengeId = "523e4567-e89b-42d3-a456-426614174000";
    const duplicateService = createDemoAPassService(
      fixture.client,
      fixture.store,
      "https://app.cleangraph.example",
      {
        now: () => fixture.now,
        uuid: () => duplicateChallengeId,
        verifyWalletProof: fixture.verifyWalletProof,
      },
    );
    const challenge = await duplicateService.createChallenge({
      walletAddress: wallet,
      purpose: "CREATE",
      profile: "ELIGIBLE_GB",
      clientIp: "192.0.2.10",
    });
    const response = await duplicateService.createAPass({
      walletAddress: wallet,
      profile: "ELIGIBLE_GB",
      challengeId: challenge.challengeId,
      signature,
      clientIp: "192.0.2.10",
      requestId,
    });

    expect(response.status).toBe("PENDING");
    expect(fixture.generateAPass).toHaveBeenCalledTimes(1);
  });

  it("uses service errors rather than leaking upstream error details", () => {
    const error = new DemoAPassServiceError(
      "CLEANVERSE_UNAVAILABLE",
      502,
      "Cleanverse is temporarily unavailable.",
    );
    expect(JSON.stringify(error)).not.toContain("api");
  });
});
