export type ContentSecurityPolicyEnvironment = "development" | "production";

const productionDirectives = [
  ["default-src", "'self'"],
  ["base-uri", "'self'"],
  ["object-src", "'none'"],
  ["frame-ancestors", "'none'"],
  ["form-action", "'self'"],
  ["img-src", "'self' data: blob: https:"],
  ["font-src", "'self' https: data:"],
  ["connect-src", "'self' https://*.clerk.com https://*.clerk.accounts.dev https://*.supabase.co"],
  ["script-src", "'self' https://*.clerk.com https://*.clerk.accounts.dev"],
  ["style-src", "'self' 'unsafe-inline'"],
  ["worker-src", "'self' blob:"],
  ["frame-src", "https://*.clerk.com"],
  ["upgrade-insecure-requests", ""],
] as const;

export function buildContentSecurityPolicy(environment: ContentSecurityPolicyEnvironment) {
  return productionDirectives
    .map(([directive, sources]) => {
      const value = directive === "script-src" && environment === "development" ? `${sources} 'unsafe-eval'` : sources;
      return `${directive}${value ? ` ${value}` : ""};`;
    })
    .join(" ");
}

// TODO(security): Evaluate nonce-based CSP after production rollout without coupling initial hardening to rendering changes.
