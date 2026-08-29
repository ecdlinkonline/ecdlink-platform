"use client";

import { PlusCircle } from "lucide-react";
import { WorkflowActionDialog, type WorkflowActionResult } from "@/components/workflows/workflow-action-dialog";
import {
  buildGrantObligationSubmission,
  grantObligationBases,
  initialGrantObligationValues,
  obligationFieldState,
  updateGrantObligationValues,
  type GrantObligationFormValues,
} from "@/lib/grant-reports/obligation-form";
import { formatGrantLabel, reportTypeLabels, type GrantReportWorkspaceData } from "@/lib/grant-reports/types";

const fieldClassName = "mt-2 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-navy disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4 border-b border-brand-line pb-5 last:border-b-0 dark:border-slate-700"><h4 className="text-sm font-extrabold uppercase tracking-wide text-brand-navy dark:text-blue-300">{title}</h4>{children}</section>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-bold text-brand-ink dark:text-white">{label}</span>{children}{error ? <span className="mt-1 block text-sm font-semibold text-red-700 dark:text-red-300">{error}</span> : null}</label>;
}

async function createObligation(values: GrantObligationFormValues): Promise<WorkflowActionResult> {
  const response = await fetch("/api/grant-reporting-obligations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGrantObligationSubmission(values)),
  });
  const body = await response.json().catch(() => null) as { error?: string; details?: { fieldErrors?: Record<string, string[]> } } | null;
  if (!response.ok) {
    return {
      ok: false,
      error: body?.error ?? "The reporting obligation could not be created.",
      fieldErrors: Object.fromEntries(Object.entries(body?.details?.fieldErrors ?? {}).map(([name, messages]) => [name, messages[0] ?? "Invalid value."])),
    };
  }
  return { ok: true };
}

export function GrantObligationDialog({ data, onSuccess }: { data: GrantReportWorkspaceData; onSuccess: () => void }) {
  return <WorkflowActionDialog<GrantObligationFormValues>
    title="Create Reporting Obligation"
    description="Set the reporting schedule and approval workflow for this award. A Draft report and version 1 are created automatically."
    size="lg"
    trigger={{ label: "Add Obligation", variant: "secondary", icon: <PlusCircle className="h-4 w-4" /> }}
    confirmationButton={{ label: "Create Obligation", loadingLabel: "Creating…" }}
    fields={[]}
    initialValues={initialGrantObligationValues}
    onValuesChange={(values, changedField) => updateGrantObligationValues(values, changedField)}
    validate={(values) => {
      const state = obligationFieldState(values);
      return {
        ...(!values.grantAwardId ? { grantAwardId: "Grant Award is required." } : {}),
        ...(!values.title.trim() ? { title: "Title is required." } : {}),
        ...(!values.dueAt ? { dueAt: "Due Date is required." } : {}),
        ...(state.showTranche && !values.grantTrancheId ? { grantTrancheId: "Tranche is required." } : {}),
        ...(state.showFinancialYear && !values.financialYear.trim() ? { financialYear: "Financial Year is required." } : {}),
        ...(state.showQuarter && !values.quarter ? { quarter: "Quarter is required." } : {}),
        ...(state.showReportingPeriod && !values.reportingPeriodStart ? { reportingPeriodStart: "Reporting Period Start is required." } : {}),
        ...(state.showReportingPeriod && !values.reportingPeriodEnd ? { reportingPeriodEnd: "Reporting Period End is required." } : {}),
      };
    }}
    renderFields={({ values, updateValue, fieldErrors, disabled }) => {
      const state = obligationFieldState(values);
      const award = data.options.awards.find((item) => item.id === values.grantAwardId);
      return <>
        <Section title="1. Award & Report Type">
          <Field label="Grant Award" error={fieldErrors.grantAwardId}><select name="grantAwardId" className={fieldClassName} value={values.grantAwardId} disabled={disabled} onChange={(event) => updateValue("grantAwardId", event.target.value)}><option value="">Select an award</option>{data.options.awards.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>
          <Field label="Report Type"><select name="type" className={fieldClassName} value={values.type} disabled={disabled} onChange={(event) => updateValue("type", event.target.value)}>{Object.entries(reportTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        </Section>
        <Section title="2. Reporting Period">
          {state.showBasis ? <Field label="Obligation Basis"><select name="basis" className={fieldClassName} value={values.basis} disabled={disabled} onChange={(event) => updateValue("basis", event.target.value)}>{grantObligationBases.map((basis) => <option key={basis} value={basis}>{formatGrantLabel(basis)}</option>)}</select></Field> : null}
          {state.showTranche ? <Field label="Tranche" error={fieldErrors.grantTrancheId}><select name="grantTrancheId" className={fieldClassName} value={values.grantTrancheId} disabled={disabled || !values.grantAwardId} onChange={(event) => updateValue("grantTrancheId", event.target.value)}><option value="">{values.grantAwardId ? "Select a tranche" : "Select an award first"}</option>{award?.tranches.map((tranche) => <option key={tranche.id} value={tranche.id}>{tranche.label}</option>)}</select></Field> : null}
          {state.showFinancialYear || state.showQuarter ? <div className="grid gap-4 sm:grid-cols-2">{state.showFinancialYear ? <Field label="Financial Year" error={fieldErrors.financialYear}><input name="financialYear" className={fieldClassName} value={values.financialYear} maxLength={20} disabled={disabled} onChange={(event) => updateValue("financialYear", event.target.value)} /></Field> : null}{state.showQuarter ? <Field label="Quarter" error={fieldErrors.quarter}><select name="quarter" className={fieldClassName} value={values.quarter} disabled={disabled} onChange={(event) => updateValue("quarter", Number(event.target.value))}>{[1, 2, 3, 4].map((quarter) => <option key={quarter} value={quarter}>Q{quarter}</option>)}</select></Field> : null}</div> : null}
          {state.showReportingPeriod ? <div className="grid gap-4 sm:grid-cols-2"><Field label="Reporting Period Start" error={fieldErrors.reportingPeriodStart}><input name="reportingPeriodStart" type="date" className={fieldClassName} value={values.reportingPeriodStart} disabled={disabled} onChange={(event) => updateValue("reportingPeriodStart", event.target.value)} /></Field><Field label="Reporting Period End" error={fieldErrors.reportingPeriodEnd}><input name="reportingPeriodEnd" type="date" className={fieldClassName} value={values.reportingPeriodEnd} disabled={disabled} onChange={(event) => updateValue("reportingPeriodEnd", event.target.value)} /></Field></div> : null}
          <Field label="Due Date" error={fieldErrors.dueAt}><input name="dueAt" type="date" className={fieldClassName} value={values.dueAt} disabled={disabled} onChange={(event) => updateValue("dueAt", event.target.value)} /></Field>
        </Section>
        <Section title="3. Report Details">
          <Field label="Title" error={fieldErrors.title}><input name="title" className={fieldClassName} value={values.title} maxLength={200} disabled={disabled} onChange={(event) => updateValue("title", event.target.value)} /></Field>
          {state.showDescription ? <Field label="Description"><textarea name="description" className={`${fieldClassName} resize-y`} rows={4} maxLength={5000} value={values.description} disabled={disabled} onChange={(event) => updateValue("description", event.target.value)} /></Field> : null}
        </Section>
        <Section title="4. Approval Workflow">
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4" checked={values.requiresFunderApproval} disabled={disabled} onChange={(event) => updateValue("requiresFunderApproval", event.target.checked)} /><span className="text-sm font-bold">Requires funder approval</span></label>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4" checked={values.requiresSuperAdminApproval} disabled={disabled} onChange={(event) => updateValue("requiresSuperAdminApproval", event.target.checked)} /><span className="text-sm font-bold">Requires Super Admin approval</span></label>
        </Section>
      </>;
    }}
    action={createObligation}
    successToast={{ title: "Reporting obligation created", description: "Draft report version 1 is ready for Phase 2 preparation." }}
    errorToast={{ title: "Obligation creation failed", fallbackDescription: "The reporting obligation could not be created." }}
    onSuccess={onSuccess}
  />;
}
