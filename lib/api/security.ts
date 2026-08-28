import { apiError } from "./responses";
import { getRateLimitService, type RateLimitPolicyName } from "@/lib/rate-limit";
import { hasTrustedOrigin } from "@/lib/security/trusted-origin";
import { privateRateLimitIdentifier } from "@/lib/security/request-identity";

export function requireTrustedOrigin(request: Request) {
  return hasTrustedOrigin(request) ? null : apiError("Request origin is not allowed.", 403);
}

export async function enforceRateLimit(policy: RateLimitPolicyName, identifier: string, options?: { diagnosticLabel?: string }) {
  const result = await getRateLimitService().check(policy, identifier);
  if (result.allowed) return null;
  if (options?.diagnosticLabel) {
    console.error(options.diagnosticLabel, {
      policy,
      actorHash: privateRateLimitIdentifier(identifier).slice(0, 16),
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfter: result.retryAfterSeconds,
      failureReason: result.failureReason ?? "limit_exceeded",
    });
  }
  const response = apiError("Too many requests. Please try again later.", 429);
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}
