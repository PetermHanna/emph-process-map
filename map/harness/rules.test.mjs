// Rules with no UI or Dataverse. Run from map/: node --test harness/rules.test.mjs (needs pcf/node_modules for TypeScript)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(root, "pcf/package.json"))("typescript");
const out = mkdtempSync(join(tmpdir(), "emph-"));
const src = join(root, "pcf/ProcessMap/src/domain");
// Transpile the domain modules side by side, pointing their relative imports at the .mjs output.
for (const name of ["codes", "types", "session", "rules", "documents"]) {
  const js = ts.transpileModule(readFileSync(join(src, name + ".ts"), "utf8"), { compilerOptions: { module: "ESNext", target: "ES2020" } }).outputText
    .replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(out, name + ".mjs"), js);
}
const load = name => import(pathToFileURL(join(out, name + ".mjs")));
const C = await load("codes");
const R = await load("rules");
const S = await load("session");
const D = await load("documents");

let n = 0;
const req = p => ({ id: "r" + ++n, reqId: "", name: "n", description: "d", processId: "p1", origin: C.REQ_ORIGIN.captured, originRef: "", originFlowId: null, review: false,
  moscow: null, category: null, raisedBy: "", verbatim: "", owner: "", state: C.REQ_STATE.draft, coverage: null, size: null, evidenceFlowId: null, resolution: "", resolvedBy: "", resolvedOn: null,
  workshopId: null, parentId: null, duplicateOfId: null, ...p });
const act = (code, p = {}) => ({ id: code, flowId: "f", code, name: code, shape: C.SHAPE.activity, lane: "L", stage: "", links: [], summary: "", delta: C.DELTA.same, rank: 0, ...p });
const L = (...to) => to.map(t => ({ to: t, label: "" }));

test("option values start at the new base and keep their order", () => {
  assert.equal(C.BASE, 582100000);
  assert.equal(C.COVERAGE.gap, 582100003);
  assert.equal(C.REQ_STATE_LABEL[582100002], "Agreed");
});

test("coverage is the weakest rated active requirement", () => {
  const gap = req({ coverage: C.COVERAGE.gap });
  const r = R.processCoverage([req({ coverage: C.COVERAGE.standard }), gap, req(), req({ coverage: C.COVERAGE.gap, state: C.REQ_STATE.rejected }), req({ processId: "p2", coverage: C.COVERAGE.gap })], "p1");
  assert.equal(r.coverage, C.COVERAGE.gap); assert.equal(r.weakest, gap); assert.equal(r.rated, 2); assert.equal(r.unrated, 1);
  assert.equal(R.processCoverage([req()], "p1").coverage, null);
});

test("active excludes rejected, duplicate and deferred only", () => {
  assert.ok(R.isActive({ state: C.REQ_STATE.agreed }));
  for (const s of [C.REQ_STATE.rejected, C.REQ_STATE.duplicate, C.REQ_STATE.deferred]) assert.ok(!R.isActive({ state: s }));
});

test("a title is the first line, cut to length", () => {
  assert.equal(R.titleOf("  First line\nsecond"), "First line");
  assert.equal(R.titleOf("x".repeat(250)).length, 200);
  assert.equal(R.requirementProblem({ description: " " }), "A requirement needs a description.");
  assert.equal(R.requirementProblem({ description: "ok" }), null);
});

test("differences find added, changed and removed, by type and key", () => {
  const a = { type: 1, key: "a", name: "A", description: "", snapshot: { x: 1 } };
  const b = { type: 1, key: "b", name: "B", description: "", snapshot: { x: 1 } };
  const d = R.differences([a, b], [{ ...a, snapshot: { x: 2 } }, { type: 2, key: "b", name: "B", description: "", snapshot: { x: 1 } }]);
  assert.deepEqual(d.map(x => x.kind).sort(), ["added", "changed", "removed"]);
  assert.deepEqual(d.find(x => x.kind === "changed").fields, ["x"]);
  assert.deepEqual(R.differences([{ ...a, snapshot: {} }], [{ ...a, snapshot: { x: null } }]), []);
});

test("a sign-off in review can be approved unless a newer one is approved", () => {
  const s1 = { version: 1, state: C.SIGNOFF.review }, s2 = { version: 2, state: C.SIGNOFF.approved };
  assert.ok(R.canApprove(s1, [s1]));
  assert.ok(!R.canApprove(s1, [s1, s2]));
  assert.ok(!R.canApprove({ version: 3, state: C.SIGNOFF.draft }, []));
});

test("own process codes run in their own series", () => {
  assert.equal(R.nextOwnCode(["65.10.010", "X002", "X010"]), "X011");
  assert.equal(R.nextOwnCode([]), "X001");
});

test("a starter flow runs from Start to End", () => {
  const s = R.starterActivities("Owner");
  assert.equal(s.length, 2); assert.equal(s[0].links[0].to, s[1].code); assert.equal(s[1].shape, C.SHAPE.end);
});

test("adding an activity counts once, not its rewired neighbour", () => {
  const ref = [act("A10", { shape: C.SHAPE.start, links: L("A20") }), act("A20", { links: L("A90") }), act("A90", { shape: C.SHAPE.end })];
  const ours = [act("A10", { shape: C.SHAPE.start, links: L("A20") }), act("A20", { links: L("A95"), delta: C.DELTA.changed }), act("A95", { links: L("A90"), delta: C.DELTA.added }), act("A90", { shape: C.SHAPE.end })];
  assert.deepEqual(R.flowDeltas(ours, ref).map(d => d.code + ":" + d.kind), ["A95:added"]);
});

test("a renamed activity or a new lane counts as changed", () => {
  const ref = [act("A10", { links: L("A20") }), act("A20")];
  assert.deepEqual(R.flowDeltas([act("A10", { links: L("A20"), name: "Other" }), act("A20", { lane: "M" })], ref).map(d => d.code), ["A10", "A20"]);
});

test("unreachable activities are found, leaving out Start", () => {
  const ref = [act("A10", { shape: C.SHAPE.start, links: L("A20") }), act("A20")];
  const ours = [act("A10", { shape: C.SHAPE.start, links: [] }), act("A20")];
  assert.deepEqual(R.unreachable(ours, ref).map(a => a.code), ["A20"]);
});

test("covered codes and delta text", () => {
  assert.ok(R.covers("A10,A20", "A20"));
  assert.equal(R.coveredBy([{ code: "A1" }, { code: "A2" }], { A1: "r1", A2: "r2" }, "r1"), "A1");
  assert.equal(R.deltaText({ code: "A1", name: "Check", kind: "added", rationale: " needed " }), "New activity “Check”: needed");
});

test("hand edits on a generated requirement are noticed", () => {
  assert.ok(!R.touchedByHand(req({ description: "x" }), "x"));
  assert.ok(R.touchedByHand(req({ description: "y" }), "x"));
  assert.ok(R.touchedByHand(req({ owner: "Ann" }), null));
});

test("next activity code steps by five", () => {
  assert.equal(R.nextActivityCode([{ code: "A10" }, { code: "A90" }]), "A95");
  assert.equal(R.nextActivityCode([]), "A5");
});

test("a workshop has seven phases and records visits once", () => {
  assert.equal(S.PHASES.length, 7);
  const a = S.visit(S.newSession(), "p1", "One", "2026-11-08T10:00:00Z");
  assert.equal(S.visit(a, "p1", "One", "2026-11-08T10:05:00Z"), a);
  assert.equal(S.visit(a, "p2", "Two", "2026-11-08T10:05:00Z").visits.length, 2);
  assert.ok(S.wasVisited(a.visits, "p1"));
});

test("minutes per visit add up repeated visits", () => {
  const v = [{ key: "a", name: "A", at: "2026-11-08T10:00:00Z" }, { key: "b", name: "B", at: "2026-11-08T10:10:00Z" }, { key: "a", name: "A", at: "2026-11-08T10:15:00Z" }];
  assert.deepEqual(S.minutesPerVisit(v, "2026-11-08T10:20:00Z"), [{ key: "a", name: "A", minutes: 15 }, { key: "b", name: "B", minutes: 5 }]);
});

test("the summary uses fixed phrases and asks about missing owners", () => {
  const lines = S.summaryLines([{ reqId: "RQ-1", description: "Permit check", owner: "", resolution: "Add a step", resolvedBy: "Ann" }],
    [{ name: "Invoice", disposition: C.DISPOSITION.transition, visited: true }, { name: "Other", disposition: C.DISPOSITION.retain, visited: false }],
    [{ text: "Send the form", owner: "Bo", due: "2026-11-20" }, { text: "Done", owner: "", due: "", done: true }]);
  assert.deepEqual(lines, ["Requirement: Permit check (RQ-1)", "Decision: Add a step, decided by Ann", "Decision: Invoice: Transition", "Open point: who owns RQ-1?", "Open point: Send the form, owner Bo, by 2026-11-20"]);
});

test("a broken session falls back to empty", () => {
  assert.deepEqual(S.readSession("{bad"), S.newSession());
  assert.deepEqual(S.readSession(JSON.stringify({ processIds: ["p"], current: "p" })).processIds, ["p"]);
});

test("sign-off tables use labels, not option values", () => {
  const items = [{ type: C.ITEM.requirement, key: "r", name: "R", description: "Need", snapshot: { reqId: "RQ-1", moscow: C.BASE, coverage: C.COVERAGE.gap, state: C.REQ_STATE.agreed } },
    { type: C.ITEM.scope, key: "p", name: "Invoice", description: "", snapshot: { code: "X001", area: "A", inScope: false } }];
  const [reqs, , , scope] = D.signOffTables(items);
  assert.deepEqual(reqs.rows[0].slice(0, 8), ["RQ-1", "Need", "", "", "Must", "", "Agreed", "Gap"]);
  assert.deepEqual(scope.rows[0], ["X001", "Invoice", "A", "No"]);
});

test("the document escapes content, marks drafts and lists out-of-scope processes", () => {
  const items = [{ type: C.ITEM.requirement, key: "r", name: "R", description: "<b>x</b>", snapshot: {} }, { type: C.ITEM.scope, key: "p", name: "Out", description: "", snapshot: { inScope: false } }, { type: C.ITEM.scope, key: "q", name: "In", description: "", snapshot: { inScope: true } }];
  const html = D.signOffDocument("T", [["A", "B"]], items, false);
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;")); assert.ok(html.includes("DRAFT"));
  assert.ok(html.includes("1 of 2 business processes in scope")); assert.ok(html.includes("<td>Out</td>")); assert.ok(!html.includes("<td>In</td>"));
  assert.ok(!D.signOffDocument("T", [], items, true).includes("DRAFT"));
});

test("the workbook is a zip with one part per table", () => {
  const z = D.workbook([{ title: "One", columns: ["a"], rows: [["1"]] }, { title: "Two", columns: ["b"], rows: [] }]);
  assert.equal(String.fromCharCode(z[0], z[1]), "PK");
  assert.ok(new TextDecoder().decode(z).includes("xl/worksheets/sheet2.xml"));
});
