import type { GrantReportExportData } from "@/lib/grant-report-export/types";

export type ExportTable = { headers: string[]; rows: string[][]; widths: number[] };
export type ExportSection = { title: string; paragraphs?: string[]; table?: ExportTable };

function present(value: string | null | undefined) {
  return value?.trim() || "Not recorded";
}

function money(value: string | null, currency: string) {
  if (value === null) return "Not recorded";
  const match = value.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return "Not recorded";
  const whole = BigInt(match[2]).toLocaleString("en-US");
  const fraction = (match[3] ?? "").padEnd(2, "0").slice(0, 2);
  const sign = match[1] ? "-" : "";
  return currency.toUpperCase() === "ZAR" ? `${sign}R${whole}.${fraction}` : `${sign}${currency.toUpperCase()} ${whole}.${fraction}`;
}

function financialSummary(data: GrantReportExportData): ExportSection {
  return {
    title: "Financial summary",
    table: {
      headers: ["Measure", "Amount"],
      widths: [0.62, 0.38],
      rows: [
        ["Funding received", money(data.totals.fundingReceived, data.report.currency)],
        ["Other income", money(data.totals.otherIncome, data.report.currency)],
        ["Total income", money(data.totals.totalIncome, data.report.currency)],
        ["Total expenditure", money(data.totals.totalExpenditure, data.report.currency)],
        ["Surplus / deficit", money(data.totals.surplusDeficit, data.report.currency)],
      ],
    },
  };
}

function evidence(data: GrantReportExportData): ExportSection {
  return {
    title: "Evidence register",
    paragraphs: data.evidence.length ? undefined : ["No supporting evidence is recorded for this report version."],
    table: data.evidence.length ? {
      headers: ["Type", "Title", "File", "Checksum"],
      widths: [0.18, 0.3, 0.32, 0.2],
      rows: data.evidence.map((item) => [
        item.documentType.replaceAll("_", " "),
        item.title,
        item.originalFilename,
        item.checksum ?? "Unavailable",
      ]),
    } : undefined,
  };
}

function certifications(data: GrantReportExportData): ExportSection {
  return {
    title: "Certification",
    paragraphs: data.certifications.length ? undefined : ["No certification is recorded for this report version."],
    table: data.certifications.length ? {
      headers: ["Party", "Name", "Designation", "Confirmed"],
      widths: [0.18, 0.27, 0.3, 0.25],
      rows: data.certifications.map((item) => [
        item.party,
        item.name,
        item.designation,
        item.digitallyConfirmed ? present(item.confirmedAt) : "No",
      ]),
    } : undefined,
  };
}

function integrity(data: GrantReportExportData): ExportSection {
  const paragraphs = [
    "This export uses content owned by the explicitly selected report version.",
    "No claim of byte-identical reproduction is made for legacy submissions.",
  ];
  if (data.historicalIntegrity.unavailableSnapshots.length) {
    paragraphs.push(`Historical snapshot information unavailable: ${data.historicalIntegrity.unavailableSnapshots.join(", ")}.`);
  }
  if (data.readiness.state) paragraphs.push(`Submission readiness recorded as ${data.readiness.state.replaceAll("_", " ")}.`);
  if (data.readiness.warnings?.length) {
    paragraphs.push(...data.readiness.warnings.map((warning) => `${warning.title}: ${warning.detail}`));
  }
  return { title: "Historical integrity", paragraphs };
}

function shared(data: GrantReportExportData) {
  return [financialSummary(data), certifications(data), evidence(data), integrity(data)];
}

function quarterlyCashFlow(data: GrantReportExportData): ExportSection[] {
  return [
    {
      title: "Quarterly cash flow",
      table: {
        headers: ["Category", "Budget", "Expenditure", "Variance"],
        widths: [0.4, 0.2, 0.2, 0.2],
        rows: data.financialLines.map((line) => [
          line.categoryName,
          money(line.quarterlyBudget, data.report.currency),
          money(line.estimatedExpenditure ?? line.quarterlyActual, data.report.currency),
          money(line.variance, data.report.currency),
        ]),
      },
    },
    ...shared(data),
  ];
}

function quarterlyExpenditure(data: GrantReportExportData): ExportSection[] {
  return [
    {
      title: "Quarterly expenditure",
      table: {
        headers: ["Category", "Budget", "Funding", "Other", "Actual"],
        widths: [0.32, 0.17, 0.17, 0.17, 0.17],
        rows: data.financialLines.map((line) => [
          line.categoryName,
          money(line.quarterlyBudget, data.report.currency),
          money(line.fundingSourceActual, data.report.currency),
          money(line.otherSourceActual, data.report.currency),
          money(line.quarterlyActual, data.report.currency),
        ]),
      },
    },
    ...shared(data),
  ];
}

function nlc(data: GrantReportExportData): ExportSection[] {
  const narrativeRows = [
    ["Executive summary", data.narratives.executiveSummary],
    ["Objectives", data.narratives.objectives],
    ["Deliverables", data.narratives.deliverables],
    ["Challenges", data.narratives.challenges],
    ["Lessons learned", data.narratives.lessonsLearned],
    ["Next steps", data.narratives.nextSteps],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  return [
    { title: "Programme narrative", paragraphs: narrativeRows.length ? narrativeRows.map(([label, value]) => `${label}: ${value}`) : ["No programme narrative is recorded."] },
    {
      title: "Indicators",
      paragraphs: data.indicators.length ? undefined : ["No indicators are recorded."],
      table: data.indicators.length ? {
        headers: ["Objective", "Indicator", "Target", "Achieved", "Status"],
        widths: [0.24, 0.26, 0.16, 0.16, 0.18],
        rows: data.indicators.map((row) => [row.objective, row.indicator, present(row.target), present(row.achieved), row.status.replaceAll("_", " ")]),
      } : undefined,
    },
    {
      title: "Beneficiaries",
      paragraphs: data.beneficiaries.length ? undefined : ["No beneficiary profile is recorded."],
      table: data.beneficiaries.length ? {
        headers: ["Category", "Total", "Male", "Female"],
        widths: [0.4, 0.2, 0.2, 0.2],
        rows: data.beneficiaries.map((row) => [row.category.replaceAll("_", " "), String(row.total), String(row.male), String(row.female)]),
      } : undefined,
    },
    ...shared(data),
  ];
}

export function buildGrantReportExportSections(data: GrantReportExportData): ExportSection[] {
  if (data.report.reportType === "QUARTERLY_CASH_FLOW") return quarterlyCashFlow(data);
  if (data.report.reportType === "QUARTERLY_EXPENDITURE") return quarterlyExpenditure(data);
  if (data.report.reportType === "INTERIM" || data.report.reportType === "FINAL") return nlc(data);
  throw new Error(`Unsupported report type: ${data.report.reportType}`);
}

export const grantReportExportPresentation = { money };
