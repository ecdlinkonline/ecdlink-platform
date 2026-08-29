export const grantObligationTypes = ["INTERIM", "FINAL", "QUARTERLY_EXPENDITURE", "QUARTERLY_CASH_FLOW", "CUSTOM"] as const;
export const grantObligationBases = ["QUARTER", "TRANCHE", "PERIOD", "FINAL", "CUSTOM"] as const;

export type GrantObligationType = (typeof grantObligationTypes)[number];
export type GrantObligationBasis = (typeof grantObligationBases)[number];

export type GrantObligationFormValues = {
  grantAwardId: string;
  grantTrancheId: string;
  type: GrantObligationType;
  basis: GrantObligationBasis;
  title: string;
  titleCustomized: boolean;
  description: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  financialYear: string;
  quarter: number | "";
  dueAt: string;
  requiresFunderApproval: boolean;
  requiresSuperAdminApproval: boolean;
};

export const initialGrantObligationValues: GrantObligationFormValues = {
  grantAwardId: "",
  grantTrancheId: "",
  type: "INTERIM",
  basis: "PERIOD",
  title: "",
  titleCustomized: false,
  description: "",
  reportingPeriodStart: "",
  reportingPeriodEnd: "",
  financialYear: "",
  quarter: "",
  dueAt: "",
  requiresFunderApproval: true,
  requiresSuperAdminApproval: false,
};

export function derivedObligationBasis(type: GrantObligationType): GrantObligationBasis | null {
  if (type === "INTERIM" || type === "FINAL") return "PERIOD";
  if (type === "QUARTERLY_EXPENDITURE" || type === "QUARTERLY_CASH_FLOW") return "QUARTER";
  return null;
}

export function obligationFieldState(values: Pick<GrantObligationFormValues, "type" | "basis">) {
  const effectiveBasis = derivedObligationBasis(values.type) ?? values.basis;
  return {
    showBasis: values.type === "CUSTOM",
    showTranche: effectiveBasis === "TRANCHE",
    showFinancialYear: effectiveBasis === "QUARTER",
    showQuarter: effectiveBasis === "QUARTER",
    showReportingPeriod: effectiveBasis === "QUARTER" || effectiveBasis === "PERIOD" || effectiveBasis === "FINAL",
    showDescription: values.type === "INTERIM" || values.type === "FINAL" || values.type === "CUSTOM",
  };
}

export function suggestedQuarterlyTitle(type: GrantObligationType, financialYear: string, quarter: number | "") {
  if (type !== "QUARTERLY_EXPENDITURE" && type !== "QUARTERLY_CASH_FLOW") return "";
  const reportName = type === "QUARTERLY_EXPENDITURE" ? "Quarterly Expenditure Report" : "Quarterly Cash Flow Report";
  return financialYear.trim() && quarter ? `${reportName} - Q${quarter} ${financialYear.trim()}` : reportName;
}

export function updateGrantObligationValues(
  values: GrantObligationFormValues,
  changedField: keyof GrantObligationFormValues,
): GrantObligationFormValues {
  if (changedField === "title") return { ...values, titleCustomized: true };

  if (changedField === "grantAwardId") return { ...values, grantTrancheId: "" };

  if (changedField === "type") {
    const basis = derivedObligationBasis(values.type) ?? "CUSTOM";
    const state = obligationFieldState({ type: values.type, basis });
    return {
      ...values,
      basis,
      grantTrancheId: "",
      financialYear: state.showFinancialYear ? values.financialYear : "",
      quarter: state.showQuarter ? values.quarter || 1 : "",
      reportingPeriodStart: state.showReportingPeriod ? values.reportingPeriodStart : "",
      reportingPeriodEnd: state.showReportingPeriod ? values.reportingPeriodEnd : "",
      description: state.showDescription ? values.description : "",
      title: values.titleCustomized ? values.title : suggestedQuarterlyTitle(values.type, values.financialYear, state.showQuarter ? values.quarter || 1 : ""),
    };
  }

  if (changedField === "basis" && values.type === "CUSTOM") {
    const state = obligationFieldState(values);
    return {
      ...values,
      grantTrancheId: state.showTranche ? values.grantTrancheId : "",
      financialYear: state.showFinancialYear ? values.financialYear : "",
      quarter: state.showQuarter ? values.quarter || 1 : "",
      reportingPeriodStart: state.showReportingPeriod ? values.reportingPeriodStart : "",
      reportingPeriodEnd: state.showReportingPeriod ? values.reportingPeriodEnd : "",
    };
  }

  if ((changedField === "financialYear" || changedField === "quarter") && !values.titleCustomized) {
    return { ...values, title: suggestedQuarterlyTitle(values.type, values.financialYear, values.quarter) };
  }

  return values;
}

export function buildGrantObligationSubmission(values: GrantObligationFormValues) {
  const basis = derivedObligationBasis(values.type) ?? values.basis;
  const state = obligationFieldState({ type: values.type, basis });
  return {
    grantAwardId: values.grantAwardId,
    type: values.type,
    basis,
    title: values.title,
    ...(state.showDescription && values.description.trim() ? { description: values.description } : {}),
    ...(state.showTranche ? { grantTrancheId: values.grantTrancheId } : {}),
    ...(state.showReportingPeriod ? { reportingPeriodStart: values.reportingPeriodStart, reportingPeriodEnd: values.reportingPeriodEnd } : {}),
    ...(state.showFinancialYear ? { financialYear: values.financialYear } : {}),
    ...(state.showQuarter ? { quarter: values.quarter } : {}),
    dueAt: values.dueAt,
    requiresFunderApproval: values.requiresFunderApproval,
    requiresSuperAdminApproval: values.requiresSuperAdminApproval,
  };
}
