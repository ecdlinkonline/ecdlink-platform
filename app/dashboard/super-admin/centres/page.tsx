import { CentresList } from "@/components/centres/centres-list";
import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { getCentreAreas, listCentres } from "@/lib/centres/api";

export default async function CentresPage() {
  const [centres, areas] = await Promise.all([listCentres(), getCentreAreas()]);

  return (
    <RoleDashboardShell role="super_admin">
      <CentresList centres={centres} areas={areas} />
    </RoleDashboardShell>
  );
}
