import "server-only";

import { z } from "zod";

const productionEnvironmentSchema = z.object({
  NODE_ENV: z.literal("production"),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  DIRECT_URL: z.string().url().startsWith("postgresql://"),
  USE_MOCK_DATA: z.literal("false"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_live_").min(16),
  CLERK_SECRET_KEY: z.string().startsWith("sk_live_").min(16),
  CLERK_WEBHOOK_SECRET: z.string().startsWith("whsec_").min(16),
  AUTH_SECRET: z.string().min(32),
  SUPABASE_URL: z.string().url().refine((value) => new URL(value).protocol === "https:", "Supabase must use HTTPS."),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_STORAGE_BUCKET: z.string().min(3),
  SUPABASE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(900),
  EMAIL_PROVIDER: z.enum(["noop", "resend"]),
  EMAIL_FROM: z.string().optional().default(""),
  EMAIL_REPLY_TO: z.string().email().optional().or(z.literal("")),
  APP_BASE_URL: z.string().url().refine((value) => new URL(value).protocol === "https:", "Application URL must use HTTPS."),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000),
  EMAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(3),
  READINESS_CHECK_TIMEOUT_MS: z.coerce.number().int().min(500).max(15_000),
  RATE_LIMIT_PROVIDER: z.enum(["memory", "upstash"]),
  RATE_LIMIT_FAIL_MODE: z.enum(["closed", "open"]),
  RATE_LIMIT_IDENTIFIER_SECRET: z.string().min(32),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(20).optional().or(z.literal("")),
  ECDLINK_ENABLE_FALLBACK_ADMIN: z.enum(["true", "false"]),
  TRUSTED_APP_ORIGINS: z.string().min(1),
  UPLOAD_REQUEST_MAX_BYTES: z.coerce.number().int().min(10_000_001).max(15_000_000),
  ECDLINK_FALLBACK_ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  ECDLINK_FALLBACK_ADMIN_PASSWORD: z.string().min(16).optional().or(z.literal("")),
}).superRefine((value, context) => {
  if (value.EMAIL_PROVIDER === "resend") {
    if (!value.RESEND_API_KEY) context.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Resend requires an API key." });
    if (!value.EMAIL_FROM) context.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "Resend requires a verified sender." });
  }
  const fallbackEmail = Boolean(value.ECDLINK_FALLBACK_ADMIN_EMAIL);
  const fallbackPassword = Boolean(value.ECDLINK_FALLBACK_ADMIN_PASSWORD);
  if (value.ECDLINK_ENABLE_FALLBACK_ADMIN === "true" && (!fallbackEmail || !fallbackPassword)) context.addIssue({ code: "custom", path: ["ECDLINK_FALLBACK_ADMIN_EMAIL"], message: "Enabled fallback access requires both credentials." });
  if (value.ECDLINK_ENABLE_FALLBACK_ADMIN === "false" && (fallbackEmail || fallbackPassword)) context.addIssue({ code: "custom", path: ["ECDLINK_FALLBACK_ADMIN_EMAIL"], message: "Disabled fallback access must not retain credentials." });
  if (value.RATE_LIMIT_PROVIDER !== "upstash") context.addIssue({ code: "custom", path: ["RATE_LIMIT_PROVIDER"], message: "Production requires a shared rate-limit provider." });
  if (value.RATE_LIMIT_FAIL_MODE !== "closed") context.addIssue({ code: "custom", path: ["RATE_LIMIT_FAIL_MODE"], message: "Production rate limiting must fail closed." });
  let upstashHttps = false;
  try { upstashHttps = Boolean(value.UPSTASH_REDIS_REST_URL && new URL(value.UPSTASH_REDIS_REST_URL).protocol === "https:"); } catch { upstashHttps = false; }
  if (!upstashHttps) context.addIssue({ code: "custom", path: ["UPSTASH_REDIS_REST_URL"], message: "Upstash requires an HTTPS REST URL." });
  if (!value.UPSTASH_REDIS_REST_TOKEN) context.addIssue({ code: "custom", path: ["UPSTASH_REDIS_REST_TOKEN"], message: "Upstash requires a REST token." });
  for (const origin of value.TRUSTED_APP_ORIGINS.split(",").map((item) => item.trim())) {
    try { const url = new URL(origin); if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error(); }
    catch { context.addIssue({ code: "custom", path: ["TRUSTED_APP_ORIGINS"], message: "Trusted production origins must be HTTPS origins." }); break; }
  }
});

export type ProductionConfiguration = z.infer<typeof productionEnvironmentSchema>;

export function parseProductionEnvironment(environment: Record<string, string | undefined> = process.env): ProductionConfiguration {
  return productionEnvironmentSchema.parse(environment);
}

export function validateProductionEnvironment(environment: Record<string, string | undefined> = process.env) {
  const result = productionEnvironmentSchema.safeParse(environment);
  return result.success
    ? { valid: true as const, configuration: result.data }
    : { valid: false as const, invalidFields: [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "environment")))] };
}
