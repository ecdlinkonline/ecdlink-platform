import { ZodError } from "zod";
import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { staffCentreAssignmentCreateSchema } from "@/lib/validators/ecdlink-staff";

export async function POST(request: Request, { params }: { params: Promise<{ staffProfileId: string }> }) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  try {
    const { staffProfileId } = await params;
    const input = staffCentreAssignmentCreateSchema.parse(await request.json());
    const assignment = await prisma.ecdlinkStaffCentreAssignment.upsert({
      where: {
        staffProfileId_centreId_assignmentRole: {
          staffProfileId,
          centreId: input.centreId,
          assignmentRole: input.assignmentRole
        }
      },
      update: {
        assignedBy: input.assignedBy ?? context.internalUser.id,
        isPrimary: input.isPrimary,
        isActive: input.isActive,
        notes: input.notes
      },
      create: {
        staffProfileId,
        centreId: input.centreId,
        assignmentRole: input.assignmentRole,
        assignedBy: input.assignedBy ?? context.internalUser.id,
        isPrimary: input.isPrimary,
        isActive: input.isActive,
        notes: input.notes
      },
      include: { centre: true, staffProfile: true }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: context.internalUser.id,
        action: "ecdlink_staff.centre_assignment.upsert",
        entityType: "EcdlinkStaffCentreAssignment",
        entityId: assignment.id,
        after: JSON.parse(JSON.stringify(assignment))
      }
    });

    return apiSuccess(assignment, 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("ECDLink staff centre assignment could not be saved.", 400);
  }
}
