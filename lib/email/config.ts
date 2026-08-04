import type { EmailProviderName } from "@prisma/client";

export type EmailConfig = { provider: EmailProviderName; from: string; replyTo?: string; baseUrl: string; resendApiKey?: string; requestTimeoutMs: number; maxAttempts: number };
const positiveInt = (value: string | undefined, fallback: number) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; };
export function getEmailConfig(env: Record<string, string | undefined> = process.env): EmailConfig {
  const provider = env.EMAIL_PROVIDER?.toUpperCase() === "RESEND" ? "RESEND" : "NOOP";
  return { provider, from: env.EMAIL_FROM?.trim() ?? "", replyTo: env.EMAIL_REPLY_TO?.trim() || undefined, baseUrl: (env.APP_BASE_URL?.trim() || "http://localhost:3000").replace(/\/$/, ""), resendApiKey: env.RESEND_API_KEY?.trim() || undefined, requestTimeoutMs: positiveInt(env.EMAIL_REQUEST_TIMEOUT_MS, 10000), maxAttempts: Math.min(positiveInt(env.EMAIL_MAX_ATTEMPTS, 3), 3) };
}
