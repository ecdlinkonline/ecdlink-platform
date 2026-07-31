export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { CentreEditForm } from "@/components/centres/centre-edit-form";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { getCentreById } from "@/lib/centres/api";

export default async function EditCentreProfilePage({
  params
}: {
  params: Promise<{ centreId: string }>;
}) {
  const { centreId } = await params;
  const centre = await getCentreById(centreId);

  if (!centre) {
    notFound();
  }

  return (
    <RoleDashboardShell role="super_admin">
      <CentreEditForm centre={centre} mode="admin" />
    </RoleDashboardShell>
  );
}

