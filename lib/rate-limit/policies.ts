import type { RateLimitPolicy, RateLimitPolicyName } from "./types";

export const rateLimitPolicies: Record<RateLimitPolicyName, RateLimitPolicy> = {
  fallback_auth: { name: "fallback_auth", maximum: 5, windowMs: 15 * 60_000 },
  clerk_webhook: { name: "clerk_webhook", maximum: 120, windowMs: 60_000 },
  funding_decision: { name: "funding_decision", maximum: 20, windowMs: 5 * 60_000 },
  funding_document_upload: { name: "funding_document_upload", maximum: 10, windowMs: 10 * 60_000 },
  grant_award_agreement_upload: { name: "grant_award_agreement_upload", maximum: 10, windowMs: 10 * 60_000 },
  funding_communication: { name: "funding_communication", maximum: 30, windowMs: 5 * 60_000 },
  funding_notes: { name: "funding_notes", maximum: 60, windowMs: 5 * 60_000 },
  notification_mutation: { name: "notification_mutation", maximum: 120, windowMs: 5 * 60_000 },
};
