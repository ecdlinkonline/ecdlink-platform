"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, Search } from "lucide-react";
import { DataTable, StatusBadge } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatFundingCurrency, fundingOpportunityTypes } from "@/lib/funding/format";
import type { FundingApplicationStatus, FundingFilters, FundingOpportunityType, FundingReadinessRecord } from "@/lib/funding/types";

const statuses: Array<FundingApplicationStatus | "All"> = ["All", "Draft", "In Progress", "Ready", "Submitted", "Approved", "Rejected"];
const readinessBands = ["All", "80+", "50-79", "Below 50"] as const;

export function FundingRecordsTable({ records, filters, regions }: { records: FundingReadinessRecord[]; filters: FundingFilters; regions: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.query ?? "");
  const region = filters.region ?? "All";
  const status = filters.status ?? "All";
  const funderType = filters.funderType ?? "All";
  const readinessBand = filters.readinessBand ?? "All";

  const updateFilter = useCallback((key: keyof FundingFilters, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "All") params.delete(key);
    else params.set(key, value);
    const nextUrl = params.size ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => router.replace(nextUrl, { scroll: false }));
  }, [pathname, router, searchParams]);

  useEffect(() => {
    setQuery(filters.query ?? "");
  }, [filters.query]);

  useEffect(() => {
    const activeQuery = filters.query ?? "";
    if (query === activeQuery) return;
    const timeout = window.setTimeout(() => updateFilter("query", query.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [filters.query, query, updateFilter]);

  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="dark:text-white">Centre funding readiness</CardTitle>
            <CardDescription className="dark:text-slate-400">Search and filter by centre, region, status, readiness score and funder type.</CardDescription>
          </div>
          <Badge variant="muted">{records.length} centres shown</Badge>
        </div>
        <div className="grid gap-3 xl:grid-cols-[1fr_150px_160px_190px_140px]">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search centres or projects" className="w-full bg-transparent outline-none" />
          </label>
          <select value={region} onChange={(event) => updateFilter("region", event.target.value)} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {["All", ...regions].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(event) => updateFilter("status", event.target.value)} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={funderType} onChange={(event) => updateFilter("funderType", event.target.value)} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {(["All", ...fundingOpportunityTypes] as Array<FundingOpportunityType | "All">).map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={readinessBand} onChange={(event) => updateFilter("readinessBand", event.target.value)} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {readinessBands.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={["Centre", "Region", "Status", "Readiness", "Funder Type", "Projects", "Requested", "Actions"]}
          rows={records.map((record) => {
            const requested = record.projectProfiles.reduce((sum, project) => sum + project.requestedAmount, 0);
            return [
              <span key="centre" className="font-bold text-brand-ink dark:text-white">{record.centreName}</span>,
              `${record.area}, ${record.region}`,
              <StatusBadge key="status" status={record.status} />,
              <div key="score" className="min-w-32">
                <div className="mb-1 flex justify-between text-xs font-semibold"><span>{record.readinessScore}%</span><span>ready</span></div>
                <Progress value={record.readinessScore} />
              </div>,
              record.funderType,
              String(record.projectProfiles.length),
              <span key="requested" className="font-bold text-brand-navy dark:text-blue-200">{formatFundingCurrency(requested)}</span>,
              <Link key="action" href={`/dashboard/super-admin/funding/${record.centreId}`}>
                <Button variant="secondary" className="min-h-9 px-3">
                  <FileText className="h-4 w-4" />
                  Review
                </Button>
              </Link>
            ];
          })}
        />
      </CardContent>
    </Card>
  );
}
