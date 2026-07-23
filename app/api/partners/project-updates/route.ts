import { ZodError } from "zod";
import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { createProjectUpdate } from "@/lib/services/partners";
import { projectUpdateSchema } from "@/lib/validators/partners";

export async function GET() {
  const context = await requirePartnerOwnership();

  if ("error" in context) {
    return context.error;
  }

  return apiSuccess(
    await prisma.projectUpdate.findMany({
      where:
        context.authContext.role === "donor"
          ? {
              visibility: {
                in: ["Partner", "Public"],
              },
            }
          : undefined,
      include: {
        project: true,
      },
      orderBy: {
        updateDate: "desc",
      },
    })
  );
}

export async function POST(request: Request) {
  const context = await requirePartnerOwnership();

  if ("error" in context) {
    return context.error;
  }

  const centreIds =
    ("centreIds" in context ? context.centreIds : null) ??
    context.internalUser.centreUsers.map(
      (ownership) => ownership.centreId
    );

  try {
    if (context.authContext.role === "donor") {
      return apiError(
        "Partner users can view project updates but cannot create centre updates.",
        403
      );
    }

    const input = projectUpdateSchema.parse(
      await request.json()
    );

    if (context.authContext.role === "ecd_centre") {
      const project = await prisma.impactProject.findUnique({
        where: {
          id: input.impactProjectId,
        },
        select: {
          centreId: true,
        },
      });

      if (
        !project ||
        !centreIds.includes(project.centreId)
      ) {
        return apiError(
          "You can only create updates for your centre projects.",
          403
        );
      }
    }

    return apiSuccess(
      await createProjectUpdate(
        input,
        context.internalUser.id
      ),
      201
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return validationError(error);
    }

    if (error instanceof Error) {
      return apiError(
        error.message,
        statusFromError(error)
      );
    }

    return apiError(
      "Project update could not be created.",
      500
    );
  }
}