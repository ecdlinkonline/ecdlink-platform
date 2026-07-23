"use client";

import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { DataTable, StatusBadge, useToast } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatFundingCurrency, fundingOpportunityTypes } from "@/lib/funding/format";
import type { FundingApplicationStatus, FundingOpportunityType, FundingReadinessRecord } from "@/lib/funding/types";

const statuses: Array<FundingApplicationStatus | "All"> = ["All", "Draft", "In Progress", "Ready", "Submitted", "Approved", "Rejected"];
const readinessBands = ["All", "80+", "50-79", "Below 50"] as const;

export function FundingRecordsTable({ records }: { records: FundingReadinessRecord[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All");
  const [status, setStatus] = useState<FundingApplicationStatus | "All">("All");
  const [funderType, setFunderType] = useState<FundingOpportunityType | "All">("All");
  const [readinessBand, setReadinessBand] = useState<(typeof readinessBands)[number]>("All");
  const { pushToast } = useToast();
  const regions = useMemo(() => ["All", ...Array.from(new Set(records.map((record) => record.region)))], [records]);

  const filteredRecords = useMemo(() => {
    const search = query.trim().toLowerCase();
    return records.filter((record) => {
      const searchable = [
        record.centreName,
        record.region,
        record.area,
        record.status,
        record.funderType,
        ...record.projectProfiles.map((project) => project.title)
      ].join(" ").toLowerCase();
      const bandMatch =
        readinessBand === "All" ||
        (readinessBand === "80+" && record.readinessScore >= 80) ||
        (readinessBand === "50-79" && record.readinessScore >= 50 && record.readinessScore < 80) ||
        (readinessBand === "Below 50" && record.readinessScore < 50);

      return (
        (!search || searchable.includes(search)) &&
        (region === "All" || record.region === region) &&
        (status === "All" || record.status === status) &&
        (funderType === "All" || record.funderType === funderType) &&
        bandMatch
      );
    });
  }, [funderType, query, readinessBand, records, region, status]);

  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="dark:text-white">Centre funding readiness</CardTitle>
            <CardDescription className="dark:text-slate-400">Search and filter by centre, region, status, readiness score and funder type.</CardDescription>
          </div>
          <Badge variant="muted">{filteredRecords.length} centres shown</Badge>
        </div>
        <div className="grid gap-3 xl:grid-cols-[1fr_150px_160px_190px_140px]">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search centres or projects" className="w-full bg-transparent outline-none" />
          </label>
          <select value={region} onChange={(event) => setRegion(event.target.value)} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {regions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value as FundingApplicationStatus | "All")} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={funderType} onChange={(event) => setFunderType(event.target.value as FundingOpportunityType | "All")} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {(["All", ...fundingOpportunityTypes] as Array<FundingOpportunityType | "All">).map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={readinessBand} onChange={(event) => setReadinessBand(event.target.value as (typeof readinessBands)[number])} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {readinessBands.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={["Centre", "Region", "Status", "Readiness", "Funder Type", "Projects", "Requested", "Actions"]}
          rows={filteredRecords.map((record) => {
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
              <Button
                key="action"
                variant="secondary"
                className="min-h-9 px-3"
                onClick={() => pushToast({ title: "Admin note saved", description: `${record.centreName} funding review placeholder updated.` })}
              >
                <FileText className="h-4 w-4" />
                Review
              </Button>
            ];
          })}
        />
      </CardContent>
    </Card>
  );
}
