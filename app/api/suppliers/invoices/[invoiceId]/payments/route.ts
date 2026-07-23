import { ZodError } from "zod";
import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import {
  apiError,
  apiSuccess,
  statusFromError,
  validationError,
} from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { recordSupplierPayment } from "@/lib/services/suppliers";
import { supplierPaymentSchema } from "@/lib/validators/suppliers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const context = await requireSupplierOwnership(
    "finance.manage"
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
    const { invoiceId } = await params;

    const invoice = await prisma.supplierInvoice.findFirst({
      where: {
        OR: [
          { id: invoiceId },
          { invoiceNumber: invoiceId },
        ],
      },
    });

    if (!invoice) {
      return apiError(
        "Supplier invoice was not found.",
        404
      );
    }

    if (
      context.authContext.role !== "super_admin" &&
      !supplierIds.includes(invoice.supplierId)
    ) {
      return apiError(
        "You can only update your linked supplier invoices.",
        403
      );
    }

    const input = supplierPaymentSchema.parse(
      await request.json()
    );

    return apiSuccess(
      await recordSupplierPayment(
        invoice.id,
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
      "Supplier payment could not be recorded.",
      500
    );
  }
}