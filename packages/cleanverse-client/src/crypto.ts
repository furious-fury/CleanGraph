import { createCipheriv } from "node:crypto";

import { CleanverseConfigurationError } from "./errors.js";
import type { AesAlgorithm } from "./config.js";

const zeroInitializationVector = Buffer.alloc(16);

export type EncryptedPayload = {
  data: string;
};

export function encryptPayload(
  payload: unknown,
  aesKey: Buffer,
  aesAlgorithm: AesAlgorithm,
): EncryptedPayload {
  let plaintext: string | undefined;

  try {
    plaintext = JSON.stringify(payload);
  } catch (error) {
    throw new CleanverseConfigurationError(
      "The Cleanverse payload could not be serialized.",
      error,
    );
  }

  if (plaintext === undefined) {
    throw new CleanverseConfigurationError(
      "The Cleanverse payload could not be serialized.",
    );
  }

  const cipher = createCipheriv(
    aesAlgorithm,
    aesKey,
    zeroInitializationVector,
  );
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return { data: ciphertext.toString("base64") };
}
