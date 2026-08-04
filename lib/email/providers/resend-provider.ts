import type { EmailProvider } from "./provider";
import type { EmailConfig } from "../config";
import type { EmailMessage } from "../types";
import { EmailProviderError } from "../types";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "RESEND" as const;
  constructor(private config: EmailConfig, private fetcher: typeof fetch = fetch) {}
  async health() { return { healthy: Boolean(this.config.resendApiKey && this.config.from), provider: this.name, detail: this.config.resendApiKey && this.config.from ? undefined : "RESEND_API_KEY and EMAIL_FROM are required." }; }
  async send(message: EmailMessage) {
    if (!this.config.resendApiKey || !message.from) return { status: "SKIPPED" as const, reason: "Resend credentials or sender are not configured." };
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await this.fetcher("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${this.config.resendApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: message.from, to: [message.to], subject: message.subject, html: message.html, text: message.text, ...(message.replyTo ? { reply_to: message.replyTo } : {}) }), signal: controller.signal });
      const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
      if (!response.ok) throw new EmailProviderError(`Resend rejected the request (${response.status}).`, response.status === 429 || response.status >= 500);
      if (!payload.id) throw new EmailProviderError("Resend did not return a message identifier.", false);
      return { status: "SENT" as const, messageId: payload.id };
    } catch (error) {
      if (error instanceof EmailProviderError) throw error;
      throw new EmailProviderError(error instanceof Error && error.name === "AbortError" ? "Resend request timed out." : "Resend request failed.", true);
    } finally { clearTimeout(timeout); }
  }
}
