import { ZodError } from "zod";
import { resolveComplianceCentre } from "@/lib/api/compliance-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { complianceDocumentInclude, getComplianceDocumentFromDb } from "@/lib/repositories/compliance";
import { updateComplianceDocument } from "@/lib/services/compliance";
import { complianceDocumentUpdateSchema } from "@/lib/validators/compliance";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await resolveComplianceCentre();
  if ("error" in context) return context.error;
  const { documentId } = await params;
  const raw = await prisma.complianceDocument.findUnique({ where: { id: documentId }, include: complianceDocumentInclude });
  if (!raw) return apiError("Document not found.", 404);
 const hasCentreAccess = context.internalUser.centreUsers.some(
  (centreUser) => centreUser.centreId === raw.centreId
);

if (!hasCentreAccess) {
  return apiError(
    "You can only view your linked centre documents.",
    403
  );
}
  return apiSuccess(await getComplianceDocumentFromDb(documentId));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const context = await resolveComplianceCentre();
  if ("error" in context) return context.error;
  const { documentId } = await params;
  const raw = await prisma.complianceDocument.findUnique({ where: { id: documentId } });
  if (!raw) return apiError("Document not found.", 404);
const linkedCentreIds = context.internalUser.centreUsers.map(
  (centreUser) => centreUser.centreId
);

if (
  linkedCentreIds.length > 0 &&
  !linkedCentreIds.includes(raw.centreId)
) {
  return apiError(
    "You can only view your linked centre documents.",
    403
  );
}
  try {
    const input = complianceDocumentUpdateSchema.parse(await request.json());
    return apiSuccess(await updateComplianceDocument(documentId, input, context.internalUser.id));
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Document could not be updated.", 500);
  }
}
