import assert from "node:assert/strict";
import test from "node:test";
import {
  applyQuarterlyReportingPeriod,
  resolveQuarterlyReportingPeriod,
} from "./quarterly-period";

test("South African financial-year quarters resolve to their canonical periods", () => {
  assert.deepEqual(resolveQuarterlyReportingPeriod("2026", 1), {
    reportingPeriodStart: "2026-04-01",
    reportingPeriodEnd: "2026-06-30",
  });
  assert.deepEqual(resolveQuarterlyReportingPeriod("2026", 2), {
    reportingPeriodStart: "2026-07-01",
    reportingPeriodEnd: "2026-09-30",
  });
  assert.deepEqual(resolveQuarterlyReportingPeriod("2026", 3), {
    reportingPeriodStart: "2026-10-01",
    reportingPeriodEnd: "2026-12-31",
  });
  assert.deepEqual(resolveQuarterlyReportingPeriod("2026", 4), {
    reportingPeriodStart: "2027-01-01",
    reportingPeriodEnd: "2027-03-31",
  });
});

test("canonical quarterly values replace a stale manually entered end date", () => {
  assert.deepEqual(
    applyQuarterlyReportingPeriod({
      financialYear: "2026",
      quarter: 1,
      reportingPeriodStart: "2026-04-01",
      reportingPeriodEnd: "2026-04-08",
    }),
    {
      financialYear: "2026",
      quarter: 1,
      reportingPeriodStart: "2026-04-01",
      reportingPeriodEnd: "2026-06-30",
    },
  );
});
