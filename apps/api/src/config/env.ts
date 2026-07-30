import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
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
  CLEANVERSE_API_BASE_URL: z
    .string()
    .url()
    .default("https://uatapi.cleanverse.com/api/cooperate"),
  CLEANVERSE_API_ID: optionalSecret,
  CLEANVERSE_API_KEY: optionalSecret,
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

export function resetEnvironmentForTests(): void {
  cachedEnvironment = undefined;
}
