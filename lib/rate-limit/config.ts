export type RateLimitConfig = { provider: "memory" | "upstash"; failMode: "closed" | "open"; upstashUrl?: string; upstashToken?: string };

export function getRateLimitConfig(environment: Record<string, string | undefined> = process.env): RateLimitConfig {
  const provider = environment.RATE_LIMIT_PROVIDER === "upstash" ? "upstash" : "memory";
  return { provider, failMode: environment.RATE_LIMIT_FAIL_MODE === "open" ? "open" : "closed", upstashUrl: environment.UPSTASH_REDIS_REST_URL, upstashToken: environment.UPSTASH_REDIS_REST_TOKEN };
}
