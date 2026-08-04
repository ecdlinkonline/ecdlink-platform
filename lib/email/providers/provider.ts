import type { EmailMessage, EmailProviderHealth, EmailProviderResult } from "../types";
import type { EmailProviderName } from "@prisma/client";
export interface EmailProvider { readonly name: EmailProviderName; send(message: EmailMessage): Promise<EmailProviderResult>; health(): Promise<EmailProviderHealth>; }
