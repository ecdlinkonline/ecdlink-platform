import { NextRequest } from "next/server";
import { requireProcurementUser } from "@/lib/api/procurement-auth";
import { apiSuccess } from "@/lib/api/responses";
import { listProductsFromDb } from "@/lib/repositories/procurement";

export async function GET(request: NextRequest) {
  const context = await requireProcurementUser();
  if ("error" in context) return context.error;
  return apiSuccess(await listProductsFromDb(request.nextUrl.searchParams.get("category") ?? undefined));
}
