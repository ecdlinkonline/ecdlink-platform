"use client";

import Link from "next/link";
import { Bell, FileUp, ShieldCheck, Upload } from "lucide-react";
import { Alert, DataTable, KpiCard, PageHeader, StatusBadge, useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatComplianceDate, renewalReminderOptions } from "@/lib/compliance/format";
import type { CentreComplianceRecord } from "@/lib/compliance/types";

export function CentreComplianceView({ record }: { record: CentreComplianceRecord }) {
  const { pushToast } = useToast();
  const missingDocuments = record.documents.filter((document) => document.status === "Missing" || document.status === "Rejected" || document.status === "Expired");
  const expiringDocuments = record.documents.filter((document) => document.status === "Expiring Soon");
  const verifiedDocuments = record.documents.filter((document) => document.status === "Verified");

  async function uploadPlaceholder(document: CentreComplianceRecord["documents"][number]) {
    const response = await fetch(document.status === "Rejected" || document.status === "Expired" ? `/api/compliance/documents/${document.id}/replace` : "/api/compliance/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requirementId: document.requirementId ?? document.id,
        documentNumber: document.documentNumber ?? `DOC-${Date.now()}`,
        issueDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        file: {
          storageProvider: "placeholder",
          storageKey: `placeholder/${record.centreId}/${document.type}.pdf`,
          originalFilename: `${document.type}.pdf`,
          mimeType: "application/pdf",
          fileSize: 120000,
          checksum: `placeholder-${Date.now()}`
        }
      })
    });
    const body = await response.json().catch(() => null);
    pushToast({
      title: response.ok ? "Upload placeholder created" : "Upload could not be created",
      description: response.ok ? `${document.type} is awaiting review.` : body?.error ?? "Please try again."
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ECD Centre"
        title="My Compliance"
        description="Track required documents, expiry dates, missing uploads, admin verification notes and your traffic-light readiness score."
        actions={<Link href="/dashboard/ecd-centre"><Button variant="secondary">Back to centre dashboard</Button></Link>}
      />

      <Alert
        tone={record.scoreLight === "Green" ? "success" : record.scoreLight === "Amber" ? "warning" : "warning"}
        title={`Compliance score: ${record.scoreLight}`}
        description="Upload placeholders are ready for future secure document storage. Funding and procurement links are intentionally placeholders."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Readiness Score" value={`${record.score}%`} description={record.scoreLight} icon={ShieldCheck} tone={record.scoreLight === "Green" ? "green" : "warning"} />
        <KpiCard label="Verified" value={String(verifiedDocuments.length)} description="Documents accepted" icon={ShieldCheck} tone="green" />
        <KpiCard label="Missing Checklist" value={String(missingDocuments.length)} description="Uploads or renewals needed" icon={FileUp} tone="warning" />
        <KpiCard label="Expiring Soon" value={String(expiringDocuments.length)} description="Renewal reminders active" icon={Bell} tone="warning" />
      </div>

      <Card className="dark:border-slate-800 dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="dark:text-white">Traffic-light compliance score</CardTitle>
          <CardDescription className="dark:text-slate-400">Green is 80% and above. Amber is 50% to 79%. Red is below 50%.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex justify-between text-sm font-semibold">
            <span>{record.centreName}</span>
            <span>{record.score}%</span>
          </div>
          <Progress value={record.score} />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="dark:text-white">Document checklist</CardTitle>
            <CardDescription className="dark:text-slate-400">All required compliance records for ECD centre operations and funding readiness.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={["Document", "Status", "Expiry", "Uploaded", "Admin note", "Upload"]}
              rows={record.documents.map((document) => [
                <span key="document" className="font-bold text-brand-ink dark:text-white">{document.type}</span>,
                <StatusBadge key="status" status={document.status} />,
                formatComplianceDate(document.expiryDate),
                formatComplianceDate(document.uploadedAt),
                document.verificationNote,
                <Button
                  key="upload"
                  variant="secondary"
                  className="min-h-9 px-3"
                  onClick={() => uploadPlaceholder(document)}
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              ])}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Missing document checklist</CardTitle>
              <CardDescription className="dark:text-slate-400">Priority items to move your centre toward green.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {missingDocuments.map((document) => (
                <div key={document.id} className="rounded-lg border border-brand-line p-4 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-brand-ink dark:text-white">{document.type}</p>
                    <StatusBadge status={document.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{document.verificationNote}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Renewal reminders</CardTitle>
              <CardDescription className="dark:text-slate-400">Expiry reminders for centre and admin users.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {renewalReminderOptions.map((item) => (
                <div key={item} className="flex items-center justify-between rounded-lg border border-brand-line p-4 dark:border-slate-800">
                  <span className="flex items-center gap-3 text-sm font-semibold text-brand-ink dark:text-white">
                    <Bell className="h-4 w-4 text-brand-green" />
                    {item}
                  </span>
                  <StatusBadge status="Active" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="dark:text-white">Admin verification notes</CardTitle>
              <CardDescription className="dark:text-slate-400">Notes from the ECDLink compliance desk.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {record.adminVerificationNotes.map((note) => (
                <div key={note} className="rounded-lg bg-brand-accent p-4 text-sm leading-6 text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  {note}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
