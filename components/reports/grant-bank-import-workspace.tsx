"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, Download, Eye, FileUp, Landmark, Pencil, Trash2 } from "lucide-react";
import { BreadcrumbLabel } from "@/components/app-shell/breadcrumb-label";
import { PageHeader, StatusBadge, useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGrantCurrency, formatGrantLabel, reportTypeLabels } from "@/lib/grant-reports/types";
import type { GrantBankImportWorkspaceDto, GrantBankStatementDto } from "@/lib/grant-reports/bank-import";

const inputClass = "mt-1 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-navy disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function displayDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`)) : "Not provided";
}

function fileSize(bytes: number) {
  return bytes < 1_000_000 ? `${Math.ceil(bytes / 1_000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function assignStatementSlots(data: GrantBankImportWorkspaceDto) {
  const remaining = [...data.statements];
  return Array.from({ length: 3 }, (_, index) => {
    const expected = data.expectedMonths[index] ?? { value: "", label: `Statement ${index + 1}` };
    const exact = remaining.findIndex((statement) => statement.statementMonth === expected.value);
    const statement = exact >= 0 ? remaining.splice(exact, 1)[0] : remaining.shift() ?? null;
    return { index, expected, statement };
  });
}

export function GrantBankImportWorkspace({ initialData }: { initialData: GrantBankImportWorkspaceDto }) {
  const { pushToast } = useToast();
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const slots = assignStatementSlots(data);

  async function upload(slot: (typeof slots)[number], file: File, replaceStatementId?: string) {
    setBusy(replaceStatementId ?? `slot-${slot.index}`);
    const form = new FormData();
    form.set("file", file);
    form.set("statementMonth", slot.expected.value);
    form.set("currency", data.currency);
    if (replaceStatementId) form.set("replaceStatementId", replaceStatementId);
    try {
      const response = await fetch(`/api/grant-reports/${data.reportId}/bank-import/${data.id}/statements`, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "The bank statement could not be uploaded.");
      setData(result.data);
      pushToast({ title: replaceStatementId ? "Statement replaced" : "Statement uploaded", description: "The file is stored privately and is awaiting processing." });
    } catch (error) {
      pushToast({ title: "Upload failed", description: error instanceof Error ? error.message : "The bank statement could not be uploaded." });
    } finally { setBusy(null); }
  }

  async function saveMetadata(statementId: string, form: FormData) {
    setBusy(statementId);
    const payload = Object.fromEntries(["statementMonth", "periodStart", "periodEnd", "statementDate", "bankName", "accountHolderName", "maskedAccountReference", "openingBalance", "closingBalance", "currency"].map((key) => [key, String(form.get(key) ?? "")]));
    try {
      const response = await fetch(`/api/grant-reports/${data.reportId}/bank-import/${data.id}/statements/${statementId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "The statement details could not be saved.");
      setData(result.data); setEditing(null);
      pushToast({ title: "Statement details saved", description: "The manually entered bank statement details were updated." });
    } catch (error) {
      pushToast({ title: "Save failed", description: error instanceof Error ? error.message : "The statement details could not be saved." });
    } finally { setBusy(null); }
  }

  async function remove(statementId: string) {
    setBusy(statementId);
    try {
      const response = await fetch(`/api/grant-reports/${data.reportId}/bank-import/${data.id}/statements/${statementId}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "The bank statement could not be removed.");
      setData(result.data); setConfirmRemove(null);
      pushToast({ title: "Statement removed", description: "The private statement file was removed from this editable import." });
    } catch (error) {
      pushToast({ title: "Removal failed", description: error instanceof Error ? error.message : "The bank statement could not be removed." });
    } finally { setBusy(null); }
  }

  return <div className="space-y-6 pb-10">
    <BreadcrumbLabel label="Bank Statement Import" />
    <PageHeader eyebrow="Super Admin · Grant Reports" title="Bank Statement Import" description={`Upload the three monthly statements for Q${data.quarter} ${data.financialYear}. Files remain private and no report values are changed automatically.`} actions={<Link href={`/dashboard/super-admin/reports/${data.reportId}`}><Button variant="secondary"><ArrowLeft className="h-4 w-4" />Back to Report</Button></Link>} />

    <Card className="dark:border-slate-800 dark:bg-slate-900"><CardContent className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-6">
      <Summary label="Centre" value={data.centreName} />
      <Summary label="Award" value={`${data.awardNumber} · ${data.awardTitle}`} />
      <Summary label="Quarter" value={`Q${data.quarter} ${data.financialYear}`} />
      <Summary label="Reporting Period" value={`${displayDate(data.reportingPeriodStart)} – ${displayDate(data.reportingPeriodEnd)}`} />
      <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Import Status</p><div className="mt-1"><StatusBadge status={formatGrantLabel(data.status)} /></div></div>
      <Summary label="Statements Uploaded" value={`${data.statementsUploaded} / 3`} />
    </CardContent></Card>

    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-brand-navy"><strong>Manual reporting remains available.</strong> These files are stored for later extraction and review. Phase 1 does not read transactions, calculate totals, or change the {reportTypeLabels[data.reportType]} report.</div>

    <div className="grid gap-5 xl:grid-cols-3">{slots.map((slot) => <StatementCard key={slot.index} slot={slot} data={data} busy={busy} editing={editing} confirmRemove={confirmRemove} setEditing={setEditing} setConfirmRemove={setConfirmRemove} onUpload={upload} onSave={saveMetadata} onRemove={remove} />)}</div>
  </div>;
}

function StatementCard({ slot, data, busy, editing, confirmRemove, setEditing, setConfirmRemove, onUpload, onSave, onRemove }: {
  slot: ReturnType<typeof assignStatementSlots>[number]; data: GrantBankImportWorkspaceDto; busy: string | null; editing: string | null; confirmRemove: string | null;
  setEditing: (id: string | null) => void; setConfirmRemove: (id: string | null) => void;
  onUpload: (slot: ReturnType<typeof assignStatementSlots>[number], file: File, replaceStatementId?: string) => Promise<void>;
  onSave: (statementId: string, form: FormData) => Promise<void>; onRemove: (statementId: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const statement = slot.statement;
  const isBusy = busy === statement?.id || busy === `slot-${slot.index}`;
  return <Card className="flex min-h-[340px] flex-col dark:border-slate-800 dark:bg-slate-900">
    <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="dark:text-white">Statement {slot.index + 1}</CardTitle><CardDescription>{slot.expected.label}</CardDescription></div>{statement ? <StatusBadge status={formatGrantLabel(statement.status)} /> : <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Not uploaded</span>}</div></CardHeader>
    <CardContent className="flex flex-1 flex-col space-y-4">
      {statement ? <>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="break-all text-sm font-bold text-brand-ink dark:text-white">{statement.originalFilename}</p><p className="mt-1 text-xs text-slate-500">{fileSize(statement.fileSize)} · Stored privately</p></div>
        {editing === statement.id ? <MetadataForm statement={statement} expectedMonth={slot.expected.value} disabled={isBusy} onCancel={() => setEditing(null)} onSave={(form) => onSave(statement.id, form)} /> : <div className="grid grid-cols-2 gap-3 text-sm"><Detail label="Statement Month" value={displayDate(statement.statementMonth)} /><Detail label="Period" value={statement.periodStart || statement.periodEnd ? `${displayDate(statement.periodStart)} – ${displayDate(statement.periodEnd)}` : "Not provided"} /><Detail label="Opening Balance" value={statement.openingBalance ? formatGrantCurrency(Number(statement.openingBalance), statement.currency ?? data.currency) : "Not provided"} /><Detail label="Closing Balance" value={statement.closingBalance ? formatGrantCurrency(Number(statement.closingBalance), statement.currency ?? data.currency) : "Not provided"} /></div>}
        <div className="mt-auto flex flex-wrap gap-2"><a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-line px-3 text-sm font-bold text-brand-navy" href={`/api/grant-reports/${data.reportId}/bank-import/${data.id}/statements/${statement.id}/file?preview=1`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" />Preview</a><a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-line px-3 text-sm font-bold text-brand-navy" href={`/api/grant-reports/${data.reportId}/bank-import/${data.id}/statements/${statement.id}/file?download=1`}><Download className="h-4 w-4" />Download</a>{data.editable ? <><Button type="button" variant="ghost" disabled={isBusy} onClick={() => setEditing(editing === statement.id ? null : statement.id)}><Pencil className="h-4 w-4" />Edit Details</Button><Button type="button" variant="ghost" disabled={isBusy} onClick={() => inputRef.current?.click()}><FileUp className="h-4 w-4" />Replace</Button>{confirmRemove === statement.id ? <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-800"><span>Remove this statement?</span><button type="button" disabled={isBusy} className="underline" onClick={() => void onRemove(statement.id)}>Remove</button><button type="button" className="underline" onClick={() => setConfirmRemove(null)}>Cancel</button></div> : <Button type="button" variant="ghost" disabled={isBusy} onClick={() => setConfirmRemove(statement.id)}><Trash2 className="h-4 w-4" />Remove</Button>}</> : null}</div>
      </> : <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-brand-line p-8 text-center"><Landmark className="h-8 w-8 text-slate-400" /><p className="mt-3 font-bold">No statement uploaded</p><p className="mt-1 text-sm text-slate-500">PDF, PNG, JPG or JPEG. Maximum 10 MB.</p>{data.editable ? <Button type="button" className="mt-4" disabled={isBusy} onClick={() => inputRef.current?.click()}><FileUp className="h-4 w-4" />{isBusy ? "Uploading…" : "Upload Statement"}</Button> : null}</div>}
      <input ref={inputRef} className="sr-only" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" aria-label={`${statement ? "Replace" : "Upload"} statement ${slot.index + 1}`} disabled={!data.editable || isBusy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void onUpload(slot, file, statement?.id); }} />
    </CardContent>
  </Card>;
}

function MetadataForm({ statement, expectedMonth, disabled, onCancel, onSave }: { statement: GrantBankStatementDto; expectedMonth: string; disabled: boolean; onCancel: () => void; onSave: (form: FormData) => Promise<void> }) {
  return <form className="space-y-3" action={(form) => void onSave(form)}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><Input label="Statement Month" name="statementMonth" type="date" defaultValue={statement.statementMonth ?? expectedMonth} disabled={disabled} /><Input label="Statement Date" name="statementDate" type="date" defaultValue={statement.statementDate ?? ""} disabled={disabled} /><Input label="Period Start" name="periodStart" type="date" defaultValue={statement.periodStart ?? ""} disabled={disabled} /><Input label="Period End" name="periodEnd" type="date" defaultValue={statement.periodEnd ?? ""} disabled={disabled} /><Input label="Bank / Institution" name="bankName" defaultValue={statement.bankName ?? ""} disabled={disabled} /><Input label="Account Holder" name="accountHolderName" defaultValue={statement.accountHolderName ?? ""} disabled={disabled} /><Input label="Masked Account Reference" name="maskedAccountReference" placeholder="****1234" defaultValue={statement.maskedAccountReference ?? ""} disabled={disabled} /><Input label="Opening Balance" name="openingBalance" inputMode="decimal" defaultValue={statement.openingBalance ?? ""} disabled={disabled} /><Input label="Closing Balance" name="closingBalance" inputMode="decimal" defaultValue={statement.closingBalance ?? ""} disabled={disabled} /><Input label="Currency" name="currency" defaultValue={statement.currency ?? "ZAR"} maxLength={3} disabled={disabled} /></div><div className="flex gap-2"><Button type="submit" disabled={disabled}>{disabled ? "Saving…" : "Save Details"}</Button><Button type="button" variant="ghost" disabled={disabled} onClick={onCancel}>Cancel</Button></div></form>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { const { label, ...input } = props; return <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}<input className={inputClass} {...input} /></label>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-brand-ink dark:text-white">{value}</p></div>; }
