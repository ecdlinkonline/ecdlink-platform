import { apiError } from "./responses";
import { getRateLimitService, type RateLimitPolicyName } from "@/lib/rate-limit";
import { hasTrustedOrigin } from "@/lib/security/trusted-origin";

export function requireTrustedOrigin(request: Request) {
  return hasTrustedOrigin(request) ? null : apiError("Request origin is not allowed.", 403);
}

export async function enforceRateLimit(policy: RateLimitPolicyName, identifier: string) {
  const result = await getRateLimitService().check(policy, identifier);
  if (result.allowed) return null;
  const response = apiError("Too many requests. Please try again later.", 429);
  response.headers.set("Retry-After", String(result.retryAfterSeconds));
  return response;
}
