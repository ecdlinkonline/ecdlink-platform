import assert from "node:assert/strict";
import test from "node:test";
import { buildEmailTemplate } from "./builders/funding";
import { getEmailConfig } from "./config";
import { ImmediateEmailQueue, exponentialBackoffMs } from "./queue";
import { NoopEmailProvider } from "./providers/noop-provider";
import { ResendEmailProvider } from "./providers/resend-provider";
import { decideEmailDelivery } from "./service";

test("email configuration defaults to noop and caps retry attempts", () => {
  assert.equal(getEmailConfig({ EMAIL_MAX_ATTEMPTS: "20" }).provider, "NOOP");
  assert.equal(getEmailConfig({ EMAIL_MAX_ATTEMPTS: "20" }).maxAttempts, 3);
});
test("preference decisions separate in-app and email delivery", () => {
  assert.deepEqual(decideEmailDelivery("NONE"), { preference: "NONE", inAppVisible: false, emailStatus: null });
  assert.equal(decideEmailDelivery("IN_APP").emailStatus, "SKIPPED");
  assert.equal(decideEmailDelivery("EMAIL").inAppVisible, false);
  assert.equal(decideEmailDelivery("BOTH").emailStatus, "PENDING");
});
test("funding templates include escaped HTML and plain text", () => {
  const template = buildEmailTemplate({ type: "FUNDING_APPLICATION_APPROVED", title: "Approved", body: "Centre <script>", href: "/funding/1" }, "https://ecdlink.test");
  assert.ok(template?.html.includes("Centre &lt;script&gt;"));
  assert.ok(template?.text.includes("Centre <script>"));
  assert.equal(buildEmailTemplate({ type: "FUNDING_MANUAL_COMMUNICATION", title: "Manual", body: "Body" }, "https://ecdlink.test"), null);
});
test("noop provider always skips", async () => {
  const result = await new NoopEmailProvider().send({ to: "a@example.com", from: "b@example.com", subject: "Test", html: "<p>Test</p>", text: "Test" });
  assert.equal(result.status, "SKIPPED");
});
test("Resend provider uses fetch and returns the provider message id", async () => {
  const fetcher = async () => new Response(JSON.stringify({ id: "email-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
  const config = getEmailConfig({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "secret", EMAIL_FROM: "ECDLink <mail@example.com>" });
  const result = await new ResendEmailProvider(config, fetcher as typeof fetch).send({ to: "a@example.com", from: config.from, subject: "Test", html: "<p>Test</p>", text: "Test" });
  assert.deepEqual(result, { status: "SENT", messageId: "email-1" });
});
test("immediate queue executes jobs and retry backoff is exponential", async () => {
  const jobs: string[] = []; const queue = new ImmediateEmailQueue(async (job) => { jobs.push(job.deliveryLogId); });
  await queue.enqueue({ deliveryLogId: "delivery-1" });
  assert.deepEqual(jobs, ["delivery-1"]);
  assert.deepEqual([1, 2, 3].map(exponentialBackoffMs), [1000, 2000, 4000]);
});
