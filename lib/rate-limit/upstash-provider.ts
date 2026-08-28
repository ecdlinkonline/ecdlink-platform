import type { RateLimitProvider, RateLimitProviderFailureCode, RateLimitResult } from "./types";

const script = "local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {c,redis.call('PTTL',KEYS[1])}";
const requestTimeoutMs = 5_000;

export class UpstashRateLimitProviderError extends Error {
  constructor(public readonly code: RateLimitProviderFailureCode, public readonly httpStatus?: number) {
    super("Rate-limit provider unavailable.");
    this.name = "UpstashRateLimitProviderError";
  }
}

function httpFailureCode(status: number): RateLimitProviderFailureCode {
  if (status === 401) return "http_401";
  if (status === 403) return "http_403";
  if (status === 404) return "http_404";
  if (status === 429) return "http_429";
  if (status >= 500) return "http_5xx";
  return "http_other";
}

export class UpstashRateLimitProvider implements RateLimitProvider {
  constructor(private readonly url: string, private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}
  async consume(input: { key: string; maximum: number; windowMs: number; now: Date }): Promise<RateLimitResult> {
    let response: Response;
    try {
      response = await this.fetcher(this.url, { method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, body: JSON.stringify(["EVAL", script, "1", input.key, String(input.windowMs)]), signal: AbortSignal.timeout(requestTimeoutMs) });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      throw new UpstashRateLimitProviderError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
    }
    if (!response.ok) throw new UpstashRateLimitProviderError(httpFailureCode(response.status), response.status);
    let payload: { result?: unknown; error?: unknown };
    try { payload = await response.json() as { result?: unknown; error?: unknown }; }
    catch { throw new UpstashRateLimitProviderError("malformed_response", response.status); }
    if (typeof payload.error === "string") throw new UpstashRateLimitProviderError("command_error", response.status);
    if (!Array.isArray(payload.result) || payload.result.length !== 2 || !payload.result.every((value) => typeof value === "number" && Number.isFinite(value))) {
      throw new UpstashRateLimitProviderError("malformed_response", response.status);
    }
    const [count, ttl] = payload.result;
    const remainingMs = Math.max(1, ttl);
    const allowed = count <= input.maximum;
    return { allowed, remaining: Math.max(0, input.maximum - count), resetAt: new Date(input.now.getTime() + remainingMs), retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(remainingMs / 1000)) };
  }
}
