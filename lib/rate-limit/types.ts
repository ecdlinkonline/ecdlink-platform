export type RateLimitPolicyName = "fallback_auth" | "clerk_webhook" | "funding_decision" | "funding_document_upload" | "funding_communication" | "funding_notes" | "notification_mutation";
export type RateLimitPolicy = { name: RateLimitPolicyName; maximum: number; windowMs: number };
export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date; retryAfterSeconds: number };
export interface RateLimitProvider { consume(input: { key: string; maximum: number; windowMs: number; now: Date }): Promise<RateLimitResult>; }
