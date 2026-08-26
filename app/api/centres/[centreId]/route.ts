import { NextResponse } from "next/server";
import { requireCentreAccess } from "@/lib/auth/permissions";
import { internalAuditActorId } from "@/lib/auth/audit-actor";
import { updateCentreProfile } from "@/lib/centres/api";
import { centreUpdateSchema } from "@/lib/validators/centres";

export async function PATCH(request: Request, { params }: { params: Promise<{ centreId: string }> }) {
  const { centreId } = await params;
  const authContext = await requireCentreAccess(centreId);
  const body = await request.json();
  const input = centreUpdateSchema.parse(body);
  const centre = await updateCentreProfile(centreId, input, internalAuditActorId(authContext));

  if (!centre) {
    return NextResponse.json({ error: "Centre not found" }, { status: 404 });
  }

  return NextResponse.json({ centre });
}
