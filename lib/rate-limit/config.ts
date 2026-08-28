export type RateLimitConfig = { provider: "memory" | "upstash"; failMode: "closed" | "open"; upstashUrl?: string; upstashToken?: string };

export function getRateLimitConfig(environment: Record<string, string | undefined> = process.env): RateLimitConfig {
  const provider = environment.RATE_LIMIT_PROVIDER === "upstash" ? "upstash" : "memory";
  return { provider, failMode: environment.RATE_LIMIT_FAIL_MODE === "open" ? "open" : "closed", upstashUrl: environment.UPSTASH_REDIS_REST_URL, upstashToken: environment.UPSTASH_REDIS_REST_TOKEN };
}

export function rateLimitConfigDiagnostic(environment: Record<string, string | undefined> = process.env) {
  const config = getRateLimitConfig(environment);
  let urlValid = false;
  try { urlValid = Boolean(config.upstashUrl && new URL(config.upstashUrl).protocol === "https:"); } catch { urlValid = false; }
  return { provider: config.provider, failMode: config.failMode, urlConfigured: Boolean(config.upstashUrl), tokenConfigured: Boolean(config.upstashToken), urlValid };
}
