import type { SubmissionReadinessCheck } from "@/lib/grant-reports/submission-readiness";

export function grantReportEmptyStateMessage() {
  return "Reports are created automatically as Drafts when a reporting obligation is added to a confirmed Grant Award.";
}

export function grantReadinessPresentation(check: SubmissionReadinessCheck, submitted: boolean) {
  if (!submitted) return { detail: check.detail, guidance: check.guidance };
  const detail = check.id === "reconciliation" && check.status === "NEEDS_REVIEW"
    ? "Financial review notices remain visible in the saved report and linked evidence."
    : check.detail;
  const guidance = check.guidance
    ? check.href ? "Review this statement's source evidence." : check.section === "financial_reconciliation" ? "Review the linked source evidence." : "Historical review finding based on the saved report."
    : undefined;
  return { detail, guidance };
}
