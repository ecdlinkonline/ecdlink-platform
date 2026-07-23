import { ZodError } from "zod";
import { requirePartnerOwnership } from "@/lib/api/partner-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { listPartnerMessagesFromDb } from "@/lib/repositories/donors";
import { createPartnerMessageThread } from "@/lib/services/partners";
import { messageSchema } from "@/lib/validators/partners";

export async function GET() {
  const context = await requirePartnerOwnership();

  if ("error" in context) {
    return context.error;
  }

  const partnerIds =
    ("partnerIds" in context ? context.partnerIds : null) ??
    context.internalUser.donorUsers.map(
      (membership) => membership.donorOrganisationId
    );

  return apiSuccess(
    await listPartnerMessagesFromDb(
      partnerIds.length > 0 ? partnerIds : undefined
    )
  );
}

export async function POST(request: Request) {
  const context = await requirePartnerOwnership(
    "messages.manage"
  );

  if ("error" in context) {
    return context.error;
  }

  const partnerIds =
    ("partnerIds" in context ? context.partnerIds : null) ??
    context.internalUser.donorUsers.map(
      (membership) => membership.donorOrganisationId
    );

  try {
    const input = messageSchema.parse(
      await request.json()
    );

    const partnerId =
      context.authContext.role === "donor"
        ? partnerIds[0]
        : (
            await prisma.donorOrganisation.findFirst({
              select: {
                id: true,
              },
            })
          )?.id;

    if (!partnerId) {
      return apiError(
        "Partner organisation ownership is required.",
        403
      );
    }

    const senderType =
      context.authContext.role === "ecd_centre"
        ? "CENTRE"
        : context.authContext.role === "donor"
          ? "DONOR"
          : "ECDLINK";

    return apiSuccess(
      await createPartnerMessageThread(
        partnerId,
        input,
        context.internalUser.id,
        senderType
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
      "Message thread could not be created.",
      500
    );
  }
}