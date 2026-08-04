export function trustedOrigins(environment: Record<string, string | undefined> = process.env) {
  const developmentOrigin = environment.NODE_ENV === "production" ? undefined : "http://localhost:3000";
  return new Set([environment.APP_BASE_URL, developmentOrigin, ...(environment.TRUSTED_APP_ORIGINS ?? "").split(",")].map((value) => value?.trim().replace(/\/$/, "")).filter((value): value is string => Boolean(value)));
}

export function hasTrustedOrigin(request: Request, environment: Record<string, string | undefined> = process.env) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) return true;
  const origin = request.headers.get("origin")?.replace(/\/$/, "");
  return Boolean(origin && trustedOrigins(environment).has(origin));
}
