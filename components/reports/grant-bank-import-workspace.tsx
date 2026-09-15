"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, Check, Download, Eye, FileUp, Landmark, Pencil, ReceiptText, ScanText, Sparkles, Trash2 } from "lucide-react";
import { BreadcrumbLabel } from "@/components/app-shell/breadcrumb-label";
import { Badge, PageHeader, Progress, StatusBadge, useToast } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGrantLabel, reportTypeLabels } from "@/lib/grant-reports/types";
import { formatGrantBankCurrency, type GrantBankImportWorkspaceDto, type GrantBankPostingPreviewDto, type GrantBankStatementDto } from "@/lib/grant-reports/bank-import";
import { grantBankTransactionCategories, isGrantBankTransactionCategory, type GrantBankTransactionCategory } from "@/lib/grant-reports/bank-transaction-categorisation";

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
  const [posting, setPosting] = useState<GrantBankPostingPreviewDto | null>(null);
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

  async function extract(statementId: string) {
    setBusy(statementId);
    try {
      const response = await fetch(`/api/grant-reports/${data.reportId}/bank-import/${data.id}/statements/${statementId}/extract`, { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "The bank statement could not be extracted.");
      setData(result.data);
      pushToast({ title: "Extraction complete", description: "Review the transaction preview and extraction status below." });
    } catch (error) {
      pushToast({ title: "Extraction failed", description: error instanceof Error ? error.message : "The bank statement could not be extracted." });
    } finally { setBusy(null); }
  }

  async function categorise(action: { action: "suggest" | "complete" } | { action: "confirm"; transactionId: string; category: GrantBankTransactionCategory }) {
    const busyKey = action.action === "confirm" ? action.transactionId : `categorisation-${action.action}`;
    setBusy(busyKey);
    try {
      const response = await fetch(`/api/grant-reports/${data.reportId}/bank-import/${data.id}/transactions/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "The transaction categorisation could not be updated.");
      setData(result.data);
      pushToast(action.action === "suggest"
        ? { title: "Suggestions ready", description: "High-confidence deterministic matches were confirmed automatically. Review every remaining transaction." }
        : action.action === "complete"
          ? { title: "Categorisation complete", description: "The reviewed transactions are ready for the next controlled reporting phase." }
          : { title: "Transaction reviewed", description: "The selected category was confirmed without changing the bank transaction." });
    } catch (error) {
      pushToast({ title: "Categorisation failed", description: error instanceof Error ? error.message : "The transaction categorisation could not be updated." });
    } finally { setBusy(null); }
  }

  async function reviewPosting() {
    setBusy("posting-preview");
    try {
      const response = await fetch(`/api/grant-reports/${data.reportId}/bank-import/${data.id}/posting`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "The posting preview could not be loaded.");
      setPosting(result.data);
    } catch (error) {
      pushToast({ title: "Posting preview unavailable", description: error instanceof Error ? error.message : "The posting preview could not be loaded." });
    } finally { setBusy(null); }
  }

  async function postTransactions() {
    setBusy("posting-submit");
    try {
      const response = await fetch(`/api/grant-reports/${data.reportId}/bank-import/${data.id}/posting`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post" }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "The confirmed transactions could not be posted.");
      setPosting(result.data);
      setData((current) => ({ ...current, status: "CONFIRMED" }));
      pushToast({ title: "Transactions posted", description: "Confirmed transactions were added to this report version with source links. Manual report lines were left unchanged." });
    } catch (error) {
      pushToast({ title: "Posting failed", description: error instanceof Error ? error.message : "The confirmed transactions could not be posted." });
    } finally { setBusy(null); }
  }

  async function returnToCategorisation() {
    setBusy("posting-return");
    try {
      const response = await fetch(`/api/grant-reports/${data.reportId}/bank-import/${data.id}/posting`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "return_to_categorisation" }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "The bank import could not return to categorisation.");
      setData(result.data); setPosting(null);
      pushToast({ title: "Returned to categorisation", description: "Update the confirmed category, complete categorisation again, then review posting." });
    } catch (error) {
      pushToast({ title: "Action failed", description: error instanceof Error ? error.message : "The bank import could not return to categorisation." });
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
      <Summary label="Statements Uploaded" value={`${data.statementsUploaded} / ${data.expectedMonths.length}`} />
    </CardContent></Card>

    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-brand-navy"><strong>Review remains human-controlled.</strong> Categorising these extracted transactions does not change the {reportTypeLabels[data.reportType]} report. Original dates, descriptions, directions, amounts and duplicate-looking rows remain unchanged.</div>

    <div className="grid gap-5 xl:grid-cols-3">{slots.map((slot) => <StatementCard key={slot.index} slot={slot} data={data} busy={busy} editing={editing} confirmRemove={confirmRemove} setEditing={setEditing} setConfirmRemove={setConfirmRemove} onUpload={upload} onSave={saveMetadata} onRemove={remove} onExtract={extract} />)}</div>
    {data.categorisation.total > 0 ? <TransactionReview data={data} busy={busy} onAction={categorise} /> : data.statements.some((statement) => statement.extractionState !== "PENDING") ? <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><CardTitle>Extracted Transactions</CardTitle><CardDescription>No financial transaction rows are available for categorisation yet.</CardDescription></CardHeader></Card> : null}
    {["READY_FOR_CONFIRMATION", "CONFIRMED"].includes(data.status) ? <Card className="dark:border-slate-800 dark:bg-slate-900"><CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle>Cash Flow Posting</CardTitle><CardDescription>Review the accounting treatment before any confirmed transaction affects this report version.</CardDescription></div><Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => void reviewPosting()}><ReceiptText className="h-4 w-4" />{busy === "posting-preview" ? "Loading…" : posting ? "Refresh Posting Review" : "Review Posting"}</Button></div></CardHeader>{posting ? <CardContent><PostingReview preview={posting} busy={busy} onPost={postTransactions} onReturn={returnToCategorisation} /></CardContent> : null}</Card> : null}
  </div>;
}

function PostingReview({ preview, busy, onPost, onReturn }: { preview: GrantBankPostingPreviewDto; busy: string | null; onPost: () => Promise<void>; onReturn: () => Promise<void> }) {
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><PostingTotal label="Confirmed Credits" value={formatGrantBankCurrency(preview.totals.confirmedCredits, preview.currency)} /><PostingTotal label="Confirmed Debits" value={formatGrantBankCurrency(preview.totals.confirmedDebits, preview.currency)} /><PostingTotal label="Proposed Cash Received" value={formatGrantBankCurrency(preview.totals.proposedCashReceived, preview.currency)} /><PostingTotal label="Proposed Expenses" value={formatGrantBankCurrency(preview.totals.proposedOperatingExpenses, preview.currency)} /><PostingTotal label="Net Movement" value={formatGrantBankCurrency(preview.totals.netMovement, preview.currency)} /></div>
    {preview.totals.unmapped > 0 ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{preview.totals.unmapped} transaction{preview.totals.unmapped === 1 ? "" : "s"} need an accounting decision. Posting is blocked.</p> : null}
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px] table-fixed text-left text-xs"><colgroup><col className="w-[9%]" /><col className="w-[25%]" /><col className="w-[8%]" /><col className="w-[10%]" /><col className="w-[14%]" /><col className="w-[14%]" /><col className="w-[20%]" /></colgroup><thead><tr className="border-b border-brand-line uppercase tracking-wide text-slate-500"><th className="p-2">Date</th><th className="p-2">Original Description</th><th className="p-2">Direction</th><th className="p-2 text-right">Amount</th><th className="p-2">Confirmed Category</th><th className="p-2">Proposed Treatment</th><th className="p-2">Source</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.transactionId} className="border-b border-brand-line/70 align-top dark:border-slate-800"><td className="whitespace-nowrap p-2">{displayDate(row.transactionDate)}</td><td className="break-words p-2 font-medium">{row.description}</td><td className="p-2"><Badge variant={row.direction === "CREDIT" ? "success" : "muted"}>{formatGrantLabel(row.direction)}</Badge></td><td className="whitespace-nowrap p-2 text-right font-semibold tabular-nums">{formatGrantBankCurrency(row.amount, preview.currency)}</td><td className="p-2">{row.confirmedCategory}</td><td className="p-2"><Badge variant={row.safe ? "success" : "warning"}>{row.treatment === "CASH_RECEIVED" ? "Cash Received" : row.treatment === "OPERATING_EXPENSE" ? "Operating Expense" : "Needs Posting Review"}</Badge>{row.reportCategory ? <p className="mt-1 text-slate-500">{row.reportCategory}</p> : null}{row.reason ? <p className="mt-1 text-amber-800">{row.reason}</p> : null}</td><td className="break-words p-2"><span className="font-medium">{row.statementName}</span><br /><span className="text-slate-500">{[row.sourcePage ? `Page ${row.sourcePage}` : null, row.sourceRow ? `row ${row.sourceRow}` : null].filter(Boolean).join(" · ") || "Source position unavailable"}</span></td></tr>)}</tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-line p-4 dark:border-slate-700"><p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">Posting creates separate bank-sourced cash-flow lines and immutable source links. Existing manual report lines are not replaced.</p><div className="flex flex-wrap gap-2">{preview.totals.unmapped > 0 && !preview.posted ? <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => void onReturn()}>{busy === "posting-return" ? "Returning…" : "Return to Categorisation"}</Button> : null}<Button type="button" disabled={!preview.canPost || Boolean(busy) || preview.posted} onClick={() => void onPost()}><Check className="h-4 w-4" />{busy === "posting-submit" ? "Posting…" : preview.posted ? "Posted" : "Post to Cash Flow Report"}</Button></div></div>
  </div>;
}

function PostingTotal({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-bold tabular-nums text-brand-ink dark:text-white">{value}</p></div>; }

function StatementCard({ slot, data, busy, editing, confirmRemove, setEditing, setConfirmRemove, onUpload, onSave, onRemove, onExtract }: {
  slot: ReturnType<typeof assignStatementSlots>[number]; data: GrantBankImportWorkspaceDto; busy: string | null; editing: string | null; confirmRemove: string | null;
  setEditing: (id: string | null) => void; setConfirmRemove: (id: string | null) => void;
  onUpload: (slot: ReturnType<typeof assignStatementSlots>[number], file: File, replaceStatementId?: string) => Promise<void>;
  onSave: (statementId: string, form: FormData) => Promise<void>; onRemove: (statementId: string) => Promise<void>; onExtract: (statementId: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const statement = slot.statement;
  const isBusy = busy === statement?.id || busy === `slot-${slot.index}`;
  return <Card className="flex min-h-[340px] flex-col dark:border-slate-800 dark:bg-slate-900">
    <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="dark:text-white">Statement {slot.index + 1}</CardTitle><CardDescription>{slot.expected.label}</CardDescription></div>{statement ? <StatusBadge status={formatGrantLabel(statement.status)} /> : <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">Not uploaded</span>}</div></CardHeader>
    <CardContent className="flex flex-1 flex-col space-y-4">
      {statement ? <>
        <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="break-all text-sm font-bold text-brand-ink dark:text-white">{statement.originalFilename}</p><p className="mt-1 text-xs text-slate-500">{fileSize(statement.fileSize)} · Stored privately</p></div>
        {editing === statement.id ? <MetadataForm statement={statement} expectedMonth={slot.expected.value} disabled={isBusy} onCancel={() => setEditing(null)} onSave={(form) => onSave(statement.id, form)} /> : <div className="grid grid-cols-2 gap-3 text-sm"><Detail label="Statement Month" value={displayDate(statement.statementMonth)} /><Detail label="Period" value={statement.periodStart || statement.periodEnd ? `${displayDate(statement.periodStart)} – ${displayDate(statement.periodEnd)}` : "Not provided"} /><Detail label="Opening Balance" value={statement.openingBalance ? formatGrantBankCurrency(statement.openingBalance, statement.currency ?? data.currency) : "Not provided"} /><Detail label="Closing Balance" value={statement.closingBalance ? formatGrantBankCurrency(statement.closingBalance, statement.currency ?? data.currency) : "Not provided"} /></div>}
        <ExtractionState statement={statement} processing={isBusy} />
        <div className="mt-auto flex flex-wrap gap-2"><a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-line px-3 text-sm font-bold text-brand-navy" href={`/api/grant-reports/${data.reportId}/bank-import/${data.id}/statements/${statement.id}/file?preview=1`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" />Preview</a><a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-brand-line px-3 text-sm font-bold text-brand-navy" href={`/api/grant-reports/${data.reportId}/bank-import/${data.id}/statements/${statement.id}/file?download=1`}><Download className="h-4 w-4" />Download</a>{data.editable && ["PENDING", "FAILED"].includes(statement.extractionState) ? <Button type="button" variant="secondary" disabled={isBusy} onClick={() => void onExtract(statement.id)}><ScanText className="h-4 w-4" />{isBusy ? "Extracting…" : "Extract Transactions"}</Button> : null}{data.editable ? <><Button type="button" variant="ghost" disabled={isBusy || statement.extractionState !== "PENDING"} onClick={() => setEditing(editing === statement.id ? null : statement.id)}><Pencil className="h-4 w-4" />Edit Details</Button><Button type="button" variant="ghost" disabled={isBusy || statement.extractionState !== "PENDING"} onClick={() => inputRef.current?.click()}><FileUp className="h-4 w-4" />Replace</Button>{confirmRemove === statement.id ? <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-red-800"><span>Remove this statement?</span><button type="button" disabled={isBusy} className="underline" onClick={() => void onRemove(statement.id)}>Remove</button><button type="button" className="underline" onClick={() => setConfirmRemove(null)}>Cancel</button></div> : <Button type="button" variant="ghost" disabled={isBusy || statement.extractionState !== "PENDING"} onClick={() => setConfirmRemove(statement.id)}><Trash2 className="h-4 w-4" />Remove</Button>}</> : null}</div>
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

function ExtractionState({ statement, processing }: { statement: GrantBankStatementDto; processing: boolean }) {
  const label = processing || statement.extractionState === "PROCESSING" ? "Processing" : statement.extractionState === "READY_FOR_CATEGORISATION" ? "Ready for categorisation" : statement.extractionState === "OCR_REQUIRED" ? "PDF or image requires OCR" : statement.extractionState === "NO_TRANSACTIONS" ? "No transactions detected" : statement.extractionState === "FAILED" ? "Extraction failed" : "Awaiting extraction";
  return <div className="rounded-lg border border-brand-line p-3 text-sm dark:border-slate-700"><div className="flex items-center justify-between gap-2"><span className="font-bold">{label}</span>{statement.transactionsFound > 0 ? <span className="text-xs font-semibold text-slate-500">{statement.transactionsFound} found</span> : null}</div>{statement.extractionMessage ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{statement.extractionMessage}</p> : null}</div>;
}

function TransactionReview({ data, busy, onAction }: {
  data: GrantBankImportWorkspaceDto;
  busy: string | null;
  onAction: (action: { action: "suggest" | "complete" } | { action: "confirm"; transactionId: string; category: GrantBankTransactionCategory }) => Promise<void>;
}) {
  const hasUncategorised = data.statements.some((statement) => statement.transactions.some((transaction) => transaction.reviewStatus === "UNCATEGORISED"));
  return <Card className="dark:border-slate-800 dark:bg-slate-900">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle>Transaction Categorisation & Review</CardTitle><CardDescription>Review each extracted financial transaction. Suggestions never change the source transaction or update the report.</CardDescription></div><Badge variant={data.categorisation.complete ? "success" : "default"}>{data.categorisation.complete ? "Categorisation complete" : `${data.categorisation.reviewed} of ${data.categorisation.total} reviewed`}</Badge></div></CardHeader>
    <CardContent className="space-y-6">
      <div className="rounded-lg border border-brand-line p-4 dark:border-slate-700"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{data.categorisation.reviewed} of {data.categorisation.total} transactions reviewed</p><p className="text-sm text-slate-500">High-confidence deterministic matches count as reviewed. Other / Unclassified always requires explicit confirmation.</p></div><div className="flex flex-wrap gap-2">{hasUncategorised && data.editable ? <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => void onAction({ action: "suggest" })}><Sparkles className="h-4 w-4" />{busy === "categorisation-suggest" ? "Generating…" : "Generate Suggestions"}</Button> : null}<Button type="button" disabled={!data.editable || !data.categorisation.readyToComplete || Boolean(busy)} onClick={() => void onAction({ action: "complete" })}><Check className="h-4 w-4" />{busy === "categorisation-complete" ? "Completing…" : data.categorisation.complete ? "Completed" : "Complete Categorisation"}</Button></div></div><Progress className="mt-3" value={data.categorisation.percentage} /></div>
      {data.statements.filter((statement) => statement.transactions.length > 0).map((statement) => <TransactionReviewTable key={statement.id} statement={statement} currency={statement.currency ?? data.currency} editable={data.editable} busy={busy} onConfirm={(transactionId, category) => onAction({ action: "confirm", transactionId, category })} />)}
    </CardContent>
  </Card>;
}

function TransactionReviewTable({ statement, currency, editable, busy, onConfirm }: {
  statement: GrantBankStatementDto;
  currency: string;
  editable: boolean;
  busy: string | null;
  onConfirm: (transactionId: string, category: GrantBankTransactionCategory) => Promise<void>;
}) {
  return <section className="space-y-3"><div><h3 className="font-bold text-brand-ink dark:text-white">{statement.originalFilename}</h3><p className="text-sm text-slate-500">{statement.transactionsFound} extracted financial transactions. Source order and duplicate-looking rows are preserved.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1380px] table-fixed text-left text-xs"><colgroup><col className="w-[8%]" /><col className="w-[22%]" /><col className="w-[8%]" /><col className="w-[9%]" /><col className="w-[9%]" /><col className="w-[10%]" /><col className="w-[13%]" /><col className="w-[7%]" /><col className="w-[7%]" /><col className="w-[7%]" /></colgroup><thead><tr className="border-b border-brand-line uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Date</th><th className="px-2 py-2">Original Description</th><th className="px-2 py-2">Direction</th><th className="px-2 py-2 text-right">Amount</th><th className="px-2 py-2 text-right">Balance</th><th className="px-2 py-2">Source</th><th className="px-2 py-2">Suggested Category</th><th className="px-2 py-2">Confidence</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Review</th></tr></thead><tbody>{statement.transactions.map((transaction) => <TransactionReviewRow key={`${transaction.id}-${transaction.suggestedCategory}-${transaction.confirmedCategory}`} transaction={transaction} statementName={statement.originalFilename} currency={currency} editable={editable} busy={busy === transaction.id} onConfirm={onConfirm} />)}</tbody></table></div></section>;
}

function TransactionReviewRow({ transaction, statementName, currency, editable, busy, onConfirm }: {
  transaction: GrantBankStatementDto["transactions"][number];
  statementName: string;
  currency: string;
  editable: boolean;
  busy: boolean;
  onConfirm: (transactionId: string, category: GrantBankTransactionCategory) => Promise<void>;
}) {
  const [category, setCategory] = useState<GrantBankTransactionCategory | "">(transaction.confirmedCategory ?? transaction.suggestedCategory ?? "");
  const direction = transaction.debit ? "Debit" : "Credit";
  const amount = transaction.debit ?? transaction.credit ?? "0.00";
  const sourcePosition = [transaction.sourcePage ? `Page ${transaction.sourcePage}` : null, transaction.sourceRow ? `row ${transaction.sourceRow}` : null].filter(Boolean).join(" · ");
  const badgeVariant = transaction.reviewStatus === "CONFIRMED" ? "success" : transaction.reviewStatus === "NEEDS_REVIEW" ? "warning" : "muted";
  return <tr className="border-b border-brand-line/70 align-top dark:border-slate-800"><td className="whitespace-nowrap px-2 py-3">{displayDate(transaction.transactionDate)}</td><td className="break-words px-2 py-3 font-medium">{transaction.description}</td><td className="px-2 py-3"><Badge variant={direction === "Credit" ? "success" : "muted"}>{direction}</Badge></td><td className="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums">{formatGrantBankCurrency(amount, currency)}</td><td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">{transaction.balance ? formatGrantBankCurrency(transaction.balance, currency) : "—"}</td><td className="break-words px-2 py-3"><span className="font-medium">{statementName}</span><br /><span className="text-slate-500">{sourcePosition || "Source position unavailable"}</span></td><td className="px-2 py-3">{transaction.suggestedCategory ?? "—"}</td><td className="px-2 py-3">{transaction.suggestedConfidence === null ? "—" : `${Math.round(transaction.suggestedConfidence * 100)}%`}</td><td className="px-2 py-3"><Badge variant={badgeVariant}>{formatGrantLabel(transaction.reviewStatus)}</Badge></td><td className="space-y-2 px-2 py-3"><select aria-label={`Category for ${transaction.description}`} className="w-full rounded-md border border-brand-line bg-white px-2 py-2 text-xs outline-none focus:border-brand-navy dark:border-slate-700 dark:bg-slate-950" value={category} disabled={!editable || busy} onChange={(event) => setCategory(isGrantBankTransactionCategory(event.target.value) ? event.target.value : "")}><option value="">Select category</option>{grantBankTransactionCategories.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}</select><Button type="button" className="min-h-8 w-full px-2 py-1 text-xs" disabled={!editable || busy || !category} onClick={() => category && void onConfirm(transaction.id, category)}>{busy ? "Saving…" : transaction.reviewStatus === "CONFIRMED" ? "Update" : "Confirm"}</Button></td></tr>;
}
