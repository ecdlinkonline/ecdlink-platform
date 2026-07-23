"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Search } from "lucide-react";
import { DataTable, StatusBadge, useToast } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { procurementCategories } from "@/lib/procurement/catalog";
import type { ProcurementCategory } from "@/lib/procurement/types";
import type { SupplierComplianceStatus, SupplierProfile, SupplierStatus } from "@/lib/supplier/types";

const statuses: Array<SupplierStatus | "All"> = ["All", "Pending", "Approved", "Suspended", "Archived"];
const complianceStatuses: Array<SupplierComplianceStatus | "All"> = ["All", "Compliant", "Expiring Soon", "Missing", "Under Review"];

export function SuppliersList({ suppliers }: { suppliers: SupplierProfile[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProcurementCategory | "All">("All");
  const [area, setArea] = useState("All");
  const [status, setStatus] = useState<SupplierStatus | "All">("All");
  const [compliance, setCompliance] = useState<SupplierComplianceStatus | "All">("All");
  const { pushToast } = useToast();
  const areas = useMemo(() => ["All", ...Array.from(new Set(suppliers.flatMap((supplier) => supplier.areasServed)))], [suppliers]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      const searchable = [supplier.companyName, supplier.registrationNumber, supplier.contactPerson, supplier.emailAddress, supplier.areasServed.join(" "), supplier.productCategories.join(" ")].join(" ").toLowerCase();
      return (!search || searchable.includes(search)) &&
        (category === "All" || supplier.productCategories.includes(category)) &&
        (area === "All" || supplier.areasServed.includes(area)) &&
        (status === "All" || supplier.status === status) &&
        (compliance === "All" || supplier.taxComplianceStatus === compliance);
    });
  }, [area, category, compliance, query, status, suppliers]);

  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="dark:text-white">Suppliers</CardTitle>
            <CardDescription className="dark:text-slate-400">Search and filter by category, area, supplier status and tax compliance.</CardDescription>
          </div>
          <Badge variant="muted">{filtered.length} suppliers shown</Badge>
        </div>
        <div className="grid gap-3 xl:grid-cols-[1fr_210px_150px_150px_170px]">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search suppliers" className="w-full bg-transparent outline-none" />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value as ProcurementCategory | "All")} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold dark:border-slate-800 dark:bg-slate-950">
            {(["All", ...procurementCategories] as Array<ProcurementCategory | "All">).map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={area} onChange={(event) => setArea(event.target.value)} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold dark:border-slate-800 dark:bg-slate-950">
            {areas.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value as SupplierStatus | "All")} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold dark:border-slate-800 dark:bg-slate-950">
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={compliance} onChange={(event) => setCompliance(event.target.value as SupplierComplianceStatus | "All")} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold dark:border-slate-800 dark:bg-slate-950">
            {complianceStatuses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={["Supplier", "Areas", "Categories", "Status", "Compliance", "Performance", "Actions"]}
          rows={filtered.map((supplier) => [
            <span key="supplier" className="font-bold text-brand-ink dark:text-white">{supplier.companyName}</span>,
            supplier.areasServed.join(", "),
            `${supplier.productCategories.length} categories`,
            <StatusBadge key="status" status={supplier.status} />,
            <StatusBadge key="compliance" status={supplier.taxComplianceStatus} />,
            `${supplier.performanceScore}%`,
            <div key="actions" className="flex flex-wrap gap-2">
              <Button variant="secondary" className="min-h-9 px-3" onClick={() => pushToast({ title: "Supplier approved", description: `${supplier.companyName} approval placeholder updated.` })}>
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
              <Link href={`/dashboard/super-admin/suppliers/${supplier.id}`}>
                <Button variant="ghost" className="min-h-9 px-3">Open <ArrowRight className="h-4 w-4" /></Button>
              </Link>
            </div>
          ])}
        />
      </CardContent>
    </Card>
  );
}
