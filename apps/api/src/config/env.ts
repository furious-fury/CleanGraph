import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalOperatorToken = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : value,
  z.string().min(32).optional(),
);

const optionalCleanverseValue = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().optional(),
);

const cleanverseTimeout = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.union([z.string(), z.number()]).default(10_000),
);

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  API_CORS_ORIGIN: z
    .string()
    .url()
    .default("http://localhost:5173"),
  CLEANVERSE_BASE_URL: optionalCleanverseValue,
  CLEANVERSE_API_BASE_URL: optionalCleanverseValue,
  CLEANVERSE_TIMEOUT_MS: cleanverseTimeout,
  CLEANVERSE_API_ID: optionalSecret,
  CLEANVERSE_API_KEY: optionalSecret,
  ASSET_OPERATOR_TOKEN: optionalOperatorToken,
});

export type Environment = z.infer<typeof environmentSchema>;

let cachedEnvironment: Environment | undefined;

export function getEnvironment(): Environment {
  cachedEnvironment ??= environmentSchema.parse(process.env);
  return cachedEnvironment;
}

export function isCleanverseConfigured(
  environment = getEnvironment(),
): boolean {
  return Boolean(
    environment.CLEANVERSE_API_ID && environment.CLEANVERSE_API_KEY,
  );
}

export function getCleanverseBaseUrl(
  environment = getEnvironment(),
): string | undefined {
  return (
    environment.CLEANVERSE_BASE_URL ??
    environment.CLEANVERSE_API_BASE_URL
  );
}

export function getCleanverseTimeoutMs(
  environment = getEnvironment(),
): number {
  return Number(environment.CLEANVERSE_TIMEOUT_MS);
}

export function resetEnvironmentForTests(): void {
  cachedEnvironment = undefined;
}
