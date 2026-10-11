export const grantReportExportLimits = {
  financialLines: 500, indicators: 200, evidenceItems: 200, certifications: 10,
  beneficiaries: 50, racialProfileRows: 10, sustainabilityItems: 100,
  narrativeCharacters: 250_000, estimatedInputBytes: 8 * 1024 * 1024,
  generatedPdfBytes: 12 * 1024 * 1024, generationMilliseconds: 15_000,
} as const;

export class GrantReportExportLimitError extends Error {
  constructor(public readonly limit: keyof typeof grantReportExportLimits, message: string) {
    super(message);
    this.name = "GrantReportExportLimitError";
  }
}
export function assertBoundedCount(limit: keyof typeof grantReportExportLimits, count: number) {
  const maximum = grantReportExportLimits[limit];
  if (count > maximum) throw new GrantReportExportLimitError(limit, `The report exceeds the ${limit} export limit.`);
}

export function assertExportInputSize(value: unknown) {
  const estimatedBytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  if (estimatedBytes > grantReportExportLimits.estimatedInputBytes) {
    throw new GrantReportExportLimitError("estimatedInputBytes", "The report is too large to render safely.");
  }
}
