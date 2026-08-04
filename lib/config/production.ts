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
  ECDLINK_FALLBACK_ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  ECDLINK_FALLBACK_ADMIN_PASSWORD: z.string().min(16).optional().or(z.literal("")),
}).superRefine((value, context) => {
  if (value.EMAIL_PROVIDER === "resend") {
    if (!value.RESEND_API_KEY) context.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Resend requires an API key." });
    if (!value.EMAIL_FROM) context.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "Resend requires a verified sender." });
  }
  const fallbackEmail = Boolean(value.ECDLINK_FALLBACK_ADMIN_EMAIL);
  const fallbackPassword = Boolean(value.ECDLINK_FALLBACK_ADMIN_PASSWORD);
  if (fallbackEmail !== fallbackPassword) context.addIssue({ code: "custom", path: ["ECDLINK_FALLBACK_ADMIN_EMAIL"], message: "Fallback credentials must be configured together." });
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
