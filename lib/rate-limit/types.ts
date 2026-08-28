export type RateLimitPolicyName = "fallback_auth" | "clerk_webhook" | "funding_decision" | "funding_document_upload" | "grant_award_agreement_upload" | "funding_communication" | "funding_notes" | "notification_mutation";
export type RateLimitPolicy = { name: RateLimitPolicyName; maximum: number; windowMs: number };
export type RateLimitProviderFailureCode = "http_401" | "http_403" | "http_404" | "http_429" | "http_5xx" | "http_other" | "network" | "timeout" | "malformed_response" | "command_error";
export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date; retryAfterSeconds: number; failureReason?: "provider_unavailable"; providerFailureCode?: RateLimitProviderFailureCode; providerHttpStatus?: number };
export interface RateLimitProvider { consume(input: { key: string; maximum: number; windowMs: number; now: Date }): Promise<RateLimitResult>; }
