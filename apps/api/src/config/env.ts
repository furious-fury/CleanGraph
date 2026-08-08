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

const optionalPolicyValue = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : value,
  z.string().trim().regex(/^[A-Za-z0-9]{2}$/).optional(),
);

const optionalTokenAddress = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : value,
  z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
);

const optionalCountryAllowlist = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === ""
      ? undefined
      : value,
  z
    .string()
    .transform((value, context) => {
      const countries = value.split(",").map((country) => country.trim());
      if (
        countries.length === 0 ||
        countries.some((country) => !/^[A-Z]{2}$/.test(country)) ||
        new Set(countries).size !== countries.length
      ) {
        context.addIssue({
          code: "custom",
          message: "Countries must be unique uppercase ISO codes",
        });
        return z.NEVER;
      }
      return countries;
    })
    .optional(),
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

export const environmentSchema = z
  .object({
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
    OPERATOR_TOKEN: optionalOperatorToken,
    TRWA_TOKEN_ADDRESS: optionalTokenAddress,
    TRWA_ALLOWED_GROUP: optionalPolicyValue,
    TRWA_ALLOWED_SUBGROUP: optionalPolicyValue,
    TRWA_ALLOWED_COUNTRIES: optionalCountryAllowlist,
  })
  .superRefine((environment, context) => {
    const requiredNames = [
      "TRWA_TOKEN_ADDRESS",
      "TRWA_ALLOWED_COUNTRIES",
    ] as const;
    const configured = requiredNames.filter((name) => environment[name] !== undefined);
    const hasOptionalFilter =
      environment.TRWA_ALLOWED_GROUP !== undefined ||
      environment.TRWA_ALLOWED_SUBGROUP !== undefined;
    if (
      (configured.length !== 0 || hasOptionalFilter) &&
      configured.length !== requiredNames.length
    ) {
      for (const name of requiredNames) {
        if (environment[name] === undefined) {
          context.addIssue({
            code: "custom",
            path: [name],
            message: "TRWA token address and country allowlist must be configured together",
          });
        }
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export type TrwaPolicy = {
  tokenAddress: string;
  allowedGroup?: string;
  allowedSubgroup?: string;
  allowedCountries: readonly string[];
};

let cachedEnvironment: Environment | undefined;

export function getEnvironment(): Environment {
  cachedEnvironment ??= environmentSchema.parse(process.env);
  return cachedEnvironment;
}

export function getTrwaPolicy(
  environment = getEnvironment(),
): TrwaPolicy | undefined {
  if (
    environment.TRWA_TOKEN_ADDRESS === undefined ||
    environment.TRWA_ALLOWED_COUNTRIES === undefined
  ) {
    return undefined;
  }
  return {
    tokenAddress: environment.TRWA_TOKEN_ADDRESS,
    allowedCountries: environment.TRWA_ALLOWED_COUNTRIES,
    ...(environment.TRWA_ALLOWED_GROUP === undefined
      ? {}
      : { allowedGroup: environment.TRWA_ALLOWED_GROUP }),
    ...(environment.TRWA_ALLOWED_SUBGROUP === undefined
      ? {}
      : { allowedSubgroup: environment.TRWA_ALLOWED_SUBGROUP }),
  };
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
