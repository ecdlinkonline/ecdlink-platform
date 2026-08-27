"use client";

import { useState } from "react";
import { FileText, PlusCircle, Upload } from "lucide-react";
import { WorkflowActionDialog, type WorkflowActionResult } from "@/components/workflows/workflow-action-dialog";
import { buildGrantAwardSubmission, grantAwardLeadOrganisation, grantAwardSourceFieldState, updateGrantAwardSource, validateGrantAwardSource, type GrantAwardFormValues } from "@/lib/grant-reports/award-form";
import type { GrantReportWorkspaceData } from "@/lib/grant-reports/types";

const fieldClassName = "mt-2 w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-navy disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4 border-b border-brand-line pb-5 last:border-b-0 dark:border-slate-700"><h4 className="text-sm font-extrabold uppercase tracking-wide text-brand-navy dark:text-blue-300">{title}</h4>{children}</section>;
}

function Field({ label, description, error, children }: { label: string; description?: string; error?: string; children: React.ReactNode }) {
  return <div className="block"><p className="text-sm font-bold text-brand-ink dark:text-white">{label}</p>{description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}{children}{error ? <p className="mt-1 text-sm font-semibold text-red-700 dark:text-red-300">{error}</p> : null}</div>;
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm font-bold text-brand-ink dark:text-white">{label}</p><div className="mt-2 rounded-lg border border-brand-line bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">{value || "—"}</div></div>;
}

async function rollbackStagedAgreement(fileAssetId: string) {
  await fetch(`/api/grant-awards/agreements/stage/${fileAssetId}`, { method: "DELETE" }).catch(() => undefined);
}

export function GrantAwardDialog({ data, onSuccess }: { data: GrantReportWorkspaceData; onSuccess: () => void }) {
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [agreementError, setAgreementError] = useState<string | null>(null);
  const sources = { applications: data.options.applications, commitments: data.options.commitments };
  const initialValues: GrantAwardFormValues = { sourceType:"MANUAL",fundingApplicationId:"",sponsorshipCommitmentId:"",centreId:"",fundingProjectId:"",awardNumber:"",title:"",description:"",awardedAmount:"",currency:"ZAR",startDate:"",endDate:"",organisationType:"FUNDING_ORGANISATION",fundingOrganisationId:"",donorOrganisationId:"",agreementDate:"",signedByBothParties:false,canReview:true,canApprove:false };

  async function createAward(values: GrantAwardFormValues): Promise<WorkflowActionResult> {
    let stagedFileAssetId: string | undefined;
    try {
      if (agreementFile) {
        const formData = new FormData();
        formData.set("file", agreementFile);
        const uploadResponse = await fetch("/api/grant-awards/agreements/stage", { method: "POST", body: formData });
        const uploadBody = await uploadResponse.json().catch(() => null) as { data?: { id?: string }; error?: string } | null;
        if (!uploadResponse.ok || !uploadBody?.data?.id) return { ok: false, error: uploadBody?.error ?? "The signed agreement could not be uploaded." };
        stagedFileAssetId = uploadBody.data.id;
      }

      const response = await fetch("/api/grant-awards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildGrantAwardSubmission(values, stagedFileAssetId)) });
      const body = await response.json().catch(() => null) as { data?: unknown; error?: string; details?: { fieldErrors?: Record<string, string[]> } } | null;
      if (!response.ok) {
        if (stagedFileAssetId) await rollbackStagedAgreement(stagedFileAssetId);
        return { ok: false, error: body?.error ?? "The award could not be created.", fieldErrors: Object.fromEntries(Object.entries(body?.details?.fieldErrors ?? {}).map(([name, messages]) => [name, messages[0] ?? "Invalid value."])) };
      }
      return { ok: true, data: body?.data };
    } catch {
      if (stagedFileAssetId) await rollbackStagedAgreement(stagedFileAssetId);
      return { ok: false, error: "The award could not be created." };
    }
  }

  return <WorkflowActionDialog<GrantAwardFormValues>
    title="Create Grant Award"
    description="Confirm the funding relationship, award details and optional signed agreement."
    size="xl"
    trigger={{ label: "Create Grant Award", icon: <PlusCircle className="h-4 w-4" /> }}
    confirmationButton={{ label: "Create Award", loadingLabel: "Creating…" }}
    fields={[]}
    initialValues={initialValues}
    onValuesChange={(values, changedField) => updateGrantAwardSource(values, changedField, sources)}
    validate={(values) => ({
      ...validateGrantAwardSource(values, sources),
      ...(!values.centreId ? { centreId: "Centre is required." } : {}),
      ...(!values.fundingProjectId ? { fundingProjectId: "Funding Project is required." } : {}),
      ...(!values.awardNumber.trim() ? { awardNumber: "Award Number is required." } : {}),
      ...(!values.title.trim() ? { title: "Title is required." } : {}),
      ...(values.awardedAmount === "" ? { awardedAmount: "Awarded Amount is required." } : {}),
      ...(!values.startDate ? { startDate: "Start Date is required." } : {}),
      ...(values.sourceType === "MANUAL" && values.organisationType === "FUNDING_ORGANISATION" && !values.fundingOrganisationId ? { fundingOrganisationId: "Funding Organisation is required." } : {}),
      ...(values.sourceType === "MANUAL" && values.organisationType === "DONOR_ORGANISATION" && !values.donorOrganisationId ? { donorOrganisationId: "Donor Organisation is required." } : {}),
      ...(agreementError ? { signedAgreementFileAssetId: agreementError } : {}),
    })}
    renderFields={({ values, updateValue, fieldErrors, disabled }) => {
      const sourceState = grantAwardSourceFieldState(values.sourceType);
      const selectedApplication = sources.applications.find((item) => item.id === values.fundingApplicationId);
      const selectedCommitment = sources.commitments.find((item) => item.id === values.sponsorshipCommitmentId);
      const amountControlled = selectedApplication?.approvedAmount != null || selectedCommitment?.committedAmount != null;
      const centreName = data.options.centres.find((item) => item.id === values.centreId)?.centreName ?? selectedApplication?.centreName ?? selectedCommitment?.centreName ?? "";
      const projectName = data.options.projects.find((item) => item.id === values.fundingProjectId)?.title ?? selectedApplication?.projectTitle ?? selectedCommitment?.projectTitle ?? "";
      return <>
        <Section title="1. Funding Source">
          <Field label="Source Type"><select className={fieldClassName} value={values.sourceType} disabled={disabled} onChange={(event)=>updateValue("sourceType",event.target.value)}><option value="MANUAL">Manual confirmation</option><option value="FUNDING_APPLICATION">Approved Funding Application</option><option value="SPONSORSHIP_COMMITMENT">Sponsorship Commitment</option></select></Field>
          {sourceState.showFundingApplication ? <Field label="Source Funding Application" error={fieldErrors.fundingApplicationId}><select className={fieldClassName} value={values.fundingApplicationId} disabled={disabled} onChange={(event)=>updateValue("fundingApplicationId",event.target.value)}><option value="">Select an application</option>{sources.applications.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></Field> : null}
          {sourceState.showSponsorshipCommitment ? <Field label="Source Sponsorship Commitment" error={fieldErrors.sponsorshipCommitmentId}><select className={fieldClassName} value={values.sponsorshipCommitmentId} disabled={disabled} onChange={(event)=>updateValue("sponsorshipCommitmentId",event.target.value)}><option value="">Select a commitment</option>{sources.commitments.map((item)=><option key={item.id} value={item.id}>{item.fundingProjectId ? item.label : `${item.label} · FundingProject required`}</option>)}</select></Field> : null}
          {sourceState.relationshipFieldsDisabled ? <div className="grid gap-4 md:grid-cols-3"><ReadOnlyValue label="Centre" value={centreName}/><ReadOnlyValue label="Funding Project" value={projectName}/><ReadOnlyValue label={values.sourceType === "FUNDING_APPLICATION" ? "Lead Funder" : "Lead Donor"} value={grantAwardLeadOrganisation(values,sources) ?? ""}/></div> : <><Field label="Centre" error={fieldErrors.centreId}><select className={fieldClassName} value={values.centreId} disabled={disabled} onChange={(event)=>updateValue("centreId",event.target.value)}><option value="">Select a centre</option>{data.options.centres.map((item)=><option key={item.id} value={item.id}>{item.centreName}</option>)}</select></Field><Field label="Funding Project" error={fieldErrors.fundingProjectId}><select className={fieldClassName} value={values.fundingProjectId} disabled={disabled} onChange={(event)=>updateValue("fundingProjectId",event.target.value)}><option value="">Select a project</option>{data.options.projects.filter((item)=>!values.centreId||item.centreId===values.centreId).map((item)=><option key={item.id} value={item.id}>{item.centreName} · {item.title}</option>)}</select></Field><Field label="Funding Partner Type"><select className={fieldClassName} value={values.organisationType} disabled={disabled} onChange={(event)=>updateValue("organisationType",event.target.value)}><option value="FUNDING_ORGANISATION">Funding organisation</option><option value="DONOR_ORGANISATION">Donor organisation</option></select></Field>{values.organisationType === "FUNDING_ORGANISATION" ? <Field label="Funding Organisation" error={fieldErrors.fundingOrganisationId}><select className={fieldClassName} value={values.fundingOrganisationId} disabled={disabled} onChange={(event)=>updateValue("fundingOrganisationId",event.target.value)}><option value="">Select an organisation</option>{data.options.fundingOrganisations.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field> : <Field label="Donor Organisation" error={fieldErrors.donorOrganisationId}><select className={fieldClassName} value={values.donorOrganisationId} disabled={disabled} onChange={(event)=>updateValue("donorOrganisationId",event.target.value)}><option value="">Select an organisation</option>{data.options.donorOrganisations.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>}</>}
        </Section>
        <Section title="2. Award Details">
          <div className="grid gap-4 md:grid-cols-2"><Field label="Award Number" error={fieldErrors.awardNumber}><input className={fieldClassName} value={values.awardNumber} disabled={disabled} onChange={(event)=>updateValue("awardNumber",event.target.value)}/></Field><Field label="Title" error={fieldErrors.title}><input className={fieldClassName} value={values.title} disabled={disabled} onChange={(event)=>updateValue("title",event.target.value)}/></Field></div>
          <Field label="Description"><textarea className={`${fieldClassName} resize-y`} rows={4} value={values.description} disabled={disabled} onChange={(event)=>updateValue("description",event.target.value)}/></Field>
          <div className="grid gap-4 md:grid-cols-2"><Field label="Awarded Amount" error={fieldErrors.awardedAmount} description={amountControlled ? "Set from the authoritative source amount." : undefined}><input className={fieldClassName} type="number" min="0" step="0.01" value={values.awardedAmount} disabled={disabled||amountControlled} onChange={(event)=>updateValue("awardedAmount",event.target.value===""?"":event.target.valueAsNumber)}/></Field><Field label="Currency"><input className={fieldClassName} maxLength={3} value={values.currency} disabled={disabled} onChange={(event)=>updateValue("currency",event.target.value)}/></Field><Field label="Start Date" error={fieldErrors.startDate}><input className={fieldClassName} type="date" value={values.startDate} disabled={disabled} onChange={(event)=>updateValue("startDate",event.target.value)}/></Field><Field label="End Date"><input className={fieldClassName} type="date" value={values.endDate} disabled={disabled} onChange={(event)=>updateValue("endDate",event.target.value)}/></Field></div>
        </Section>
        <Section title="3. Signed Agreement">
          <Field label="Signed Grant Agreement / Award Contract" description="Upload the agreement signed by the centre and funding partner." error={agreementError ?? fieldErrors.signedAgreementFileAssetId}><div className="mt-2 rounded-lg border border-dashed border-brand-line p-4 dark:border-slate-700"><input id="grant-award-agreement" className="sr-only" type="file" accept="application/pdf,.pdf" disabled={disabled} onChange={(event)=>{const file=event.target.files?.[0]??null;setAgreementFile(file);setAgreementError(file&&!(file.type==="application/pdf"&&file.name.toLowerCase().endsWith(".pdf"))?"Only PDF agreements are supported.":null);}}/><label htmlFor="grant-award-agreement" className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-accent px-3 py-2 text-sm font-bold text-brand-navy"><Upload className="h-4 w-4"/>{agreementFile?"Replace PDF":"Select PDF"}</label>{agreementFile?<p className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><FileText className="h-4 w-4"/>{agreementFile.name}</p>:<p className="mt-3 text-xs text-slate-500">Optional · PDF · maximum 10 MB</p>}</div></Field>
          <div className="grid gap-4 md:grid-cols-2"><Field label="Agreement date"><input className={fieldClassName} type="date" value={values.agreementDate} disabled={disabled} onChange={(event)=>updateValue("agreementDate",event.target.value)}/></Field><label className="flex items-start gap-3 rounded-lg border border-brand-line p-4 dark:border-slate-700"><input className="mt-1 h-4 w-4" type="checkbox" checked={values.signedByBothParties} disabled={disabled} onChange={(event)=>updateValue("signedByBothParties",event.target.checked)}/><span className="text-sm font-bold">Agreement signed by both parties</span></label></div>
        </Section>
        <Section title="4. Reporting Permissions"><label className="flex gap-3"><input type="checkbox" checked={values.canReview} disabled={disabled} onChange={(event)=>updateValue("canReview",event.target.checked)}/><span className="text-sm font-bold">Funder may review reports</span></label><label className="flex gap-3"><input type="checkbox" checked={values.canApprove} disabled={disabled} onChange={(event)=>updateValue("canApprove",event.target.checked)}/><span className="text-sm font-bold">Funder may approve reports</span></label></Section>
      </>;
    }}
    action={createAward}
    successToast={{title:"Grant Award created"}}
    errorToast={{title:"Award creation failed",fallbackDescription:"The award could not be created."}}
    onSuccess={()=>{setAgreementFile(null);setAgreementError(null);onSuccess();}}
  />;
}
