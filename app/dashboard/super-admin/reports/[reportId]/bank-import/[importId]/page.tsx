export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { GrantBankImportWorkspace } from "@/components/reports/grant-bank-import-workspace";
import { requireInternalUser } from "@/lib/auth/permissions";
import { getGrantBankImportWorkspace, GrantBankImportError } from "@/lib/services/grant-bank-imports";

export default async function GrantBankImportPage({ params }: { params: Promise<{ reportId: string; importId: string }> }) {
  const context = await requireInternalUser();
  if (context.internalUser.role !== "SUPER_ADMIN") redirect("/dashboard");
  const { reportId, importId } = await params;
  try {
    return <GrantBankImportWorkspace initialData={await getGrantBankImportWorkspace({ reportId, importId, actorUserId: context.internalUser.id })} />;
  } catch (error) {
    if (error instanceof GrantBankImportError && error.status === 404) notFound();
    throw error;
  }
}
