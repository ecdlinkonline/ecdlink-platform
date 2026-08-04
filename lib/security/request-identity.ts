import { createHmac } from "node:crypto";

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function privateRateLimitIdentifier(value: string, secret = process.env.RATE_LIMIT_IDENTIFIER_SECRET ?? "development-only") {
  return createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");
}
