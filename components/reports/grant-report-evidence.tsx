"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LockKeyhole, Upload } from "lucide-react";
import { useToast } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowActionDialog, type WorkflowActionResult } from "@/components/workflows/workflow-action-dialog";
import type { GrantReportEvidenceList } from "@/lib/repositories/grant-report-documents";
import { formatGrantLabel } from "@/lib/grant-reports/types";

const documentTypes = ["OTHER", "INVOICE", "BANK_STATEMENT", "PROOF_OF_PAYMENT", "RECEIPT", "PROCUREMENT_EVIDENCE", "INDICATOR_EVIDENCE", "BENEFICIARY_EVIDENCE", "SIGNED_REPORT", "AUDITED_FINANCIAL_STATEMENTS"] as const;
type DocumentType = (typeof documentTypes)[number];

const documentTypeLabels: Record<DocumentType, string> = {
  OTHER: "Other Supporting Document",
  INVOICE: "Invoice",
  BANK_STATEMENT: "Bank Statement",
  PROOF_OF_PAYMENT: "Proof of Payment",
  RECEIPT: "Receipt",
  PROCUREMENT_EVIDENCE: "Procurement / Supplier Evidence",
  INDICATOR_EVIDENCE: "Programme / Indicator Evidence",
  BENEFICIARY_EVIDENCE: "Beneficiary / Attendance Evidence",
  SIGNED_REPORT: "Signed Report",
  AUDITED_FINANCIAL_STATEMENTS: "Audited Financial Statements",
};

const inputClass = "mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-navy disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-800";

export type GrantReportEvidenceProps = {
  reportId: string;
  versionNumber: number;
  reportType: string;
  editable: boolean;
  auditedFinancialStatementsRequired: boolean;
  hasAuditedFinancialStatements: boolean;
  indicators: Array<{ id: string; label: string }>;
  financialLines: Array<{ id: string; lineType: string; label: string }>;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(new Date(value));
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1_000_000) return `${Math.ceil(bytes / 1_000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function GrantReportEvidence(props: GrantReportEvidenceProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const requestGeneration = useRef(0);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<GrantReportEvidenceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("OTHER");
  const [linkType, setLinkType] = useState<"none" | "indicator" | "financialLine">("none");
  const [linkId, setLinkId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const loadEvidence = useCallback(async (signal: AbortSignal, generation: number) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ versionNumber: String(props.versionNumber), page: String(page), pageSize: "20" });
      const response = await fetch(`/api/grant-reports/${props.reportId}/documents?${query}`, { signal });
      const body = await response.json();
      if (generation !== requestGeneration.current) return;
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Report evidence could not be loaded.");
      setData(body.data);
    } catch (caught) {
      if (signal.aborted || generation !== requestGeneration.current) return;
      setData(null);
      setError(caught instanceof Error ? caught.message : "Report evidence could not be loaded.");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [page, props.reportId, props.versionNumber]);

  useEffect(() => {
    const controller = new AbortController();
    const generation = ++requestGeneration.current;
    void loadEvidence(controller.signal, generation);
    return () => controller.abort();
  }, [loadEvidence, revision]);

  function resetLink(nextType: DocumentType) {
    setDocumentType(nextType);
    if (nextType === "INDICATOR_EVIDENCE") {
      setLinkType("indicator");
      setLinkId("");
    }
  }

  async function upload() {
    if (!props.editable || uploading) return;
    if (!title.trim() || !file) {
      setError("Enter a document title and select a private file.");
      return;
    }
    if (documentType === "INDICATOR_EVIDENCE" && (linkType !== "indicator" || !linkId)) {
      setError("Select the indicator supported by this evidence.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title.trim());
      form.set("documentType", documentType);
      if (description.trim()) form.set("description", description.trim());
      if (linkType === "indicator" && linkId) form.set("indicatorId", linkId);
      if (linkType === "financialLine" && linkId) form.set("financialLineId", linkId);
      const response = await fetch(`/api/grant-reports/${props.reportId}/documents`, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error ?? "The report document could not be uploaded.");
      setTitle("");
      setDescription("");
      setDocumentType("OTHER");
      setLinkType("none");
      setLinkId("");
      setFile(null);
      setPage(1);
      setRevision((value) => value + 1);
      router.refresh();
      pushToast({ title: "Evidence uploaded", description: "The private document is linked to this report version." });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The report document could not be uploaded.";
      setError(message);
      pushToast({ title: "Upload failed", description: message });
    } finally {
      setUploading(false);
    }
  }

  async function remove(documentId: string): Promise<WorkflowActionResult> {
    try {
      const response = await fetch(`/api/grant-reports/${props.reportId}/documents/${documentId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok || !body.ok) return { ok: false, error: body.error ?? "The evidence could not be removed from this report." };
      if (data?.documents.length === 1 && page > 1) setPage((value) => value - 1);
      else setRevision((value) => value + 1);
      router.refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: "The evidence could not be removed from this report." };
    }
  }

  const linkOptions: Array<{ id: string; label: string; context?: string }> = linkType === "indicator"
    ? props.indicators
    : linkType === "financialLine"
      ? props.financialLines.map((line) => ({ id: line.id, label: line.label, context: formatGrantLabel(line.lineType) }))
      : [];
  const canMutate = props.editable && (data?.version.editable ?? true);

  return <Card className="dark:border-slate-800 dark:bg-slate-900">
    <CardHeader>
      <CardTitle className="dark:text-white">Evidence & Supporting Documents</CardTitle>
      <CardDescription>Private supporting evidence belongs to this report version. Preview and download links are authorised and time-limited.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      {!canMutate ? <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><span>This report version is read-only. Its evidence can be reviewed and downloaded but cannot be changed.</span></div> : null}
      {props.auditedFinancialStatementsRequired ? <p className={`rounded-lg p-3 text-sm font-semibold ${props.hasAuditedFinancialStatements ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>Final report requirement: Audited Financial Statements {props.hasAuditedFinancialStatements ? "uploaded" : "still required"}.</p> : null}
      {canMutate ? <div className="grid gap-3 rounded-lg border border-brand-line p-4 md:grid-cols-2">
        <label className="text-sm font-bold">Document Title<input className={inputClass} value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="text-sm font-bold">Document Type<select className={inputClass} value={documentType} onChange={(event) => resetLink(event.target.value as DocumentType)}>{documentTypes.filter((type) => props.reportType === "FINAL" || type !== "AUDITED_FINANCIAL_STATEMENTS").map((type) => <option key={type} value={type}>{documentTypeLabels[type]}</option>)}</select></label>
        <label className="text-sm font-bold md:col-span-2">Description / Notes<textarea className={inputClass} rows={2} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label className="text-sm font-bold">Reporting Context<select className={inputClass} value={linkType} disabled={documentType === "INDICATOR_EVIDENCE"} onChange={(event) => { setLinkType(event.target.value as typeof linkType); setLinkId(""); }}><option value="none">General report evidence</option><option value="financialLine">Financial line</option><option value="indicator">Programme indicator</option></select></label>
        {linkType !== "none" ? <label className="text-sm font-bold">{linkType === "indicator" ? "Indicator" : "Financial Line"}<select className={inputClass} value={linkId} onChange={(event) => setLinkId(event.target.value)}><option value="">Select {linkType === "indicator" ? "indicator" : "financial line"}</option>{linkOptions.map((option) => <option key={option.id} value={option.id}>{option.context ? `${option.context} · ` : ""}{option.label}</option>)}</select></label> : null}
        <label className="text-sm font-bold">Private File<input className={inputClass} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <div className="flex items-end"><Button type="button" disabled={uploading} onClick={() => void upload()}><Upload className="h-4 w-4" />{uploading ? "Uploading…" : "Upload evidence"}</Button></div>
      </div> : null}
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {loading ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Loading report evidence…</p> : null}
      {!loading && data ? <>
        <div className="space-y-3">{data.documents.map((document) => <article key={document.id} className="flex flex-col gap-4 rounded-lg border border-brand-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-brand-ink dark:text-white">{document.title}</p><Badge variant="muted">{documentTypeLabels[document.documentType as DocumentType] ?? formatGrantLabel(document.documentType)}</Badge></div><p className="mt-1 break-words text-xs text-slate-500">{document.originalFilename} · {fileSizeLabel(document.fileSize)} · {displayDate(document.uploadedAt)} · {document.uploadedBy}</p>{document.description ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{document.description}</p> : null}{document.financialLine ? <p className="mt-1 text-xs font-semibold text-slate-500">Financial line: {formatGrantLabel(document.financialLine.lineType)} · {document.financialLine.label}</p> : null}{document.indicator ? <p className="mt-1 text-xs font-semibold text-slate-500">Indicator: {document.indicator.label}</p> : null}</div>
          <div className="flex shrink-0 flex-wrap gap-2"><a href={`/api/grant-reports/${props.reportId}/documents/${document.id}?preview=1`} target="_blank" rel="noreferrer"><Button type="button" variant="secondary">Preview</Button></a><a href={`/api/grant-reports/${props.reportId}/documents/${document.id}?download=1`}><Button type="button" variant="ghost">Download</Button></a>{canMutate ? <WorkflowActionDialog<Record<string, never>> title="Remove evidence from report" description={`Remove “${document.title}” from this draft report? The retained private file is not physically deleted.`} trigger={{ label: "Remove", variant: "ghost" }} confirmationButton={{ label: "Remove from report", loadingLabel: "Removing…", tone: "danger" }} fields={[]} initialValues={{}} action={() => remove(document.id)} successToast={{ title: "Evidence removed", description: "The document is no longer linked to this draft report. The private file was retained." }} errorToast={{ title: "Removal failed", fallbackDescription: "The evidence could not be removed from this report." }} /> : null}</div>
        </article>)}{data.documents.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500"><FileText className="mx-auto mb-2 h-6 w-6" />No evidence has been uploaded for this report version.</p> : null}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-line pt-4 text-sm"><p className="text-slate-500">{data.pagination.total} document{data.pagination.total === 1 ? "" : "s"} · Page {data.pagination.page} of {data.pagination.totalPages}</p><div className="flex gap-2"><Button type="button" variant="secondary" disabled={!data.pagination.hasPreviousPage} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Button type="button" variant="secondary" disabled={!data.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
      </> : null}
    </CardContent>
  </Card>;
}
