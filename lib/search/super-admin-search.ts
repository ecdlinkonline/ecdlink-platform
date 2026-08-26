export const superAdminSearchModules = [
  { id: "centres", label: "Centres", href: "/dashboard/super-admin/centres", keywords: ["centre", "centres", "ecd centre"] },
  { id: "memberships", label: "Memberships", href: "/dashboard/super-admin/memberships", keywords: ["membership", "memberships", "renewal"] },
  { id: "procurement", label: "Procurement", href: "/dashboard/super-admin/procurement", keywords: ["procurement", "orders", "purchasing"] },
  { id: "suppliers", label: "Suppliers", href: "/dashboard/super-admin/suppliers", keywords: ["supplier", "suppliers", "vendors"] },
  { id: "partners", label: "Partners", href: "/dashboard/super-admin/partners", keywords: ["partner", "partners", "donor", "csi"] },
  { id: "funding", label: "Funding", href: "/dashboard/super-admin/funding", keywords: ["funding", "applications", "opportunities", "grants"] },
  { id: "compliance", label: "Compliance", href: "/dashboard/super-admin/compliance", keywords: ["compliance", "documents", "evidence"] },
  { id: "reports", label: "Reports", href: "/dashboard/super-admin/reports", keywords: ["report", "reports", "reporting"] },
  { id: "intelligence", label: "Intelligence", href: "/dashboard/super-admin/intelligence", keywords: ["intelligence", "insights", "assistant"] }
] as const;

export type SuperAdminSearchModule = (typeof superAdminSearchModules)[number]["id"];

export type SuperAdminSearchResult = {
  id: string;
  module: SuperAdminSearchModule;
  moduleLabel: string;
  title: string;
  context: string;
  href: string;
};

export function moduleLabel(module: SuperAdminSearchModule) {
  return superAdminSearchModules.find((candidate) => candidate.id === module)?.label ?? module;
}

export function buildCentreSearchResult(centre: {
  id: string;
  slug: string;
  centreName: string;
  principalName: string | null;
  area: string | null;
  region: string | null;
  province: string | null;
  npoNumber: string | null;
}): SuperAdminSearchResult {
  const location = centre.area ?? centre.region ?? centre.province;
  const context = [centre.principalName ? `Principal: ${centre.principalName}` : null, location, centre.npoNumber ? `NPO ${centre.npoNumber}` : null]
    .filter(Boolean)
    .join(" · ");

  return {
    id: `centre-${centre.id}`,
    module: "centres",
    moduleLabel: moduleLabel("centres"),
    title: centre.centreName,
    context: context || "ECD centre profile",
    href: `/dashboard/super-admin/centres/${centre.slug}`
  };
}

export function buildSupplierSearchResult(supplier: {
  id: string;
  slug: string;
  companyName: string;
  contactPerson: string | null;
  city: string | null;
  province: string | null;
  registrationNumber: string | null;
}): SuperAdminSearchResult {
  const context = [supplier.contactPerson, supplier.city ?? supplier.province, supplier.registrationNumber ? `Reg ${supplier.registrationNumber}` : null]
    .filter(Boolean)
    .join(" · ");

  return {
    id: `supplier-${supplier.id}`,
    module: "suppliers",
    moduleLabel: moduleLabel("suppliers"),
    title: supplier.companyName,
    context: context || "Supplier profile",
    href: `/dashboard/super-admin/suppliers/${supplier.slug}`
  };
}

export function buildModuleShortcutResults(query: string): SuperAdminSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return superAdminSearchModules
    .filter((module) => module.keywords.some((keyword) => keyword.includes(normalizedQuery) || normalizedQuery.includes(keyword)))
    .map((module) => ({
      id: `module-${module.id}`,
      module: module.id,
      moduleLabel: module.label,
      title: module.label,
      context: module.id === "reports" ? "Operational reporting overview" : `Open the ${module.label.toLowerCase()} workspace`,
      href: module.href
    }));
}

export function limitResultsPerModule(results: SuperAdminSearchResult[], limit: number) {
  const counts = new Map<SuperAdminSearchModule, number>();
  return results.filter((result) => {
    const count = counts.get(result.module) ?? 0;
    if (count >= limit) return false;
    counts.set(result.module, count + 1);
    return true;
  });
}
