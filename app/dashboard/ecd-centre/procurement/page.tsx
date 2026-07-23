import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { CentreProcurementModule } from "@/components/procurement/centre-procurement-module";
import { listCategories, listProducts } from "@/lib/procurement/api";

export default async function CentreProcurementPage() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);

  return (
    <RoleDashboardShell role="ecd_centre">
      <CentreProcurementModule products={products} categories={categories} />
    </RoleDashboardShell>
  );
}
