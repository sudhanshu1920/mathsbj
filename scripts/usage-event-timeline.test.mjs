import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

test("native usage aggregation handles lifecycle boundaries and percentages", () => {
  const output = execFileSync("sh", ["tools/usage-event-timeline/run-tests.sh"], {
    encoding: "utf8",
  });
  assert.match(output, /Usage aggregation: 9 scenarios passed/);
  assert.match(output, /UsageStats day buckets: 4 scenarios passed/);
});
