import { getRateLimitConfig } from "./config";
import { MemoryRateLimitProvider } from "./memory-provider";
import { rateLimitPolicies } from "./policies";
import type { RateLimitPolicyName, RateLimitProvider, RateLimitResult } from "./types";
import { UpstashRateLimitProvider } from "./upstash-provider";

export function rateLimitKey(policyName: RateLimitPolicyName, identifier: string) {
  return `ecdlink:${rateLimitPolicies[policyName].name}:${identifier}`;
}

export class RateLimitService {
  constructor(private readonly provider: RateLimitProvider, private readonly failMode: "closed" | "open" = "closed", private readonly now = () => new Date()) {}
  async check(policyName: RateLimitPolicyName, identifier: string): Promise<RateLimitResult> {
    const policy = rateLimitPolicies[policyName];
    try { return await this.provider.consume({ key: rateLimitKey(policyName, identifier), maximum: policy.maximum, windowMs: policy.windowMs, now: this.now() }); }
    catch {
      const now = this.now();
      return { allowed: this.failMode === "open", remaining: 0, resetAt: new Date(now.getTime() + policy.windowMs), retryAfterSeconds: Math.ceil(policy.windowMs / 1000), failureReason: "provider_unavailable" };
    }
  }
}

let service: RateLimitService | undefined;
export function getRateLimitService() {
  if (service) return service;
  const config = getRateLimitConfig();
  const provider = config.provider === "upstash" && config.upstashUrl && config.upstashToken
    ? new UpstashRateLimitProvider(config.upstashUrl, config.upstashToken)
    : new MemoryRateLimitProvider();
  service = new RateLimitService(provider, config.failMode);
  return service;
}
