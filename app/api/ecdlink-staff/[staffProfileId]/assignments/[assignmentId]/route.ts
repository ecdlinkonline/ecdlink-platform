import { ZodError } from "zod";
import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { staffCentreAssignmentUpdateSchema } from "@/lib/validators/ecdlink-staff";

export async function PATCH(request: Request, { params }: { params: Promise<{ staffProfileId: string; assignmentId: string }> }) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  try {
    const { staffProfileId, assignmentId } = await params;
    const input = staffCentreAssignmentUpdateSchema.parse(await request.json());
    const before = await prisma.ecdlinkStaffCentreAssignment.findFirst({ where: { id: assignmentId, staffProfileId } });
    if (!before) return apiError("ECDLink staff centre assignment was not found.", 404);

    const assignment = await prisma.ecdlinkStaffCentreAssignment.update({
      where: { id: assignmentId },
      data: input,
      include: { centre: true, staffProfile: true }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: context.internalUser.id,
        action: "ecdlink_staff.centre_assignment.update",
        entityType: "EcdlinkStaffCentreAssignment",
        entityId: assignment.id,
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(assignment))
      }
    });

    return apiSuccess(assignment);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("ECDLink staff centre assignment could not be updated.", 400);
  }
}
