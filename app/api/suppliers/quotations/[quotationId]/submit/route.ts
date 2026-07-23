import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { setQuotationStatus } from "@/lib/services/suppliers";

export async function POST(
  _: Request,
  {
    params,
  }: {
    params: Promise<{ quotationId: string }>;
  }
) {
  const context = await requireSupplierOwnership(
    "quotations.manage"
  );

  if ("error" in context) {
    return context.error;
  }

  const supplierIds =
    ("supplierIds" in context ? context.supplierIds : null) ??
    context.internalUser.supplierUsers.map(
      (membership) => membership.supplierId
    );

  try {
    const { quotationId } = await params;

    const quotation =
      await prisma.supplierQuotation.findFirst({
        where: {
          OR: [
            { id: quotationId },
            { quotationNumber: quotationId },
          ],
        },
      });

    if (!quotation) {
      return apiError(
        "Supplier quotation was not found.",
        404
      );
    }

    if (
      context.authContext.role !== "super_admin" &&
      !supplierIds.includes(quotation.supplierId)
    ) {
      return apiError(
        "You can only submit your linked supplier quotations.",
        403
      );
    }

    return apiSuccess(
      await setQuotationStatus(
        quotation.id,
        "SUBMITTED",
        context.internalUser.id
      )
    );
  } catch (error) {
    if (error instanceof Error) {
      return apiError(
        error.message,
        statusFromError(error)
      );
    }

    return apiError(
      "Supplier quotation could not be submitted.",
      500
    );
  }
}