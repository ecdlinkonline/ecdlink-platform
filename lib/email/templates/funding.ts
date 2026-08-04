import type { EmailTemplateInput } from "../types";
import { emailLayout } from "./layout";
export function fundingEmailTemplate(input: EmailTemplateInput & { url?: string }) {
  const copy = {
    FUNDING_APPLICATION_APPROVED: ["Funding application approved", input.body],
    FUNDING_APPLICATION_REJECTED: ["Funding application decision", input.body],
    FUNDING_APPLICATION_CLARIFICATION_REQUESTED: ["Clarification requested", input.body],
    FUNDING_APPLICATION_REVIEWER_ASSIGNED: ["Funding review assigned", input.body],
    FUNDING_DOCUMENT_VERIFIED: ["Funding document verified", input.body],
    FUNDING_DOCUMENT_RESUBMISSION_REQUESTED: ["Document resubmission requested", input.body],
  } as const;
  const content = copy[input.type as keyof typeof copy]; if (!content) return null;
  const [subject, body] = content; return { subject, ...emailLayout({ heading: subject, body, url: input.url }) };
}
