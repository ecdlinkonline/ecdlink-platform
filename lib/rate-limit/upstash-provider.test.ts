import assert from "node:assert/strict";
import test from "node:test";
import { UpstashRateLimitProvider, UpstashRateLimitProviderError } from "./upstash-provider";

const input = { key: "ecdlink:grant_award_agreement_upload:internal-user", maximum: 10, windowMs: 600_000, now: new Date("2026-01-01T00:00:00Z") };

function fetcher(response: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): typeof fetch {
  return response as typeof fetch;
}

async function expectFailure(provider: UpstashRateLimitProvider, code: string, httpStatus?: number) {
  await assert.rejects(() => provider.consume(input), (error) => {
    assert.ok(error instanceof UpstashRateLimitProviderError);
    assert.equal(error.code, code);
    assert.equal(error.httpStatus, httpStatus);
    assert.doesNotMatch(error.message, /token|internal-user|upstash\.io/i);
    return true;
  });
}

test("classifies safe Upstash HTTP failures", async () => {
  for (const [status, code] of [[401,"http_401"],[403,"http_403"],[404,"http_404"],[429,"http_429"],[503,"http_5xx"]] as const) {
    await expectFailure(new UpstashRateLimitProvider("https://redis.example.test", "secret", fetcher(async () => new Response(null, { status }))), code, status);
  }
});

test("classifies network and timeout failures without leaking details", async () => {
  await expectFailure(new UpstashRateLimitProvider("https://redis.example.test", "secret", fetcher(async () => { throw new TypeError("network details"); })), "network");
  await expectFailure(new UpstashRateLimitProvider("https://redis.example.test", "secret", fetcher(async () => { throw new DOMException("timed out", "TimeoutError"); })), "timeout");
});

test("classifies malformed and command-error responses", async () => {
  await expectFailure(new UpstashRateLimitProvider("https://redis.example.test", "secret", fetcher(async () => Response.json({ unexpected: true }))), "malformed_response", 200);
  await expectFailure(new UpstashRateLimitProvider("https://redis.example.test", "secret", fetcher(async () => Response.json({ error: "command rejected" }))), "command_error", 200);
});

test("accepts a valid Upstash EVAL result", async () => {
  let request: RequestInit | undefined;
  const provider = new UpstashRateLimitProvider("https://redis.example.test", "secret", fetcher(async (_url, init) => {
    request = init;
    return Response.json({ result: [1, 600_000] });
  }));
  const result = await provider.consume(input);
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 9);
  assert.equal(request?.method, "POST");
  assert.equal((request?.headers as Record<string,string>).Authorization, "Bearer secret");
  assert.match(String(request?.body), /^\["EVAL"/);
});
