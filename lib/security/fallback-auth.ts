import { createHash, timingSafeEqual } from "node:crypto";
import { getRateLimitService } from "@/lib/rate-limit";
import type { RateLimitService } from "@/lib/rate-limit/service";
import { privateRateLimitIdentifier, requestIp } from "./request-identity";

function digest(value: string) { return createHash("sha256").update(value).digest(); }
export function timingSafeMatches(value: string, expected: string) { return timingSafeEqual(digest(value), digest(expected)); }
export function fallbackAdminEnabled(environment: Record<string, string | undefined> = process.env) { return environment.ECDLINK_ENABLE_FALLBACK_ADMIN === "true"; }

export async function authorizeFallbackAdmin(input: { email: string; password: string; request: Request }, environment: Record<string, string | undefined> = process.env, rateLimiter: Pick<RateLimitService, "check"> = getRateLimitService()) {
  const expectedEmail = environment.ECDLINK_FALLBACK_ADMIN_EMAIL?.trim().toLowerCase();
  const expectedPassword = environment.ECDLINK_FALLBACK_ADMIN_PASSWORD;
  if (!fallbackAdminEnabled(environment) || !expectedEmail || !expectedPassword) return false;
  const identifier = privateRateLimitIdentifier(`${requestIp(input.request)}:${input.email}`, environment.RATE_LIMIT_IDENTIFIER_SECRET);
  const rate = await rateLimiter.check("fallback_auth", identifier);
  if (!rate.allowed) return false;
  return timingSafeMatches(input.email.trim().toLowerCase(), expectedEmail) && timingSafeMatches(input.password, expectedPassword);
}
