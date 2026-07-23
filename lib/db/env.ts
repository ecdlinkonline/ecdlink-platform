import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  DIRECT_URL: z.string().url().startsWith("postgresql://").optional(),
  USE_MOCK_DATA: z.enum(["true", "false"]).default("false")
});

export function getDatabaseEnv() {
  return databaseEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    USE_MOCK_DATA: process.env.USE_MOCK_DATA ?? "false"
  });
}

export function shouldUseMockData() {
  return process.env.USE_MOCK_DATA === "true";
}

export function hasDatabaseConfig() {
  return !shouldUseMockData() && Boolean(process.env.DATABASE_URL?.startsWith("postgresql://"));
}
