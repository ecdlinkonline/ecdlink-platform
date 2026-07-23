import { ZodError } from "zod";
import { requireProcurementAdmin } from "@/lib/api/procurement-auth";
import { apiError, apiSuccess, statusFromError, validationError } from "@/lib/api/responses";
import { prisma } from "@/lib/db/prisma";
import { openProcurementCycle } from "@/lib/services/procurement";
import { openProcurementCycleSchema } from "@/lib/validators/procurement";

export async function GET() {
  const context = await requireProcurementAdmin();
  if ("error" in context) return context.error;
  return apiSuccess(await prisma.procurementCycle.findMany({ orderBy: [{ year: "desc" }, { opensAt: "desc" }] }));
}

export async function POST(request: Request) {
  const context = await requireProcurementAdmin();
  if ("error" in context) return context.error;
  try {
    const input = openProcurementCycleSchema.parse(await request.json());
    return apiSuccess(await openProcurementCycle(input, context.internalUser.id), 201);
  } catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof Error) return apiError(error.message, statusFromError(error));
    return apiError("Procurement cycle could not be opened.", 500);
  }
}
