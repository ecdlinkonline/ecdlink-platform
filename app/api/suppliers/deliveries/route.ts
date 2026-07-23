import { requireSupplierOwnership } from "@/lib/api/supplier-auth";
import { apiSuccess } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const context = await requireSupplierOwnership();

  if ("error" in context) {
    return context.error;
  }

  const supplierIds =
    ("supplierIds" in context ? context.supplierIds : null) ??
    context.internalUser.supplierUsers.map(
      (membership) => membership.supplierId
    );

  return apiSuccess(
    await prisma.delivery.findMany({
      where:
        context.authContext.role === "super_admin"
          ? {
              supplierId: {
                not: null,
              },
            }
          : {
              supplierId: {
                in: supplierIds,
              },
            },
      include: {
        supplier: true,
        supplierOrder: true,
        order: {
          include: {
            centre: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    })
  );
}