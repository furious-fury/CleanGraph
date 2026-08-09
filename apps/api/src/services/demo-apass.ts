import { createHash, randomUUID } from "node:crypto";

import {
  CleanverseBusinessError,
  CleanverseHttpError,
  CleanverseMalformedResponseError,
  CleanverseNetworkError,
  CleanverseTimeoutError,
  isCleanverseAPassMissingError,
  type CleanverseClient,
  type GenerateAPassInput,
} from "@cleangraph/cleanverse-client";
import type {
  DemoAPassChallengePurpose,
  DemoAPassProfile,
  DemoAPassPublicStatus,
} from "@cleangraph/shared";
import {
  getAddress,
  verifyMessage,
  type Address,
  type Hex,
} from "viem";

import type {
  DemoAPassOnboardingRecord,
  DemoAPassStore,
} from "../db/demo-apass-store.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1_000;
const MONAD_TESTNET_CHAIN_ID = 10_143;

const LIMITS = {
  challenge: { ip: [20, 10 * 60_000], wallet: [10, 10 * 60_000] },
  create: { ip: [10, 60 * 60_000], wallet: [3, 60 * 60_000] },
  status: { ip: [60, 10 * 60_000], wallet: [30, 10 * 60_000] },
} as const;

export type DemoAPassClient = Pick<
  CleanverseClient,
  "generateAPass" | "queryAPass"
>;

export type WalletProofVerifier = (input: {
  address: Address;
  message: string;
  signature: Hex;
}) => Promise<boolean>;

export class DemoAPassServiceError extends Error {
  readonly code:
    | "RATE_LIMITED"
    | "CHALLENGE_INVALID"
    | "CHALLENGE_EXPIRED"
    | "CHALLENGE_REPLAYED"
    | "WALLET_SIGNATURE_INVALID"
    | "ONBOARDING_NOT_FOUND"
    | "APASS_NOT_FOUND"
    | "APASS_INACTIVE"
    | "CLEANVERSE_REJECTED"
    | "CLEANVERSE_UNAVAILABLE"
    | "CLEANVERSE_TIMEOUT";
  readonly status: 401 | 404 | 409 | 410 | 429 | 502 | 504;
  readonly retryAfterSeconds: number | undefined;
  readonly upstreamCode: string | undefined;

  constructor(
    code: DemoAPassServiceError["code"],
    status: DemoAPassServiceError["status"],
    message: string,
    retryAfterSeconds?: number,
    upstreamCode?: string,
  ) {
    super(message);
    this.name = "DemoAPassServiceError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.upstreamCode = upstreamCode;
  }
}

export function isDemoAPassServiceError(
  error: unknown,
): error is DemoAPassServiceError {
  if (error instanceof DemoAPassServiceError) return true;
  if (!(error instanceof Error) || error.name !== "DemoAPassServiceError") {
    return false;
  }

  const candidate = error as Partial<DemoAPassServiceError>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.status === "number" &&
    typeof candidate.message === "string"
  );
}

export type DemoAPassSafeResponse = {
  walletAddress: string;
  status: DemoAPassPublicStatus;
  registrationTransactionHash?: string;
};

export type DemoAPassService = {
  createChallenge(input: {
    walletAddress: string;
    purpose: DemoAPassChallengePurpose;
    profile?: DemoAPassProfile;
    clientIp: string;
  }): Promise<{ challengeId: string; message: string; expiresAt: string }>;
  createAPass(input: {
    walletAddress: string;
    profile: DemoAPassProfile;
    challengeId: string;
    signature: string;
    clientIp: string;
    requestId: string;
  }): Promise<DemoAPassSafeResponse>;
  readStatus(input: {
    walletAddress: string;
    challengeId: string;
    signature: string;
    clientIp: string;
    requestId: string;
  }): Promise<DemoAPassSafeResponse>;
};

export function createDemoAPassService(
  client: DemoAPassClient,
  store: DemoAPassStore,
  publicAppOrigin: string,
  options: {
    now?: () => Date;
    uuid?: () => string;
    verifyWalletProof?: WalletProofVerifier;
  } = {},
): DemoAPassService {
  const now = options.now ?? (() => new Date());
  const uuid = options.uuid ?? randomUUID;
  const verifyWalletProof =
    options.verifyWalletProof ??
    ((input) =>
      verifyMessage({
        address: input.address,
        message: input.message,
        signature: input.signature,
      }));
  const origin = new URL(publicAppOrigin).origin;

  return {
    async createChallenge(input) {
      const walletAddress = normalizeAddress(input.walletAddress);
      const current = now();
      await enforceLimits(store, "challenge", walletAddress, input.clientIp, current);
      const challengeId = uuid();
      const expiresAt = new Date(current.getTime() + CHALLENGE_TTL_MS);
      const message = createSigningMessage({
        origin,
        walletAddress,
        purpose: input.purpose,
        ...(input.profile === undefined ? {} : { profile: input.profile }),
        challengeId,
        issuedAt: current,
        expiresAt,
      });
      await store.createChallenge({
        id: challengeId,
        walletAddress,
        purpose: input.purpose,
        ...(input.profile === undefined ? {} : { profile: input.profile }),
        message,
        expiresAt,
      });
      return {
        challengeId,
        message,
        expiresAt: expiresAt.toISOString(),
      };
    },

    async createAPass(input) {
      const walletAddress = normalizeAddress(input.walletAddress);
      const current = now();
      await enforceLimits(store, "create", walletAddress, input.clientIp, current);
      await verifyAndConsumeChallenge({
        store,
        verifyWalletProof,
        challengeId: input.challengeId,
        walletAddress,
        purpose: "CREATE",
        profile: input.profile,
        signature: input.signature,
        now: current,
      });

      const created = await store.createOrGetOnboarding({
        id: uuid(),
        walletAddress,
        profile: input.profile,
        now: current,
      });
      let onboarding = created.onboarding;
      let issuanceClaimed = created.created;

      if (!created.created) {
        if (onboarding.profile !== input.profile) {
          return safeResponse(onboarding, "ALREADY_EXISTS");
        }
        if (onboarding.state === "ACTIVE") {
          return safeResponse(onboarding, "ALREADY_EXISTS");
        }
        if (onboarding.state === "PENDING") {
          return safeResponse(onboarding);
        }
        if (onboarding.state === "CREATING") {
          const claimed = await store.claimRetry(onboarding.id, now());
          if (!claimed) return safeResponse(onboarding);
          onboarding = claimed;
          issuanceClaimed = true;
        }
      }

      let existing: "ACTIVE" | "FROZEN" | "MISSING";
      try {
        existing = await queryExistingAPass(
          client,
          walletAddress,
          input.requestId,
        );
      } catch (error) {
        await store.markRetryRequired(
          onboarding.id,
          cleanverseErrorKind(error),
          now(),
        );
        throw mapCleanverseError(error);
      }
      if (existing === "ACTIVE") {
        onboarding = await store.markActive(onboarding.id, now());
        return safeResponse(onboarding, "ALREADY_EXISTS");
      }
      if (existing === "FROZEN") {
        throw new DemoAPassServiceError(
          "APASS_INACTIVE",
          409,
          "Cleanverse found an A-Pass for this wallet, but it is not active.",
        );
      }

      if (!issuanceClaimed) {
        const claimed = await store.claimRetry(onboarding.id, now());
        if (!claimed) return safeResponse(onboarding);
        onboarding = claimed;
        issuanceClaimed = true;
      }

      const generatedInput = buildFictionalInput(onboarding, current);
      try {
        const generated = await client.generateAPass(generatedInput, {
          requestId: input.requestId,
        });
        onboarding = await store.markPending({
          id: onboarding.id,
          registrationTransactionHash:
            generated.data.wallet.transactionHash,
          now: now(),
        });
      } catch (error) {
        await store.markRetryRequired(
          onboarding.id,
          cleanverseErrorKind(error),
          now(),
        );
        throw mapCleanverseError(error);
      }

      try {
        const activated = await queryExistingAPass(
          client,
          walletAddress,
          input.requestId,
        );
        if (activated === "ACTIVE") {
          onboarding = await store.markActive(onboarding.id, now());
        }
      } catch {
        // Issuance already returned a transaction. Polling can safely continue.
      }
      return safeResponse(onboarding);
    },

    async readStatus(input) {
      const walletAddress = normalizeAddress(input.walletAddress);
      const current = now();
      await enforceLimits(store, "status", walletAddress, input.clientIp, current);
      await verifyAndConsumeChallenge({
        store,
        verifyWalletProof,
        challengeId: input.challengeId,
        walletAddress,
        purpose: "STATUS",
        signature: input.signature,
        now: current,
      });

      let onboarding = await store.getOnboardingForWallet(walletAddress);
      if (onboarding?.state === "CREATING") {
        return safeResponse(onboarding);
      }

      let existing: "ACTIVE" | "FROZEN" | "MISSING";
      try {
        existing = await queryExistingAPass(
          client,
          walletAddress,
          input.requestId,
        );
      } catch (error) {
        throw mapCleanverseError(error);
      }
      if (existing === "ACTIVE") {
        if (onboarding) {
          onboarding = await store.markActive(onboarding.id, now());
          return safeResponse(onboarding);
        }
        return { walletAddress, status: "ACTIVE" };
      }
      if (existing === "FROZEN") {
        throw new DemoAPassServiceError(
          "APASS_INACTIVE",
          409,
          "Cleanverse found an A-Pass for this wallet, but it is not active.",
        );
      }
      if (onboarding?.state === "PENDING") {
        return safeResponse(onboarding);
      }
      throw new DemoAPassServiceError(
        "APASS_NOT_FOUND",
        404,
        "Cleanverse does not have an A-Pass for this wallet.",
      );
    },
  };
}

function normalizeAddress(address: string): Address {
  return getAddress(address);
}

async function verifyAndConsumeChallenge(input: {
  store: DemoAPassStore;
  verifyWalletProof: WalletProofVerifier;
  challengeId: string;
  walletAddress: Address;
  purpose: DemoAPassChallengePurpose;
  profile?: DemoAPassProfile;
  signature: string;
  now: Date;
}): Promise<void> {
  const challenge = await input.store.getChallenge(input.challengeId);
  if (
    !challenge ||
    challenge.walletAddress !== input.walletAddress ||
    challenge.purpose !== input.purpose ||
    challenge.profile !== input.profile
  ) {
    throw new DemoAPassServiceError(
      "CHALLENGE_INVALID",
      409,
      "The wallet challenge does not match this request.",
    );
  }
  if (challenge.consumedAt) {
    throw new DemoAPassServiceError(
      "CHALLENGE_REPLAYED",
      409,
      "The wallet challenge has already been used.",
    );
  }
  if (challenge.expiresAt.getTime() <= input.now.getTime()) {
    throw new DemoAPassServiceError(
      "CHALLENGE_EXPIRED",
      410,
      "The wallet challenge has expired.",
    );
  }

  let valid = false;
  try {
    valid = await input.verifyWalletProof({
      address: input.walletAddress,
      message: challenge.message,
      signature: input.signature as Hex,
    });
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new DemoAPassServiceError(
      "WALLET_SIGNATURE_INVALID",
      401,
      "The wallet signature is invalid.",
    );
  }

  const consumed = await input.store.consumeChallenge(input.challengeId, input.now);
  if (consumed.kind === "expired") {
    throw new DemoAPassServiceError(
      "CHALLENGE_EXPIRED",
      410,
      "The wallet challenge has expired.",
    );
  }
  if (consumed.kind === "replayed") {
    throw new DemoAPassServiceError(
      "CHALLENGE_REPLAYED",
      409,
      "The wallet challenge has already been used.",
    );
  }
  if (consumed.kind === "not_found") {
    throw new DemoAPassServiceError(
      "CHALLENGE_INVALID",
      409,
      "The wallet challenge is invalid.",
    );
  }
}

function createSigningMessage(input: {
  origin: string;
  walletAddress: string;
  purpose: DemoAPassChallengePurpose;
  profile?: DemoAPassProfile;
  challengeId: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  const url = new URL(input.origin);
  const profile = input.profile ?? "NONE";
  return `${url.host} wants you to sign in with your Ethereum account:
${input.walletAddress}

Authorize a fictional CleanGraph UAT A-Pass ${input.purpose.toLowerCase()} request. This is not real KYC.

URI: ${input.origin}
Version: 1
Chain ID: ${MONAD_TESTNET_CHAIN_ID}
Nonce: ${input.challengeId.replaceAll("-", "")}
Issued At: ${input.issuedAt.toISOString()}
Expiration Time: ${input.expiresAt.toISOString()}
Request ID: ${input.challengeId}
Purpose: ${input.purpose}
Profile: ${profile}`;
}

function buildFictionalInput(
  onboarding: DemoAPassOnboardingRecord,
  createdAt: Date,
): GenerateAPassInput {
  const expiry = new Date(createdAt);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  const country =
    onboarding.profile === "ELIGIBLE_GB" ? "GB" : "BR";
  const fullName =
    onboarding.profile === "ELIGIBLE_GB"
      ? "CleanGraph Eligible Demo"
      : "CleanGraph Restricted Demo";
  return {
    customerId: `CGDEMO${onboarding.id.replaceAll("-", "")}`,
    kycSource: "CleanGraph Fictional UAT",
    override: false,
    expirationTime: Math.floor(expiry.getTime() / 1_000),
    wallet: { chain: "monad", address: onboarding.walletAddress },
    identityDataList: [
      {
        idType: "PASSPORT",
        fullName,
        idNumber: createHash("sha256")
          .update(
            `cleangraph-fictional-uat:${onboarding.id}:${onboarding.walletAddress.toLowerCase()}:${onboarding.profile}`,
          )
          .digest("hex"),
        validUntil: expiry.toISOString().slice(0, 10),
        issuingCountryISO2: country,
      },
    ],
  };
}

async function queryExistingAPass(
  client: DemoAPassClient,
  walletAddress: string,
  requestId: string,
): Promise<"ACTIVE" | "FROZEN" | "MISSING"> {
  try {
    const response = await client.queryAPass(
      { chain: "monad", address: walletAddress },
      { requestId },
    );
    return response.data.status;
  } catch (error) {
    if (isCleanverseAPassMissingError(error)) {
      return "MISSING";
    }
    throw error;
  }
}

function cleanverseErrorKind(error: unknown): string {
  if (error instanceof CleanverseTimeoutError) return "TIMEOUT";
  if (error instanceof CleanverseNetworkError) return "NETWORK";
  if (error instanceof CleanverseHttpError) return "HTTP";
  if (error instanceof CleanverseBusinessError) return "BUSINESS";
  if (error instanceof CleanverseMalformedResponseError) return "MALFORMED";
  return "UNKNOWN";
}

function mapCleanverseError(error: unknown): DemoAPassServiceError {
  if (error instanceof DemoAPassServiceError) return error;
  if (error instanceof CleanverseTimeoutError) {
    return new DemoAPassServiceError(
      "CLEANVERSE_TIMEOUT",
      504,
      "Cleanverse timed out. Retry with a fresh wallet challenge.",
    );
  }
  if (error instanceof CleanverseBusinessError) {
    const message = error.cleanverseCode === "1000"
      ? "Cleanverse found existing A-Pass group data and requires an explicit override. CleanGraph demo mode will not overwrite existing compliance data."
      : `Cleanverse rejected the demo A-Pass request with business code ${error.cleanverseCode}.`;
    return new DemoAPassServiceError(
      "CLEANVERSE_REJECTED",
      502,
      message,
      undefined,
      error.cleanverseCode,
    );
  }
  return new DemoAPassServiceError(
    "CLEANVERSE_UNAVAILABLE",
    502,
    "Cleanverse is temporarily unavailable.",
  );
}

async function enforceLimits(
  store: DemoAPassStore,
  operation: keyof typeof LIMITS,
  walletAddress: string,
  clientIp: string,
  now: Date,
): Promise<void> {
  for (const [subject, value] of [
    ["ip", clientIp],
    ["wallet", walletAddress.toLowerCase()],
  ] as const) {
    const [limit, windowMs] = LIMITS[operation][subject];
    const result = await store.consumeRateLimit({
      scope: `${operation}:${subject}`,
      subjectHash: createHash("sha256").update(value).digest("hex"),
      limit,
      windowMs,
      now,
    });
    if (!result.allowed) {
      throw new DemoAPassServiceError(
        "RATE_LIMITED",
        429,
        "Too many demo A-Pass requests.",
        result.retryAfterSeconds,
      );
    }
  }
}

function safeResponse(
  onboarding: DemoAPassOnboardingRecord,
  status?: DemoAPassPublicStatus,
): DemoAPassSafeResponse {
  const publicStatus =
    status ??
    (onboarding.state === "ACTIVE"
      ? "ACTIVE"
      : onboarding.state === "CREATING"
        ? "CREATING"
        : "PENDING");
  return {
    walletAddress: onboarding.walletAddress,
    status: publicStatus,
    ...(onboarding.registrationTransactionHash === undefined
      ? {}
      : {
          registrationTransactionHash:
            onboarding.registrationTransactionHash,
        }),
  };
}
