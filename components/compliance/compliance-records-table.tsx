"use client";

import { useMemo, useState } from "react";
import { Archive, Bell, FileCheck2, RefreshCw, Search, XCircle } from "lucide-react";
import { DataTable, StatusBadge, useToast } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CentreComplianceRecord, ComplianceDocumentStatus, ComplianceScoreLight } from "@/lib/compliance/types";

const documentStatuses: Array<ComplianceDocumentStatus | "All"> = ["All", "Uploaded", "Missing", "Expired", "Expiring Soon", "Verified", "Rejected"];
const scoreLights: Array<ComplianceScoreLight | "All"> = ["All", "Green", "Amber", "Red"];

export function ComplianceRecordsTable({ records }: { records: CentreComplianceRecord[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All");
  const [documentStatus, setDocumentStatus] = useState<ComplianceDocumentStatus | "All">("All");
  const [scoreLight, setScoreLight] = useState<ComplianceScoreLight | "All">("All");
  const { pushToast } = useToast();
  const regions = useMemo(() => ["All", ...Array.from(new Set(records.map((record) => record.region)))], [records]);

  async function documentAction(documentId: string, action: "verify" | "reject" | "request-resubmission" | "archive", body?: Record<string, string>) {
    const response = await fetch(`/api/compliance/documents/${documentId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => null);
    pushToast({
      title: response.ok ? "Compliance action saved" : "Compliance action failed",
      description: response.ok ? "Refresh to view updated compliance status." : payload?.error ?? "Please try again."
    });
  }

  const filteredRecords = useMemo(() => {
    const search = query.trim().toLowerCase();
    return records.filter((record) => {
      const searchable = [
        record.centreName,
        record.region,
        record.area,
        record.contactPerson,
        record.scoreLight,
        ...record.documents.map((document) => `${document.type} ${document.status}`)
      ].join(" ").toLowerCase();

      return (
        (!search || searchable.includes(search)) &&
        (region === "All" || record.region === region) &&
        (scoreLight === "All" || record.scoreLight === scoreLight) &&
        (documentStatus === "All" || record.documents.some((document) => document.status === documentStatus))
      );
    });
  }, [documentStatus, query, records, region, scoreLight]);

  return (
    <Card className="dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="dark:text-white">Centre-by-centre compliance</CardTitle>
            <CardDescription className="dark:text-slate-400">Search and filter by centre, region, document status and traffic-light score.</CardDescription>
          </div>
          <Badge variant="muted">{filteredRecords.length} centres shown</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_160px_180px_150px]">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search centres or documents"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <select value={region} onChange={(event) => setRegion(event.target.value)} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {regions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={documentStatus} onChange={(event) => setDocumentStatus(event.target.value as ComplianceDocumentStatus | "All")} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {documentStatuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={scoreLight} onChange={(event) => setScoreLight(event.target.value as ComplianceScoreLight | "All")} className="rounded-lg border border-brand-line bg-white px-3 text-sm font-semibold text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {scoreLights.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={["Centre", "Region", "Score", "Documents", "Missing", "Expiring", "Status", "Actions"]}
          rows={filteredRecords.map((record) => {
            const missing = record.documents.filter((document) => document.status === "Missing").length;
            const expiring = record.documents.filter((document) => document.status === "Expiring Soon" || document.status === "Expired").length;
            const verified = record.documents.filter((document) => document.status === "Verified").length;
            return [
              <span key="centre" className="font-bold text-brand-ink dark:text-white">{record.centreName}</span>,
              `${record.area}, ${record.region}`,
              <div key="score" className="min-w-32">
                <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                  <span>{record.score}%</span>
                  <span>{record.scoreLight}</span>
                </div>
                <Progress value={record.score} />
              </div>,
              `${verified}/${record.documents.length} verified`,
              <StatusBadge key="missing" status={missing > 0 ? `${missing} Missing` : "Verified"} />,
              <StatusBadge key="expiring" status={expiring > 0 ? `${expiring} Expiring Soon` : "Verified"} />,
              <StatusBadge key="status" status={record.scoreLight} />,
              <div key="actions" className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="min-h-9 px-3"
                  onClick={() => {
                    const target = record.documents.find((document) => document.status === "Uploaded" || document.verificationStatus === "Pending Review");
                    if (target) void documentAction(target.id, "verify", { notes: "Verified from compliance dashboard." });
                    else pushToast({ title: "No pending document", description: `${record.centreName} has no uploaded document awaiting verification.` });
                  }}
                >
                  <FileCheck2 className="h-4 w-4" />
                  Verify
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-9 px-3 text-red-700"
                  onClick={() => {
                    const target = record.documents.find((document) => document.status !== "Verified" && document.status !== "Missing");
                    const reason = window.prompt("Reason for rejection?");
                    if (target && reason) void documentAction(target.id, "reject", { reason });
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-9 px-3"
                  onClick={() => {
                    const target = record.documents.find((document) => document.status === "Rejected" || document.status === "Expired");
                    const reason = window.prompt("Resubmission reason?");
                    if (target && reason) void documentAction(target.id, "request-resubmission", { reason });
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Resubmit
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-9 px-3"
                  onClick={() => pushToast({ title: "Renewal reminder queued", description: `${record.centreName} will receive compliance reminders.` })}
                >
                  <Bell className="h-4 w-4" />
                  Remind
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-9 px-3"
                  onClick={() => {
                    const target = record.documents.find((document) => document.status === "Rejected" || document.status === "Expired");
                    if (target && window.confirm(`Archive ${target.type}?`)) void documentAction(target.id, "archive");
                  }}
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </Button>
              </div>
            ];
          })}
        />
      </CardContent>
    </Card>
  );
}
