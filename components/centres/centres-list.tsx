"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Filter, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EcdCentre } from "@/lib/centres/types";

function badgeVariant(status: string) {
  if (["Active", "Compliant", "Ready", "Registered"].includes(status)) return "success" as const;
  if (["Pending", "Attention", "In Progress"].includes(status)) return "warning" as const;
  return "muted" as const;
}

export function CentresList({ centres, areas }: { centres: EcdCentre[]; areas: string[] }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("All");
  const [registration, setRegistration] = useState("All");
  const [membership, setMembership] = useState("All");
  const [compliance, setCompliance] = useState("All");
  const [procurement, setProcurement] = useState("All");

  const filteredCentres = useMemo(() => {
    return centres.filter((centre) => {
      const matchesQuery = [centre.centreName, centre.area, centre.region, centre.principalName, centre.npoNumber, centre.dbeRegistrationStatus]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesArea = area === "All" || centre.area === area;
      const matchesRegistration = registration === "All" || centre.registrationStatus === registration;
      const matchesMembership = membership === "All" || centre.membershipStatus === membership;
      const matchesCompliance = compliance === "All" || centre.complianceStatus === compliance;
      const matchesProcurement = procurement === "All" || centre.procurementStatus === procurement;

      return matchesQuery && matchesArea && matchesRegistration && matchesMembership && matchesCompliance && matchesProcurement;
    });
  }, [area, centres, compliance, membership, procurement, query, registration]);

  return (
    <div className="space-y-6">
      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="dark:text-white">Centres</CardTitle>
            <CardDescription className="dark:text-slate-400">
              Search and filter the 16 seeded ECD centre profiles.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <Search className="h-4 w-4" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search centres"
                className="w-40 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
            <Button variant="secondary">
              <Filter className="h-4 w-4" />
              {filteredCentres.length} results
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-5">
            {[
              { label: "Area", value: area, setter: setArea, options: ["All", ...areas] },
              { label: "Status", value: registration, setter: setRegistration, options: ["All", "Registered", "In Progress", "Not Registered"] },
              { label: "Membership", value: membership, setter: setMembership, options: ["All", "Active", "Pending", "Expired"] },
              { label: "Compliance", value: compliance, setter: setCompliance, options: ["All", "Compliant", "Attention", "Action Required"] },
              { label: "Procurement", value: procurement, setter: setProcurement, options: ["All", "Active", "Pending", "Inactive"] }
            ].map((filter) => (
              <label key={filter.label} className="block">
                <span className="text-xs font-bold text-slate-500">{filter.label}</span>
                <select
                  value={filter.value}
                  onChange={(event) => filter.setter(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-brand-ink outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  {filter.options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {filteredCentres.length === 0 ? (
            <div className="rounded-lg border border-dashed border-brand-line p-8 text-center dark:border-slate-800">
              <p className="text-lg font-bold text-brand-ink dark:text-white">No centres found</p>
              <p className="mt-2 text-sm text-slate-500">Adjust the search or filters to find matching ECD centres.</p>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-line text-slate-500 dark:border-slate-800">
                  <th className="py-3 font-semibold">Centre</th>
                  <th className="py-3 font-semibold">Area</th>
                  <th className="py-3 font-semibold">Children</th>
                  <th className="py-3 font-semibold">Membership</th>
                  <th className="py-3 font-semibold">Procurement</th>
                  <th className="py-3 font-semibold">Compliance</th>
                  <th className="py-3 font-semibold">Funding</th>
                  <th className="py-3 font-semibold">Updated</th>
                  <th className="py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {filteredCentres.map((centre, index) => (
                  <motion.tr
                    key={centre.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.015 }}
                    className="border-b border-brand-line last:border-0 dark:border-slate-800"
                  >
                    <td className="py-4">
                      <p className="font-bold text-brand-ink dark:text-white">{centre.centreName}</p>
                      <p className="text-xs text-slate-500">{centre.npoNumber}</p>
                    </td>
                    <td className="py-4 text-slate-600 dark:text-slate-300">{centre.area}</td>
                    <td className="py-4 font-semibold text-brand-navy dark:text-blue-200">{centre.numberOfChildren}</td>
                    <td className="py-4"><Badge variant={badgeVariant(centre.membershipStatus)}>{centre.membershipStatus}</Badge></td>
                    <td className="py-4"><Badge variant={badgeVariant(centre.procurementStatus)}>{centre.procurementStatus}</Badge></td>
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <Progress value={centre.complianceStatus === "Compliant" ? 92 : centre.complianceStatus === "Attention" ? 68 : 36} className="w-24" />
                        <span className="text-xs font-semibold text-slate-500">{centre.complianceStatus}</span>
                      </div>
                    </td>
                    <td className="py-4"><Badge variant={badgeVariant(centre.fundingReadinessStatus)}>{centre.fundingReadinessStatus}</Badge></td>
                    <td className="py-4 text-slate-500">{centre.lastUpdatedDate}</td>
                    <td className="py-4">
                      <Link href={`/dashboard/super-admin/centres/${centre.id}`}>
                        <Button variant="ghost">
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
