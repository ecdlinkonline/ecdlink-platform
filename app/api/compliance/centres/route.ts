import { NextRequest } from "next/server";
import { resolveComplianceCentre } from "@/lib/api/compliance-auth";
import { apiSuccess } from "@/lib/api/responses";
import { getComplianceRecordByCentreIdFromDb, listComplianceRecordsFromDb } from "@/lib/repositories/compliance";

export async function GET(request: NextRequest) {
  const context = await resolveComplianceCentre();
  if ("error" in context) return context.error;

const linkedCentreId =
  context.internalUser?.centreUsers?.[0]?.centreId;

if (linkedCentreId) {
  return apiSuccess(
    await getComplianceRecordByCentreIdFromDb(linkedCentreId)
  );
}

  return apiSuccess(await listComplianceRecordsFromDb({
    query: request.nextUrl.searchParams.get("query") ?? undefined,
    region: request.nextUrl.searchParams.get("region") ?? undefined,
    documentStatus: request.nextUrl.searchParams.get("documentStatus") ?? undefined,
    scoreLight: request.nextUrl.searchParams.get("scoreLight") ?? undefined
  }));
}
