import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireIdentityAdmin } from "@/lib/api/identity-auth";
import { apiError, apiSuccess, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { staffProfileCreateSchema } from "@/lib/validators/ecdlink-staff";

export async function GET(request: NextRequest) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  const query = request.nextUrl.searchParams.get("query")?.toLowerCase();
  const department = request.nextUrl.searchParams.get("department");
  const status = request.nextUrl.searchParams.get("status");
  const profiles = await prisma.ecdlinkStaffProfile.findMany({
    include: {
      user: true,
      manager: true,
      centreAssignments: {
        where: { isActive: true },
        include: { centre: true },
        orderBy: [{ isPrimary: "desc" }, { assignedAt: "desc" }]
      }
    },
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }]
  });

  return apiSuccess(
    profiles.filter((profile) => {
      const searchable = [profile.firstName, profile.lastName, profile.workEmail, profile.employeeNumber, profile.jobTitle, profile.department].join(" ").toLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (!department || department === "All" || profile.department === department) &&
        (!status || status === "All" || profile.employmentStatus === status)
      );
    })
  );
}

export async function POST(request: Request) {
  const context = await requireIdentityAdmin();
  if ("error" in context) return context.error;

  try {
    const input = staffProfileCreateSchema.parse(await request.json());
    const profile = await prisma.ecdlinkStaffProfile.upsert({
      where: { userId: input.userId },
      update: input,
      create: input
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: context.internalUser.id,
        action: "ecdlink_staff.profile.upsert",
        entityType: "EcdlinkStaffProfile",
        entityId: profile.id,
        after: JSON.parse(JSON.stringify(profile))
      }
    });

    return apiSuccess(profile, 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError("ECDLink staff profile could not be saved.", 400);
  }
}
