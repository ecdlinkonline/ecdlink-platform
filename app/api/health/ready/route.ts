import { createReadinessResponse } from "@/lib/health/response";

export async function GET() {
  return createReadinessResponse();
}
