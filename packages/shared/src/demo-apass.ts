import { z } from "zod";

import { evmAddressSchema } from "./preflight.js";

export const demoAPassProfileSchema = z.enum([
  "ELIGIBLE_GB",
  "RESTRICTED_BR",
]);

export const demoAPassChallengePurposeSchema = z.enum(["CREATE", "STATUS"]);

export const demoAPassChallengeRequestSchema = z
  .object({
    walletAddress: evmAddressSchema,
    purpose: demoAPassChallengePurposeSchema,
    profile: demoAPassProfileSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.purpose === "CREATE") !== (value.profile !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["profile"],
        message:
          value.purpose === "CREATE"
            ? "Profile is required for creation challenges"
            : "Profile is not allowed for status challenges",
      });
    }
  });

export const demoAPassChallengeResponseSchema = z
  .object({
    challengeId: z.uuid(),
    message: z.string().min(1),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const walletSignatureSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{130}$/, "Invalid EVM wallet signature");

export const createDemoAPassRequestSchema = z
  .object({
    walletAddress: evmAddressSchema,
    profile: demoAPassProfileSchema,
    challengeId: z.uuid(),
    signature: walletSignatureSchema,
  })
  .strict();

export const readDemoAPassStatusRequestSchema = z
  .object({
    walletAddress: evmAddressSchema,
    challengeId: z.uuid(),
    signature: walletSignatureSchema,
  })
  .strict();

export const demoAPassPublicStatusSchema = z.enum([
  "CREATING",
  "PENDING",
  "ACTIVE",
  "ALREADY_EXISTS",
]);

export const demoAPassResponseSchema = z
  .object({
    walletAddress: evmAddressSchema,
    status: demoAPassPublicStatusSchema,
    registrationTransactionHash: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),
  })
  .strict();

export const demoAPassErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "CHALLENGE_INVALID",
  "CHALLENGE_EXPIRED",
  "CHALLENGE_REPLAYED",
  "WALLET_SIGNATURE_INVALID",
  "ONBOARDING_NOT_FOUND",
  "APASS_NOT_FOUND",
  "APASS_INACTIVE",
  "SERVICE_NOT_CONFIGURED",
  "APASS_ALREADY_EXISTS",
  "CLEANVERSE_REJECTED",
  "CLEANVERSE_UNAVAILABLE",
  "CLEANVERSE_TIMEOUT",
  "DATABASE_UNAVAILABLE",
  "INTERNAL_SERVER_ERROR",
]);

export const demoAPassErrorResponseSchema = z
  .object({
    requestId: z.uuid(),
    error: z
      .object({
        code: demoAPassErrorCodeSchema,
        message: z.string().min(1),
        fields: z.record(z.string(), z.array(z.string())).optional(),
      })
      .strict(),
  })
  .strict();

export type DemoAPassProfile = z.infer<typeof demoAPassProfileSchema>;
export type DemoAPassChallengePurpose = z.infer<
  typeof demoAPassChallengePurposeSchema
>;
export type DemoAPassChallengeRequest = z.infer<
  typeof demoAPassChallengeRequestSchema
>;
export type CreateDemoAPassRequest = z.infer<
  typeof createDemoAPassRequestSchema
>;
export type ReadDemoAPassStatusRequest = z.infer<
  typeof readDemoAPassStatusRequestSchema
>;
export type DemoAPassPublicStatus = z.infer<
  typeof demoAPassPublicStatusSchema
>;
export type DemoAPassErrorCode = z.infer<typeof demoAPassErrorCodeSchema>;
