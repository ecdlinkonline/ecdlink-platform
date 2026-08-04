import type { RateLimitProvider, RateLimitResult } from "./types";

export class MemoryRateLimitProvider implements RateLimitProvider {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();
  async consume(input: { key: string; maximum: number; windowMs: number; now: Date }): Promise<RateLimitResult> {
    const now = input.now.getTime();
    let entry = this.entries.get(input.key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + input.windowMs };
      this.entries.set(input.key, entry);
    }
    entry.count += 1;
    const allowed = entry.count <= input.maximum;
    return { allowed, remaining: Math.max(0, input.maximum - entry.count), resetAt: new Date(entry.resetAt), retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
}
