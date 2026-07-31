import { ZodError } from "zod";
import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { staffProfileUpdateSchema } from "@/lib/validators/ecdlink-staff";

export async function GET(_request: Request, { params }: { params: Promise<{ staffProfileId: string }> }) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  const { staffProfileId } = await params;
  const profile = await prisma.ecdlinkStaffProfile.findUnique({
    where: { id: staffProfileId },
    include: {
      user: true,
      manager: true,
      centreAssignments: {
        include: { centre: true, assignedByUser: true },
        orderBy: [{ isActive: "desc" }, { isPrimary: "desc" }, { assignedAt: "desc" }]
      }
    }
  });

  if (!profile) return apiError("ECDLink staff profile was not found.", 404);
  return apiSuccess(profile);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ staffProfileId: string }> }) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  try {
    const { staffProfileId } = await params;
    const input = staffProfileUpdateSchema.parse(await request.json());
    const before = await prisma.ecdlinkStaffProfile.findUnique({ where: { id: staffProfileId } });
    if (!before) return apiError("ECDLink staff profile was not found.", 404);

    const profile = await prisma.ecdlinkStaffProfile.update({
      where: { id: staffProfileId },
      data: input
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: context.internalUser.id,
        action: "ecdlink_staff.profile.update",
        entityType: "EcdlinkStaffProfile",
        entityId: profile.id,
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(profile))
      }
    });

    return apiSuccess(profile);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("ECDLink staff profile could not be updated.", 400);
  }
}
