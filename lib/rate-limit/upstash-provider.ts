import type { RateLimitProvider, RateLimitResult } from "./types";

const script = "local c=redis.call('INCR',KEYS[1]); if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {c,redis.call('PTTL',KEYS[1])}";

export class UpstashRateLimitProvider implements RateLimitProvider {
  constructor(private readonly url: string, private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}
  async consume(input: { key: string; maximum: number; windowMs: number; now: Date }): Promise<RateLimitResult> {
    const response = await this.fetcher(this.url, { method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, body: JSON.stringify(["EVAL", script, "1", input.key, String(input.windowMs)]) });
    if (!response.ok) throw new Error("Rate-limit provider unavailable.");
    const payload = await response.json() as { result?: [number, number] };
    if (!payload.result || payload.result.length !== 2) throw new Error("Rate-limit provider returned an invalid response.");
    const [count, ttl] = payload.result;
    const remainingMs = Math.max(1, ttl);
    const allowed = count <= input.maximum;
    return { allowed, remaining: Math.max(0, input.maximum - count), resetAt: new Date(input.now.getTime() + remainingMs), retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(remainingMs / 1000)) };
  }
}
