import { resolveComplianceCentre } from "@/lib/api/compliance-auth";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { getComplianceRecordByCentreIdFromDb } from "@/lib/repositories/compliance";

export async function GET(_request: Request, { params }: { params: Promise<{ centreId: string }> }) {
  const context = await resolveComplianceCentre();
  if ("error" in context) return context.error;
  const { centreId } = await params;
const linkedCentreIds = context.internalUser.centreUsers.map(
  (centreUser) => centreUser.centreId
);

if (
  linkedCentreIds.length > 0 &&
  !linkedCentreIds.includes(centreId)
) {
  return apiError(
    "You can only view your linked centre compliance records.",
    403
  );
}
  const record = await getComplianceRecordByCentreIdFromDb(centreId);
  return record ? apiSuccess(record) : apiError("Compliance profile not found.", 404);
}
