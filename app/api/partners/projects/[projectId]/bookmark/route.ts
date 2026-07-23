import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import {
  bookmarkProject,
  removeProjectBookmark,
} from "@/lib/services/partners";

async function projectIdFromParam(value: string) {
  const project = await prisma.impactProject.findFirst({
    where: {
      OR: [
        { id: value },
        { slug: value },
      ],
    },
    select: {
      id: true,
    },
  });

  return project?.id ?? null;
}

export async function POST(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const context = await requirePartnerOwnership("partner.read");

  if ("error" in context) {
    return context.error;
  }

  const partnerIds =
    ("partnerIds" in context ? context.partnerIds : null) ??
    context.internalUser.donorUsers.map(
      (membership) => membership.donorOrganisationId
    );

  try {
    const { projectId: projectParam } = await params;
    const projectId = await projectIdFromParam(projectParam);

    if (!projectId) {
      return apiError(
        "Impact project was not found.",
        404
      );
    }

    const partnerId = partnerIds[0];

    if (!partnerId) {
      return apiError(
        "Partner organisation ownership is required.",
        403
      );
    }

    return apiSuccess(
      await bookmarkProject(
        partnerId,
        projectId,
        context.internalUser.id
      ),
      201
    );
  } catch (error) {
    if (error instanceof Error) {
      return apiError(
        error.message,
        statusFromError(error)
      );
    }

    return apiError(
      "Project could not be bookmarked.",
      500
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const context = await requirePartnerOwnership("partner.read");

  if ("error" in context) {
    return context.error;
  }

  const partnerIds =
    ("partnerIds" in context ? context.partnerIds : null) ??
    context.internalUser.donorUsers.map(
      (membership) => membership.donorOrganisationId
    );

  const { projectId: projectParam } = await params;
  const projectId = await projectIdFromParam(projectParam);
  const partnerId = partnerIds[0];

  if (!projectId || !partnerId) {
    return apiError(
      "Bookmark was not found.",
      404
    );
  }

  return apiSuccess(
    await removeProjectBookmark(
      partnerId,
      projectId
    )
  );
}