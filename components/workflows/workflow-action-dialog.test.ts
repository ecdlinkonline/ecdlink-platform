import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the workflow dialog has one bounded panel with fixed header, scrolling body and fixed footer", () => {
  const source = readFileSync("components/workflows/workflow-action-dialog.tsx", "utf8");
  const panel = source.indexOf('className={cn("flex max-h-[calc(100dvh-1rem)]');
  const header = source.indexOf('<CardHeader className="shrink-0">', panel);
  const form = source.indexOf('className="flex min-h-0 flex-1 flex-col overflow-hidden"', header);
  const scrollBody = source.indexOf("data-workflow-dialog-scroll-body", form);
  const footer = source.indexOf("data-workflow-dialog-footer", scrollBody);
  const formEnd = source.indexOf("</form>", footer);

  assert.ok(panel >= 0);
  assert.match(source.slice(panel, header), /flex[^"]*flex-col[^"]*overflow-hidden/);
  assert.ok(header < form && form < scrollBody && scrollBody < footer && footer < formEnd);
  assert.match(source.slice(scrollBody, footer), /min-h-0 flex-1[^"]*overflow-y-auto[^"]*overscroll-contain/);
  assert.match(source.slice(footer, formEnd), /shrink-0/);
});
