export const dynamic = "force-dynamic";

import { RoleDashboardShell } from "@/components/app-shell/role-dashboard-shell";
import { PageHeader } from "@/components/design-system";
import { SuppliersList } from "@/components/supplier/suppliers-list";
import { listSuppliers } from "@/lib/supplier/api";

export default async function AdminSuppliersPage() {
  const suppliers = await listSuppliers();

  return (
    <RoleDashboardShell role="super_admin">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Super Admin"
          title="Supplier Management"
          description="Approve suppliers, manage supplier profiles, review catalogues, orders, invoices and performance."
        />
        <SuppliersList suppliers={suppliers} />
      </div>
    </RoleDashboardShell>
  );
}

