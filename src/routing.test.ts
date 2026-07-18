import assert from "node:assert/strict";
import test from "node:test";
import { parseRoute, routePath } from "./routing";

test("maps product URLs to application routes", () => {
  assert.deepEqual(parseRoute("/"), { page: "dashboard" });
  assert.deepEqual(parseRoute("/assurance/"), { page: "assurance" });
  assert.deepEqual(parseRoute("/report"), { page: "report" });
  assert.deepEqual(parseRoute("/radar"), { page: "radar" });
  assert.deepEqual(parseRoute("/status/private-token"), { page: "status", token: "private-token" });
  assert.deepEqual(parseRoute("/cases/RCI-001"), { page: "case", caseId: "RCI-001" });
});

test("creates canonical URLs and safely falls back for unknown paths", () => {
  assert.equal(routePath({ page: "case", caseId: "case with spaces" }), "/cases/case%20with%20spaces");
  assert.equal(routePath({ page: "dashboard" }), "/");
  assert.equal(routePath({ page: "status", token: "token with spaces" }), "/status/token%20with%20spaces");
  assert.deepEqual(parseRoute("/not-a-product-route"), { page: "dashboard" });
  assert.deepEqual(parseRoute("/cases/%E0%A4%A"), { page: "dashboard" });
});
