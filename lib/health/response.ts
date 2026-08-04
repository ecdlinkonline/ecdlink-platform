import { NextResponse } from "next/server";
import { checkReadiness } from "./readiness";

export async function createReadinessResponse(check: typeof checkReadiness = checkReadiness) {
  const result = await check();
  return NextResponse.json(result, { status: result.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
