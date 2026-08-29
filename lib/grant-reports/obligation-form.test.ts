import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGrantObligationSubmission,
  initialGrantObligationValues,
  obligationFieldState,
  updateGrantObligationValues,
  type GrantObligationFormValues,
} from "./obligation-form";

function values(overrides: Partial<GrantObligationFormValues> = {}): GrantObligationFormValues {
  return { ...initialGrantObligationValues, ...overrides };
}

test("Interim and Final hide tranche, financial year, quarter and derive PERIOD", () => {
  for (const type of ["INTERIM", "FINAL"] as const) {
    const state = obligationFieldState(values({ type, basis: "PERIOD" }));
    assert.deepEqual({ tranche: state.showTranche, year: state.showFinancialYear, quarter: state.showQuarter, basis: state.showBasis }, { tranche: false, year: false, quarter: false, basis: false });
    assert.equal(buildGrantObligationSubmission(values({ type, basis: "FINAL" })).basis, "PERIOD");
  }
});

test("quarterly report types show year, quarter and reporting period and derive QUARTER", () => {
  for (const type of ["QUARTERLY_EXPENDITURE", "QUARTERLY_CASH_FLOW"] as const) {
    const state = obligationFieldState(values({ type, basis: "PERIOD" }));
    assert.equal(state.showFinancialYear, true);
    assert.equal(state.showQuarter, true);
    assert.equal(state.showReportingPeriod, true);
    assert.equal(state.showTranche, false);
    assert.equal(buildGrantObligationSubmission(values({ type, basis: "PERIOD" })).basis, "QUARTER");
  }
});

test("Custom exposes basis and shows tranche only for TRANCHE", () => {
  assert.equal(obligationFieldState(values({ type: "CUSTOM", basis: "PERIOD" })).showBasis, true);
  assert.equal(obligationFieldState(values({ type: "CUSTOM", basis: "PERIOD" })).showTranche, false);
  assert.equal(obligationFieldState(values({ type: "CUSTOM", basis: "TRANCHE" })).showTranche, true);
});

test("report type changes clear hidden stale values and submission omits them", () => {
  const changed = updateGrantObligationValues(values({ type: "INTERIM", basis: "TRANCHE", grantTrancheId: "tranche-1", financialYear: "2027", quarter: 4, description: "Keep this" }), "type");
  assert.deepEqual({ basis: changed.basis, tranche: changed.grantTrancheId, year: changed.financialYear, quarter: changed.quarter }, { basis: "PERIOD", tranche: "", year: "", quarter: "" });
  const payload = buildGrantObligationSubmission(changed);
  assert.equal("grantTrancheId" in payload, false);
  assert.equal("financialYear" in payload, false);
  assert.equal("quarter" in payload, false);
});

test("quarterly title follows year and quarter until the user edits it", () => {
  let current = updateGrantObligationValues(values({ type: "QUARTERLY_EXPENDITURE", basis: "QUARTER", financialYear: "2027", quarter: 1 }), "financialYear");
  assert.equal(current.title, "Quarterly Expenditure Report - Q1 2027");
  current = updateGrantObligationValues({ ...current, quarter: 2 }, "quarter");
  assert.equal(current.title, "Quarterly Expenditure Report - Q2 2027");
  current = updateGrantObligationValues({ ...current, title: "My reviewed title" }, "title");
  current = updateGrantObligationValues({ ...current, quarter: 3 }, "quarter");
  assert.equal(current.title, "My reviewed title");
});
