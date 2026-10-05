import assert from "node:assert/strict";
import test from "node:test";
import {
  currentGrantReportingCalendarPeriod,
  grantReportingCalendarDateBounds,
  resolveGrantReportingCalendarPeriod,
  shiftGrantReportingCalendarPeriod,
} from "./calendar";

test("calendar resolves the current South African financial quarter with UTC-safe date-only boundaries", () => {
  assert.deepEqual(currentGrantReportingCalendarPeriod(new Date("2026-03-31T22:30:00.000Z")), {
    financialYear: "2026",
    quarter: 1,
    windowStart: "2026-04-01",
    windowEnd: "2026-06-30",
  });
  assert.deepEqual(currentGrantReportingCalendarPeriod("2026-10-02T23:30:00+02:00"), {
    financialYear: "2026",
    quarter: 3,
    windowStart: "2026-10-01",
    windowEnd: "2026-12-31",
  });
  assert.deepEqual(currentGrantReportingCalendarPeriod("2027-02-15"), {
    financialYear: "2026",
    quarter: 4,
    windowStart: "2027-01-01",
    windowEnd: "2027-03-31",
  });
});

test("calendar navigation crosses Q4 and Q1 financial-year boundaries", () => {
  assert.deepEqual(shiftGrantReportingCalendarPeriod(resolveGrantReportingCalendarPeriod("2026", 4), 1), resolveGrantReportingCalendarPeriod("2027", 1));
  assert.deepEqual(shiftGrantReportingCalendarPeriod(resolveGrantReportingCalendarPeriod("2026", 1), -1), resolveGrantReportingCalendarPeriod("2025", 4));
});

test("calendar date bounds are end-exclusive and preserve leap-year quarter ends", () => {
  assert.deepEqual(grantReportingCalendarDateBounds(resolveGrantReportingCalendarPeriod("2027", 4)), {
    start: new Date("2028-01-01T00:00:00.000Z"),
    endExclusive: new Date("2028-04-01T00:00:00.000Z"),
  });
});
