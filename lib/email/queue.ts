import type { EmailDeliveryJob } from "./types";
export interface EmailQueue { enqueue(job: EmailDeliveryJob): Promise<void>; }
export class ImmediateEmailQueue implements EmailQueue {
  constructor(private handler: (job: EmailDeliveryJob) => Promise<void>) {}
  async enqueue(job: EmailDeliveryJob) { await this.handler(job); }
}
export const exponentialBackoffMs = (attempt: number) => 1000 * 2 ** Math.max(0, attempt - 1);
