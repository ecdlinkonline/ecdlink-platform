import type { EmailProvider } from "./provider";
import type { EmailMessage } from "../types";
export class NoopEmailProvider implements EmailProvider {
  readonly name = "NOOP" as const;
  async send(_message: EmailMessage) { return { status: "SKIPPED" as const, reason: "Email provider is configured as noop." }; }
  async health() { return { healthy: true, provider: this.name, detail: "No external email delivery is configured." }; }
}
