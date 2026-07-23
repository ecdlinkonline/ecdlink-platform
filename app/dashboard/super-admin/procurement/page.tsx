import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { AdminProcurementConsole } from "@/components/procurement/admin-procurement-console";
import { getProcurementReports, listCentreOrders, listProducts } from "@/lib/procurement/api";

export default async function AdminProcurementPage() {
  const [orders, reports, products] = await Promise.all([listCentreOrders(), getProcurementReports(), listProducts()]);

  return (
    <RoleDashboardShell role="super_admin">
      <AdminProcurementConsole orders={orders} reports={reports} products={products} />
    </RoleDashboardShell>
  );
}
