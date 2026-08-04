import type { EmailTemplateInput } from "../types";
import { fundingEmailTemplate } from "../templates/funding";
export function buildEmailTemplate(input: EmailTemplateInput, baseUrl: string) { return fundingEmailTemplate({ ...input, url: input.href ? `${baseUrl}${input.href}` : undefined }); }
