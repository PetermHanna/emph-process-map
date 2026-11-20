// Rules with no UI or Dataverse. Run from map/: node --test harness/rules.test.mjs (needs pcf/node_modules for TypeScript)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(root, "pcf/package.json"))("typescript");
const out = mkdtempSync(join(tmpdir(), "emph-"));
const src = join(root, "pcf/ProcessMap/src/domain");
// Transpile the domain modules side by side, pointing their relative imports at the .mjs output.
for (const name of ["codes", "types", "workshop", "session", "rules", "documents", "drawing"]) {
  const js = ts.transpileModule(readFileSync(join(src, name + ".ts"), "utf8"), { compilerOptions: { module: "ESNext", target: "ES2020" } }).outputText
    .replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(out, name + ".mjs"), js);
}
// the flow editor's placement rules live next to the canvas; they import only shape.ts and the codes
for (const name of ["shape", "placement"]) {
  const js = ts.transpileModule(readFileSync(join(root, "pcf/ProcessMap/src/ui/flow", name + ".ts"), "utf8"), { compilerOptions: { module: "ESNext", target: "ES2020" } }).outputText
    .replace(/from "\.\.\/\.\.\/domain\/(\w+)"/g, 'from "./$1.mjs"').replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(out, name + ".mjs"), js);
}
const load = name => import(pathToFileURL(join(out, name + ".mjs")));
const C = await load("codes");
const R = await load("rules");
const S = await load("session");
const D = await load("documents");
const P = await load("placement");
const W = await load("workshop");
const DR = await load("drawing");

let n = 0;
const req = p => ({ id: "r" + ++n, reqId: "", name: "n", description: "d", itemId: "p1", origin: C.REQ_ORIGIN.captured, originRef: "", originFlowId: null, review: false,
  type: null, fitGap: null, gapApproach: null, scopeApproach: "", acceptanceCriteria: "", mapping: "", priority: null, approval: C.APPROVAL.new, author: null, complexity: null,
  owner: "", approvedBy: "", approvedOn: null, closedReason: "", sourceType: "", sourceText: "", raisedBy: "", workshopId: null, evidenceFlowId: null, ...p });
// a small catalog tree: e (L1) > a (L2) > p (L3) > s1, s2 (L4)
const node = (id, level, parentId, p = {}) => ({ id, level, parentId, scope: C.SCOPE.in, products: "", ...p });
const act = (code, p = {}) => ({ id: code, flowId: "f", code, name: code, shape: C.SHAPE.activity, lane: "L", stage: "", links: [], summary: "", delta: C.DELTA.same, rank: 0, ...p });
const L = (...to) => to.map(t => ({ to: t, label: "" }));

test("option values are 582100000 + the label's position in Microsoft's list", () => {
  assert.equal(C.BASE, 582100000);
  assert.equal(C.SCOPE.in, 582100001); assert.equal(C.FIT_GAP.gap, 582100001); assert.equal(C.GAP_UNSPECIFIED, 582100000);
  assert.equal(C.APPROVAL.approved, 582100003); assert.equal(C.CATALOG_CUSTOM, 582100004); assert.equal(C.AUTHOR.project, 582100002);
  assert.equal(C.labelOf("businessApprovalState", 582100002), "In review"); assert.equal(C.labelOf("scope", 582100009), "");
  assert.equal(C.option("products", "Field Service"), 582100011); assert.equal(C.option("products", "Dynamics 365 Field Service"), null);
});

// Microsoft's picklists must be exactly as Business Map's msTemplate.ts (itself checked against "ADO template guidelines - OCT 2026.xlsx").
// The file is read from the sibling folder, or from EMPH_MS_TEMPLATE; the test is skipped where it isn't (the public repo alone).
const MS_TEMPLATE = process.env.EMPH_MS_TEMPLATE || join(root, "../../elevion-business-map/company-model/pcf/CompanyModel/app/msTemplate.ts");
test("Microsoft's picklists match msTemplate.ts, list by list and value by value", { skip: !existsSync(MS_TEMPLATE) && "msTemplate.ts not found: " + MS_TEMPLATE }, async () => {
  const js = ts.transpileModule(readFileSync(MS_TEMPLATE, "utf8"), { compilerOptions: { module: "ESNext", target: "ES2020" } }).outputText;
  writeFileSync(join(out, "msTemplate.mjs"), js);
  const M = await load("msTemplate");
  assert.deepEqual(Object.keys(C.MS_PICKLISTS).sort(), Object.keys(M.MS_PICKLISTS).sort());
  for (const k of Object.keys(M.MS_PICKLISTS)) assert.deepEqual([...C.MS_PICKLISTS[k]], [...M.MS_PICKLISTS[k]], k);
  assert.deepEqual([...C.OURS.raidType], [...M.RAID_TYPES]); assert.deepEqual([...C.OURS.licenceType], [...M.LICENCE_TYPES]);
  assert.deepEqual(Object.fromEntries(Object.entries(M.MOSCOW_PRIORITY).map(([k, v]) => [k, C.option("priority", v)])), Object.fromEntries(Object.entries(C.MOSCOW_LABEL).map(([v, k]) => [k, Number(v)])));
});

// install.js and sample-data.js are pasted into a browser console, so they carry their own copy of the lists: it must match codes.ts.
const listsIn = (file, begin, end) => { const t = readFileSync(join(root, "schema", file), "utf8"); const i = t.indexOf(begin), j = t.indexOf(end, i); return Function("return " + t.slice(t.indexOf("{", i), t.lastIndexOf("}", j) + 1))(); };
test("install.js creates every choice list exactly as codes.ts", () => {
  const L = listsIn("install.js", "const LISTS = {", "// LISTS-END");
  assert.deepEqual(L, JSON.parse(JSON.stringify({ ...C.MS_PICKLISTS, ...C.OURS })));
});
test("sample-data.js uses the same lists as codes.ts", () => {
  const L = listsIn("sample-data.js", "const LISTS = {", "  const V = n");
  for (const [k, v] of Object.entries(L)) assert.deepEqual(v, [...C.listOf(k)], k);
});

test("scope greys the children: an item counts as in scope only when every parent is", () => {
  const items = [node("e", 1, null), node("a", 2, "e", { scope: C.SCOPE.out }), node("p", 3, "a"), node("s1", 4, "p"), node("b", 2, "e"), node("q", 3, "b"), node("r", 3, "b", { scope: C.SCOPE.unspecified }),
    node("n", 3, "b", { scope: C.SCOPE.na }), node("s2", 4, "n"), node("s3", 4, "r", { scope: C.SCOPE.unspecified }), node("c", 2, "e", { scope: C.SCOPE.unspecified }), node("t", 3, "c")];
  const by = id => items.find(x => x.id === id);
  assert.ok(R.inScope(items, by("e"))); assert.ok(R.inScope(items, by("q")));
  assert.ok(!R.inScope(items, by("a"))); assert.ok(!R.inScope(items, by("p"))); assert.ok(!R.inScope(items, by("s1"))); // under an area out of scope
  assert.ok(R.inScope(items, by("r"))); // decision 1: a business process takes no scope of its own, 10 - Unspecified runs
  assert.ok(!R.inScope(items, by("n")) && !R.inScope(items, by("s2"))); // 40 - Not applicable greys its scenarios
  assert.ok(!R.inScope(items, by("s3"))); // a scenario needs 20 - In scope (its software is chosen)
  assert.ok(!R.inScope(items, by("t"))); // an area not decided keeps its processes out, without greying them as off
  assert.equal(R.offAbove(items, by("s1")).id, "a"); assert.equal(R.offAbove(items, by("s2")).id, "n"); assert.equal(R.offAbove(items, by("t")), undefined);
  assert.deepEqual(R.ancestorsOf(items, by("s1")).map(x => x.id), ["p", "a", "e"]);
  assert.equal(R.levelUp(items, by("s1"), 2).id, "a");
  assert.deepEqual(R.descendantsOf(items, "a").map(x => x.id), ["p", "s1"]);
  assert.ok(!R.scopeDecided(C.SCOPE.unspecified)); assert.ok(R.scopeDecided(C.SCOPE.na)); assert.ok(!R.scopeDecided(null));
});

test("products are read up from the scenarios in scope", () => {
  const items = [node("e", 1, null), node("a", 2, "e"), node("p", 3, "a", { products: "Finance, Business Central" }),
    node("s1", 4, "p", { products: "Field Service" }), node("s2", 4, "p", { products: "Business Central", scope: C.SCOPE.out }), node("s3", 4, "p", { products: "Field Service, Finance" }),
    node("q", 3, "a", { products: "Sales; Finance" })]; // no scenarios: its own products
  const by = id => items.find(x => x.id === id);
  assert.deepEqual(R.productsOf(items, by("p")), ["Field Service", "Finance"]);
  assert.deepEqual(R.productsOf(items, by("q")), ["Finance", "Sales"]);
  assert.deepEqual(R.productsOf(items, by("e")), ["Field Service", "Finance"]); // from level 4 only, q's own products are not read up past it
  assert.deepEqual(R.productsOf(items, by("s2")), ["Business Central"]);
  const out = items.map(x => (x.id === "a" ? { ...x, scope: C.SCOPE.out } : x));
  assert.deepEqual(R.productsOf(out, out.find(x => x.id === "p")), []); // the area is out, so its scenarios are too
});

test("a Gap needs a gap solution approach", () => {
  assert.equal(R.fitGapProblem({ fitGap: C.FIT_GAP.gap, gapApproach: null }), "A gap needs a gap solution approach.");
  assert.equal(R.fitGapProblem({ fitGap: C.FIT_GAP.gap, gapApproach: C.GAP_UNSPECIFIED }), "A gap needs a gap solution approach.");
  assert.equal(R.fitGapProblem({ fitGap: C.FIT_GAP.gap, gapApproach: C.option("gapSolutionApproach", "30 - Power Platform") }), null);
  assert.equal(R.fitGapProblem({ fitGap: C.FIT_GAP.fit, gapApproach: null }), null);
  assert.equal(R.requirementProblem({ description: "Rent indexing", fitGap: C.FIT_GAP.gap, gapApproach: null }), "A gap needs a gap solution approach.");
});

test("an item's fit-gap from its requirements: any gap makes it a gap", () => {
  const r = R.itemFitGap([req({ fitGap: C.FIT_GAP.fit }), req({ fitGap: C.FIT_GAP.gap, gapApproach: 582100002 }), req(), req({ fitGap: C.FIT_GAP.gap, approval: C.APPROVAL.rejected }), req({ itemId: "p2", fitGap: C.FIT_GAP.gap })], "p1");
  assert.equal(r.fitGap, C.FIT_GAP.gap); assert.equal(r.gaps, 1); assert.equal(r.rated, 2); assert.equal(r.unrated, 1);
  assert.equal(R.itemFitGap([req({ fitGap: C.FIT_GAP.fit })], "p1").fitGap, C.FIT_GAP.fit);
  assert.equal(R.itemFitGap([req()], "p1").fitGap, null);
});

test("MoSCoW is shown, Microsoft's priority stored", () => {
  assert.equal(C.moscowOf(C.option("priority", "1")), "Must"); assert.equal(C.moscowOf(C.option("priority", "4")), "Won't");
  assert.equal(C.moscowOf(C.option("priority", "5")), "5"); assert.equal(C.moscowOf(null), "");
});

test("active excludes rejected and closed requirements", () => {
  assert.ok(R.isActive({ approval: C.APPROVAL.approved, closedReason: "" }));
  assert.ok(R.isActive({ approval: C.APPROVAL.new, closedReason: "" }));
  assert.ok(!R.isActive({ approval: C.APPROVAL.rejected, closedReason: "" }));
  for (const why of ["Deferred", "Duplicate"]) assert.ok(!R.isActive({ approval: C.APPROVAL.new, closedReason: why }));
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
  assert.ok(R.touchedByHand(req({ description: "x", fitGap: C.FIT_GAP.fit }), "x"));
  assert.ok(R.touchedByHand(req({ description: "x", approval: C.APPROVAL.inReview }), "x"));
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
  const lines = S.summaryLines([{ reqId: "RQ-1", description: "Permit check", owner: "", mapping: "Add a step", approvedBy: "Ann" }],
    [{ name: "Invoice", decisions: ["Fit", "Legacy ERP: Retire"], visited: true }, { name: "Other", decisions: ["Gap"], visited: false }],
    [{ text: "Send the form", owner: "Bo", due: "2026-11-20" }, { text: "Done", owner: "", due: "", done: true }]);
  assert.deepEqual(lines, ["Requirement: Permit check (RQ-1)", "Decision: Add a step, decided by Ann", "Decision: Invoice: Fit", "Decision: Invoice: Legacy ERP: Retire", "Open point: who owns RQ-1?", "Open point: Send the form, owner Bo, by 2026-11-20"]);
});

test("a broken session falls back to empty", () => {
  assert.deepEqual(S.readSession("{bad"), S.newSession());
  assert.deepEqual(S.readSession(JSON.stringify({ processIds: ["p"], current: "p" })).processIds, ["p"]);
});

test("sign-off tables use labels, not option values", () => {
  const items = [{ type: C.ITEM.requirement, key: "r", name: "R", description: "Need", snapshot: { reqId: "RQ-1", priority: C.BASE, fitGap: C.FIT_GAP.gap, gapApproach: C.option("gapSolutionApproach", "60 - ISV"), approval: C.APPROVAL.approved } },
    { type: C.ITEM.scope, key: "p", name: "Invoice", description: "", snapshot: { code: "X001", level: 3, parent: "A", scope: C.SCOPE.out, inScope: false } }];
  const [reqs, , , scope] = D.signOffTables(items);
  assert.deepEqual(reqs.rows[0].slice(0, 11), ["RQ-1", "Need", "", "", "", "Must", "1", "Gap", "60 - ISV", "", "Approved"]);
  assert.deepEqual(scope.rows[0], ["X001", "Invoice", "3", "A", "30 - Out of scope", "No"]);
});

test("the document escapes content, marks drafts and lists out-of-scope processes", () => {
  const items = [{ type: C.ITEM.requirement, key: "r", name: "R", description: "<b>x</b>", snapshot: {} }, { type: C.ITEM.scope, key: "p", name: "Out", description: "", snapshot: { inScope: false } }, { type: C.ITEM.scope, key: "q", name: "In", description: "", snapshot: { inScope: true } }];
  const html = D.signOffDocument("T", [["A", "B"]], items, false);
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;")); assert.ok(html.includes("DRAFT"));
  assert.ok(html.includes("1 of 2 process items in scope")); assert.ok(html.includes("<td>Out</td>")); assert.ok(!html.includes("<td>In</td>"));
  assert.ok(!D.signOffDocument("T", [], items, true).includes("DRAFT"));
});

test("the workbook is a zip with one part per table", () => {
  const z = D.workbook([{ title: "One", columns: ["a"], rows: [["1"]] }, { title: "Two", columns: ["b"], rows: [] }]);
  assert.equal(String.fromCharCode(z[0], z[1]), "PK");
  assert.ok(new TextDecoder().decode(z).includes("xl/worksheets/sheet2.xml"));
});

// ---------- meeting transcript (made-up content) ----------
const VTT = `WEBVTT

NOTE made-up test meeting

ab12cd34-0000-4000-8000-000000000001/12-0
00:00:01.000 --> 00:00:03.000
<v Ana Field>Usually the foreman approves</v>

ab12cd34-0000-4000-8000-000000000001/13-0
00:00:04.500 --> 00:00:06.000
<v Ana Field>the work order before we start.</v>

ab12cd34-0000-4000-8000-000000000001/14-0
00:00:07.000 --> 00:00:09.000
<v Ana Field>Sometimes the PM skips it.</v>

00:00:12.000 --> 00:00:15.000
<v Ben Office>We need read-only access for the office.</v>

00:00:16.000 --> 00:00:17.000
<v Ben Office>Ben Office stopped transcription</v>
`;

test("a WebVTT transcript joins a sentence across cues and skips headers, ids and notices", () => {
  const u = S.parseTranscript(VTT);
  assert.deepEqual(u.map(x => [x.at, x.speaker, x.text]), [
    [1, "Ana Field", "Usually the foreman approves the work order before we start."],
    [7, "Ana Field", "Sometimes the PM skips it."],
    [12, "Ben Office", "We need read-only access for the office."],
  ]);
});

test("a Teams copy reads header lines and drops a transcription notice standing alone", () => {
  const raw = "Ana Field   0:03\nWe always do the credit check.\nEvery time.\n\nBen Office   1:02:05\nOnly above ten thousand.\nBen Office started transcription\nCarl Site   1:03:00\nThirty technicians plus eight foremen.";
  assert.deepEqual(S.parseTranscript(raw).map(x => [x.at, x.speaker, x.text]), [
    [3, "Ana Field", "We always do the credit check. Every time."],
    [3725, "Ben Office", "Only above ten thousand."],
    [3780, "Carl Site", "Thirty technicians plus eight foremen."],
  ]);
});

test("plain lines with and without a time, and lines without a speaker", () => {
  const u = S.parseTranscript("[0:03] Ana Field: First point.\n0:10 Ben Office: Second point.\nCarl Site: No time here.\njust some words");
  assert.deepEqual(u.map(x => [x.at, x.speaker, x.text]), [[3, "Ana Field", "First point."], [10, "Ben Office", "Second point."], [null, "Carl Site", "No time here."], [null, "", "just some words"]]);
  const st = S.transcriptStats(u);
  assert.equal(st.lines, 4); assert.equal(st.noSpeaker, 1); assert.equal(st.minutes, 0);
  assert.deepEqual(st.speakers.map(x => [x.speaker, x.words]), [["Carl Site", 3], ["Ana Field", 2], ["Ben Office", 2]]);
  assert.equal(S.sourceLine(u[0]), "[0:03] Ana Field: First point.");
  assert.equal(S.sourceLine({ at: 3725, speaker: "Ben", text: "x" }), "[1:02:05] Ben: x");
  assert.equal(S.sourceLine(u[3]), "just some words");
});

test("lines go under the business process being discussed at that moment", () => {
  const visits = [{ key: "a", name: "A", at: "2026-11-08T10:00:00Z" }, { key: "b", name: "B", at: "2026-11-08T10:05:00Z" }, { key: "a", name: "A", at: "2026-11-08T10:20:00Z" }];
  const u = [{ at: 30, speaker: "X", text: "before" }, { at: 200, speaker: "X", text: "in a" }, { at: 600, speaker: "X", text: "in b" }, { at: 1500, speaker: "X", text: "back in a" }, { at: null, speaker: "X", text: "no time" }];
  const g = S.linesByVisit(u, visits, "2026-11-08T09:59:00Z");
  assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map(x => x.text)])), { "": ["before"], a: ["in a", "back in a"], b: ["in b"] });
  assert.equal(g.b[0].i, 2);
  assert.deepEqual(Object.keys(S.linesByVisit(u, visits, null)).sort(), ["a", "b"]); // starts with the first visit
  assert.deepEqual(S.linesByVisit(u, [], null), {});
});

test("line signals: hedges in English and German, a longer hedge counts once, must and licence flags", () => {
  const a = S.lineSignals("Usually we must check it, but it depends, not always.");
  assert.deepEqual(a.hedges, ["usually", "it depends", "not always"]); assert.equal(a.must, true); assert.equal(a.licence, false);
  assert.equal("Usually we must check it, but it depends, not always.".slice(a.spans[1].start, a.spans[1].end), "it depends");
  const b = S.lineSignals("Eigentlich machen wir das meistens so, vielleicht ungefähr zehn.");
  assert.deepEqual(b.hedges, ["eigentlich", "meistens", "vielleicht", "ungefähr"]);
  const c = S.lineSignals("Subcontractors shouldn't need a full licence; read-only for the office, I think.");
  assert.deepEqual(c.hedges, ["i think"]); assert.equal(c.licence, true);
  assert.deepEqual(S.lineSignals("Someone from management should look into that, or something.").hedges, ["someone", "or something"]);
  assert.deepEqual(S.lineSignals("Somewhere usuallyish").hedges, []); // whole words only
});

test("used lines: requirement number, open point, comment, then what the session recorded", () => {
  const u = [{ at: 1, speaker: "Ana", text: "One." }, { at: 2, speaker: "Ben", text: "Two." }, { at: 3, speaker: "Ana", text: "Three." }, { at: 4, speaker: "Ben", text: "Four." }, { at: 5, speaker: "Ana", text: "Five." }, { at: 6, speaker: "Ben", text: "Six." }];
  const m = S.usedLines(u, [{ reqId: "RQ-00003", sourceText: "[0:01] Ana: One." }], [{ text: "x", source: "[0:02] Ben: Two." }], { 3: "Flow change: Approve order", 4: "Licence: Technician, Team Members" }, [{ source: "[0:03] Ana: Three." }]);
  assert.deepEqual([...m], [[0, "RQ-00003"], [1, "Open point"], [2, "Comment"], [3, "Flow change: Approve order"], [4, "Licence: Technician, Team Members"]]);
  assert.equal(m.has(5), false);
});

test("visit keys: a process, or a process and one of its activities", () => {
  assert.equal(S.processKeyOf("abc#P300"), "abc"); assert.equal(S.processKeyOf("abc"), "abc"); assert.equal(S.processKeyOf(null), "");
  assert.equal(S.activityCodeOf("abc#P300"), "P300"); assert.equal(S.activityCodeOf("abc"), "");
});

test("the facilitator's agenda: prompts, minutes and a printable page", () => {
  const acts = [{ name: "Receive request", decision: false }, { name: "Approved?", decision: true }, { name: "Plan visit", decision: false }];
  const a = S.buildAgenda([
    { key: "p1", code: "95.25.100", name: "Receive service requests", notUsed: false, systemsToday: ["Spreadsheet (Retire)"], products: ["Field Service"], fitGap: "Fit", roles: ["Dispatcher"], scope: ["Emergency jobs <b>"], openQuestions: 2, activities: acts },
    { key: "p2", code: "95.25.950", name: "Schedule frontline workers", notUsed: false, systemsToday: [], products: [], fitGap: "", roles: [], scope: [], openQuestions: 0, activities: [] },
    { key: "p3", code: "95.35.100", name: "Old process", notUsed: true, systemsToday: ["X"], products: ["Y"], fitGap: "", roles: ["R"], scope: ["s"], openQuestions: 3, activities: acts },
  ]);
  const [x, y, z] = a.items;
  assert.equal(x.minutes, 5 + Math.ceil(3 * 1.5) + 2 + 2); assert.equal(x.from, 0); assert.equal(y.from, x.to); assert.equal(y.minutes, 5); assert.equal(z.minutes, 2); assert.equal(a.total, x.minutes + 5 + 2);
  assert.deepEqual(x.prompts, ["Do you do this? Who does it (Dispatcher)?", "Today in Spreadsheet (Retire): still right?", "After migration in Field Service: agreed?", "Fit-gap so far: Fit. Agreed?", "In scope: Emergency jobs <b>",
    "Decision \u201cApproved?\u201d: what happens on each outcome, and who decides?", "2 setup questions to answer", "What can't the standard do here, and why does it matter?"]);
  assert.deepEqual(y.prompts.slice(0, 3), ["Do you do this? Who does it?", "Which system or tool is used today?", "Which product runs it after migration?"]);
  assert.deepEqual(z.prompts, ["Marked not applicable: confirm nobody does this."]);
  assert.equal(x.chain, "Receive request \u2192 Approved? \u2192 Plan visit");
  const html = S.agendaHtml("Service workshop", "8 Nov 2026", a);
  assert.match(html, /^<!DOCTYPE html>/); assert.match(html, /1\. <span class="c">95\.25\.100<\/span> Receive service requests <span class="t">0\u201314 min<\/span>/);
  assert.match(html, /Emergency jobs &lt;b&gt;/); assert.match(html, /3 business processes, 21 min/);
});

test("a session keeps its transcript start and captured lines", () => {
  const s = S.readSession(JSON.stringify({ processIds: ["p"], transcriptStart: "2026-11-08T10:00:00Z", captured: { 3: "RQ-00001" } }));
  assert.equal(s.transcriptStart, "2026-11-08T10:00:00Z"); assert.equal(s.captured["3"], "RQ-00001");
  assert.deepEqual(S.readSession("{}").captured, {});
});

// ---------- flow editor: a step on a branch of a choice ----------
const st = (code, type, next, extra = {}) => ({ id: code, flowId: "f", code, name: code, type: C.SHAPE[type], func: "Lane", phase: "", next: next.map(([to, label = ""]) => ({ to, label })), description: "", change: C.DELTA.same, sort: 0, ...extra });
const loopFlow = () => [st("P100", "start", [["P200"]]), st("P200", "activity", [["P300"]]), st("P300", "decision", [["P400", "Yes"], ["P200", "No"]]), st("P400", "end", [])];

test("a step on the No branch takes the branch's place, even when the branch loops back", () => {
  const before = loopFlow(), copy = JSON.stringify(before);
  const out = P.addOnBranch(before, "P300", 1, st("P350", "activity", []));
  assert.equal(JSON.stringify(before), copy); // the input is left as it was
  const by = Object.fromEntries(out.map(x => [x.code, x]));
  assert.deepEqual(by.P300.next, [{ to: "P400", label: "Yes" }, { to: "P350", label: "No" }]);
  assert.deepEqual(by.P350.next, [{ to: "P200", label: "" }]);
  assert.equal(by.P350.change, C.DELTA.added); assert.equal(by.P300.change, C.DELTA.changed);
  assert.deepEqual(P.addOnBranch(before, "P300", 0, st("P350", "activity", [])).find(x => x.code === "P350").next, [{ to: "P400", label: "" }]);
});

test("a step on a branch refuses a missing branch or a code in use", () => {
  assert.equal(P.addOnBranch(loopFlow(), "P300", 2, st("P350", "activity", [])), null);
  assert.equal(P.addOnBranch(loopFlow(), "P300", -1, st("P350", "activity", [])), null);
  assert.equal(P.addOnBranch(loopFlow(), "P300", 0, st("P200", "activity", [])), null);
  assert.equal(P.addOnBranch(loopFlow(), "P999", 0, st("P350", "activity", [])), null);
});

test("a choice's loop back gets a stacked dot right of it; a plain step's loop back gets none", () => {
  const steps = loopFlow().map(x => (x.code === "P400" ? st("P400", "activity", [["P200"]]) : x));
  const pos = new Map([["P100", { x: 0, y: 0 }], ["P200", { x: 200, y: 0 }], ["P300", { x: 400, y: 0 }], ["P400", { x: 600, y: 0 }]]);
  const g = { pos, back: new Set(["P300>P200", "P400>P200"]), W: 100, H: 40, ROW: 80 };
  const list = P.slots(steps, g);
  const loop = list.find(x => x.from === "P300" && x.to === "P200");
  assert.ok(loop && loop.stacked); assert.equal(loop.x, 400 + 100 + 18); assert.equal(loop.y, 0 + 20 + 2 * 40); assert.equal(loop.label, "No");
  assert.ok(!list.some(x => x.from === "P400" && x.to === "P200"));
  assert.ok(list.some(x => x.from === "P300" && x.to === "P400" && !x.stacked));
});

test("scope per level: level 3 takes only 40 - Not applicable, fit-gap only levels 3 and 4", () => {
  assert.deepEqual(R.scopeChoices(3), [C.SCOPE.unspecified, C.SCOPE.na]);
  assert.deepEqual(R.scopeChoices(1), [C.SCOPE.unspecified, C.SCOPE.in, C.SCOPE.out, C.SCOPE.na]); assert.deepEqual(R.scopeChoices(4), R.scopeChoices(2));
  assert.match(R.scopeProblem(3, C.SCOPE.in), /level 3/); assert.match(R.scopeProblem(3, C.SCOPE.out), /Not applicable/);
  assert.equal(R.scopeProblem(3, C.SCOPE.na), null); assert.equal(R.scopeProblem(2, C.SCOPE.out), null); assert.equal(R.scopeProblem(4, 582100009), "Scope must be one of Microsoft's four values.");
  assert.ok(!R.fitGapLevel(1) && !R.fitGapLevel(2) && R.fitGapLevel(3) && R.fitGapLevel(4));
  assert.ok(R.isOff(C.SCOPE.out) && R.isOff(C.SCOPE.na) && !R.isOff(C.SCOPE.unspecified) && !R.isOff(null));
});

test("own scenarios on other software read their Software solutions up; a process's fit reads up from its scenarios", () => {
  const items = [node("e", 1, null), node("a", 2, "e"), node("p", 3, "a", { scope: C.SCOPE.unspecified }),
    node("s1", 4, "p", { products: "Finance", fitGap: C.FIT_GAP.fit }), node("s2", 4, "p", { products: "Other", softwareSolution: "SAP S/4HANA", fitGap: C.FIT_GAP.fit }),
    node("s3", 4, "p", { products: "Sales", scope: C.SCOPE.out, fitGap: C.FIT_GAP.gap })];
  const by = id => items.find(x => x.id === id);
  assert.deepEqual(R.softwareOf(by("s2")), ["SAP S/4HANA"]); assert.deepEqual(R.softwareOf({ products: "Finance, Other" }), ["Finance", "Other"]);
  assert.deepEqual(R.productsOf(items, by("a")), ["Finance", "SAP S/4HANA"]); assert.deepEqual(R.productsOf(items, by("e")), ["Finance", "SAP S/4HANA"]);
  assert.equal(R.fitFromScenarios(items, by("p")), C.FIT_GAP.fit); // the out-of-scope Gap doesn't count
  const gap = items.map(x => (x.id === "s1" ? { ...x, fitGap: C.FIT_GAP.gap } : x));
  assert.equal(R.fitFromScenarios(gap, gap.find(x => x.id === "p")), C.FIT_GAP.gap);
  const unrated = items.map(x => (x.id === "s1" ? { ...x, fitGap: null } : x));
  assert.equal(R.fitFromScenarios(unrated, unrated.find(x => x.id === "p")), null);
});

const raid = p => ({ id: "x" + ++n, name: "", type: C.RAID.risk, description: "d", itemId: null, workshopId: null, owner: "", priority: null, targetDate: null, status: C.RAID_STATUS.open, isQuestion: false,
  source: "", resolution: "", decisionMaker: "", createdOn: "2026-11-20T10:00:00Z", probability: null, ...p });
test("RAID: statuses per type, a decided decision needs its maker, each type its own fields", () => {
  assert.deepEqual(R.raidStatuses(C.RAID.decision), [C.RAID_STATUS.proposed, C.RAID_STATUS.decided, C.RAID_STATUS.withdrawn]);
  assert.deepEqual(R.raidStatuses(C.RAID.change), R.raidStatuses(C.RAID.decision));
  assert.deepEqual(R.raidStatuses(C.RAID.action), [C.RAID_STATUS.open, C.RAID_STATUS.progress, C.RAID_STATUS.closed]);
  assert.equal(R.raidStart(C.RAID.change), C.RAID_STATUS.proposed); assert.equal(R.raidStart(C.RAID.issue), C.RAID_STATUS.open);
  assert.ok(R.raidOpen(C.RAID_STATUS.proposed) && R.raidOpen(C.RAID_STATUS.progress) && !R.raidOpen(C.RAID_STATUS.decided) && !R.raidOpen(C.RAID_STATUS.closed));
  assert.equal(R.raidProblem(raid({ description: " " })), "A RAID item needs a description.");
  assert.match(R.raidProblem(raid({ type: C.RAID.decision, status: C.RAID_STATUS.open })), /not one of a Decision/);
  assert.match(R.raidProblem(raid({ type: C.RAID.decision, status: C.RAID_STATUS.decided })), /decision maker/);
  assert.equal(R.raidProblem(raid({ type: C.RAID.decision, status: C.RAID_STATUS.decided, decisionMaker: "Board" })), null);
  assert.match(R.raidProblem(raid({ probability: 140 })), /0 to 100/);
  const keys = t => R.RAID_FIELDS[t].map(f => f.key);
  assert.ok(keys(C.RAID.risk).includes("riskResponse") && keys(C.RAID.risk).includes("contingencyPlan"));
  assert.ok(keys(C.RAID.change).includes("changeRequestType") && keys(C.RAID.change).includes("justification"));
  assert.ok(keys(C.RAID.issue).includes("issueType") && keys(C.RAID.action).includes("responsibleParty"));
  for (const t of Object.values(C.RAID)) for (const f of R.RAID_FIELDS[t]) if (f.kind === "choice") assert.ok(C.listOf(f.list).length, f.key);
});
test("RAID filter: by type and status, open first, then by target date", () => {
  const list = [raid({ id: "a", status: C.RAID_STATUS.closed }), raid({ id: "b", targetDate: "2026-12-01" }), raid({ id: "c", targetDate: "2026-11-25" }),
    raid({ id: "d", type: C.RAID.decision, status: C.RAID_STATUS.proposed }), raid({ id: "e", type: C.RAID.decision, status: C.RAID_STATUS.decided })];
  assert.deepEqual(R.raidFilter(list, null, "all").map(x => x.id), ["c", "b", "d", "a", "e"]);
  assert.deepEqual(R.raidFilter(list, C.RAID.risk, "open").map(x => x.id), ["c", "b"]);
  assert.deepEqual(R.raidFilter(list, null, "closed").map(x => x.id), ["a", "e"]);
  assert.deepEqual(R.raidFilter(list, C.RAID.decision, C.RAID_STATUS.decided).map(x => x.id), ["e"]);
});
test("a change after an approved sign-off becomes a change request with old and new values", () => {
  const before = { type: C.ITEM.scope, key: "i1", name: "80.20.010 Invoice", description: "", snapshot: { scope: "x", fitGap: null } };
  const cr = R.changeRequestFor({ kind: "changed", item: { ...before, snapshot: { scope: C.SCOPE.na, fitGap: C.FIT_GAP.fit, inScope: false } }, fields: ["scope", "fitGap", "inScope"], before: { ...before, snapshot: { scope: C.SCOPE.unspecified, fitGap: null, inScope: true } } }, { version: 2 });
  assert.equal(cr.description, "Change after sign-off v2: Scope 80.20.010 Invoice");
  assert.equal(cr.justification, "scope: 10 - Unspecified → 40 - Not applicable\nfitGap: empty → Fit\ninScope: yes → no");
  assert.equal(cr.frozenKey, C.ITEM.scope + ":i1"); assert.equal(cr.changeRequestType, "Scope Change");
  assert.ok(C.option("changeRequestType", cr.changeRequestType) != null);
  const added = R.changeRequestFor({ kind: "added", item: { type: C.ITEM.requirement, key: "r9", name: "RQ-9", description: "", snapshot: {} } }, { version: 1 });
  assert.equal(added.justification, "Added since the sign-off."); assert.equal(added.changeRequestType, "Design Change");
});

const hist = p => ({ id: "h" + ++n, table: "emph_processitem", rowId: "i1", field: "emph_scope", oldValue: "", newValue: "", how: C.HOW.direct, by: "", workshopName: "", createdOn: "2026-11-20T10:00:00.000Z", ...p });
test("restore: a choice by its label, text as it was, a Gap with the approach changed with it", () => {
  assert.deepEqual(R.restorePatch(hist({ oldValue: "30 - Out of scope", newValue: "20 - In scope" }), []), { patch: { scope: C.SCOPE.out } });
  assert.deepEqual(R.restorePatch(hist({ field: "emph_scope", oldValue: "" }), []), { patch: { scope: null } });
  assert.deepEqual(R.restorePatch(hist({ field: "emph_businessprocessowner", oldValue: "Ana" }), []), { patch: { owner: "Ana" } });
  assert.deepEqual(R.restorePatch(hist({ table: "emph_requirement", field: "_emph_item_value", oldValue: "i7" }), []), { patch: { itemId: "i7" } });
  assert.match(R.restorePatch(hist({ oldValue: "25 - Maybe" }), []).problem, /not one of the choices/);
  assert.match(R.restorePatch(hist({ field: "emph_rank" }), []).problem, /can't be restored/);
  const g = hist({ field: "emph_fitgapstatus", oldValue: "Gap", newValue: "Fit", createdOn: "2026-11-20T10:00:00.400Z" });
  const twin = hist({ field: "emph_gapsolutionapproach", oldValue: "30 - Power Platform", newValue: "", createdOn: "2026-11-20T10:00:00.900Z" });
  assert.deepEqual(R.restorePatch(g, [g, twin]), { patch: { fitGap: C.FIT_GAP.gap, gapApproach: C.option("gapSolutionApproach", "30 - Power Platform") } });
  assert.deepEqual(R.historyOf([hist({ id: "1" }), hist({ id: "2", createdOn: "2026-11-21" }), hist({ id: "3", rowId: "i2" })], "emph_processitem", "i1").map(x => x.id), ["2", "1"]);
  assert.equal(R.historyText(C.SCOPE.na, "scope"), "40 - Not applicable"); assert.equal(R.historyText(null, null), "");
  for (const fs of Object.values(R.HISTORY_FIELDS)) for (const f of fs) if (f.list) assert.ok(C.listOf(f.list).length, f.column);
});

// made-up prices for the tests only
const price = (product, kind, value, validFrom = "2026-01-01") => ({ product, kind, price: value, currency: "EUR", validFrom, source: "test" });
test("licence suggestion: Full with the highest priced base, Team Members for reading, None outside Dynamics 365", () => {
  const prices = [price("Field Service", "Base", 50), price("Finance", "Base", 90), price("Finance", "Base", 120, "2027-01-01"), price("Field Service", "Attach", 20)];
  const s = R.suggestLicence(["Field Service", "Finance", "Teams"], [], prices);
  assert.equal(s.type, "Full"); assert.equal(s.base, "Finance"); assert.deepEqual(s.attach, ["Field Service"]); assert.match(s.why, /base Finance \(120 EUR/);
  assert.equal(R.suggestLicence(["Sales", "Finance"], [], []).base, "Finance"); // no prices: by name
  assert.equal(R.suggestLicence([], ["Sales"], []).type, "Team Members");
  assert.equal(R.suggestLicence(["Teams", "Power BI"], [], []).type, "None");
  assert.equal(R.suggestLicence(["Sales"], [], [], true).type, "Device");
  assert.equal(R.priceOf(prices, "Finance", "Base", "2026-06-30").price, 90); assert.equal(R.priceOf(prices, "Finance", "Base").price, 120);
  assert.equal(R.priceOf([price("", "Team Members", 8)], "", "Team Members").price, 8); assert.equal(R.priceOf([price("", "Base", 8)], "Sales", "Base"), null);
  assert.deepEqual(R.licenceProblems({ type: "Full", base: null, attach: "" }), ["A full user needs a base product (the highest priced app)."]);
  assert.deepEqual(R.licenceProblems({ type: "Team Members", base: null, attach: "Sales" }), ["Attach products need a full user with a base licence."]);
  assert.deepEqual(R.licenceProblems({ type: "Full", base: "Sales", attach: "Sales; Field Service" }), ["The base product is not attached again."]);
});
test("licence per role from its scenarios, and the summary per licence type with a monthly estimate", () => {
  const items = [node("e", 1, null), node("a", 2, "e"), node("p", 3, "a", { scope: C.SCOPE.unspecified }), node("s1", 4, "p", { products: "Field Service" }), node("s2", 4, "p", { products: "Sales", scope: C.SCOPE.out }),
    node("q", 3, "a", { scope: C.SCOPE.na }), node("s3", 4, "q", { products: "Finance" })];
  const links = [{ itemId: "p", roleId: "r1" }, { itemId: "q", roleId: "r1" }, { itemId: "s3", roleId: "r2" }];
  assert.deepEqual(R.roleProducts(items, links, "r1"), ["Field Service"]); assert.deepEqual(R.roleProducts(items, links, "r2"), []);
  const prices = [price("Field Service", "Base", 50), price("Finance", "Attach", 30), price("", "Team Members", 8)];
  const sum = R.licenceSummary([{ headcount: 10, type: "Full", base: "Field Service", attach: "Finance" }, { headcount: 5, type: "Team Members", base: null, attach: "" },
    { headcount: 2, type: "None", base: null, attach: "" }, { headcount: 3, type: null, base: null, attach: "" }], prices);
  assert.deepEqual(sum.products, { "Field Service": { base: 10, attach: 0 }, Finance: { base: 0, attach: 10 } });
  assert.deepEqual(sum.totals, { Full: 10, "Team Members": 5, "Operations - Activity": 0, Device: 0, None: 2, open: 3 });
  assert.equal(sum.monthly, 10 * 50 + 10 * 30 + 5 * 8); assert.equal(sum.currency, "EUR"); assert.equal(sum.complete, false); // 3 people not decided
  assert.equal(R.licenceSummary([{ headcount: 1, type: "Device", base: null, attach: "" }]).monthly, null);
});

test("Azure Boards import file: the tree through Title columns, Microsoft's fields, requirements and RAID under their item", () => {
  const it = (id, level, parentId, p = {}) => ({ id, level, parentId, code: id, name: "Item " + id, catalogName: "Item " + id, summary: "", rank: 0, scope: C.SCOPE.in, scopeReason: "", scopeApproach: "",
    fitGap: null, gapApproach: null, fitGapReason: "", owner: "", workstreamLead: "", sme: "", complexity: null, priority: null, processType: null, isOwn: false, author: C.AUTHOR.microsoft, catalogStatus: null,
    products: "", softwareSolution: "", setHow: null, setBy: "", setOn: null, present: "", workshopName: "", accent: "", comments: "", ...p });
  const items = [it("80", 1, null), it("80.20", 2, "80"), it("80.20.010", 3, "80.20", { scope: C.SCOPE.unspecified, fitGap: C.FIT_GAP.gap, gapApproach: C.option("gapSolutionApproach", "30 - Power Platform"), owner: "Ana" }),
    it("80.20.010.100", 4, "80.20.010", { products: "Project Operations" }), it("80.20.010.200", 4, "80.20.010", { scope: C.SCOPE.out, products: "Sales" }),
    it("80.20.020", 3, "80.20", { scope: C.SCOPE.na, scopeReason: "We don't do it" }), it("80.20.020.100", 4, "80.20.020"), it("90", 1, null, { scope: C.SCOPE.unspecified }), it("90.10", 2, "90")];
  const m = { workspace: { id: null, organisation: "Harbourview; Test", settings: { prices: [] } }, items, requirements: [req({ id: "r1", reqId: "RQ-00001", name: "Approve \"big\" orders", description: "Approve <big> orders", itemId: "80.20.010.100", fitGap: C.FIT_GAP.fit }),
    req({ id: "r2", reqId: "RQ-00002", itemId: null, closedReason: "Duplicate" }), req({ id: "r3", reqId: "RQ-00003", name: "Loose", itemId: null })],
    raids: [raid({ id: "k1", name: "Data late", itemId: "80.20", riskResponse: C.option("riskResponse", "Mitigate") }), raid({ id: "k2", name: "Who signs?", type: C.RAID.action, isQuestion: true })] };
  const rows = D.boardsRows(m);
  const col = h => D.BOARDS_HEAD.indexOf(h);
  const titleAt = r => [1, 2, 3, 4, 5].findIndex(k => r[col("Title " + k)]) + 1;
  assert.deepEqual(rows.map(r => r[col("Work Item Type")] + "@" + titleAt(r)), ["End to end@1", "Process area@2", "Risk@3", "Process@3", "Scenario@4", "Requirement@5", "Scenario@4", "Process@3", "Requirement@1", "Action item@1"]);
  const p = rows[3];
  assert.equal(p[col("Process sequence ID MS BPC")], "80.20.010"); assert.equal(p[col("Fit gap status MS BPC")], "Gap"); assert.equal(p[col("Gap solution approach MS BPC")], "30 - Power Platform");
  assert.equal(p[col("Business process owner MS BPC")], "Ana"); assert.equal(p[col("Author MS BPC")], "Microsoft"); assert.equal(p[col("Scope MS BPC")], "10 - Unspecified");
  assert.equal(rows[7][col("Scope MS BPC")], "40 - Not applicable"); assert.match(rows[7][col("Description")], /Scope reason:<\/strong> We don&#39;t do it|Scope reason:<\/strong> We don't do it/);
  assert.equal(rows[0][col("Fit gap status MS BPC")], ""); // no fit-gap on an end-to-end process
  assert.equal(rows[5][col("Title 5")], "RQ-00001 Approve \"big\" orders"); assert.match(rows[5][col("Description")], /Approve &lt;big&gt; orders/);
  assert.match(rows[2][col("Description")], /Risk response:<\/strong> Mitigate/);
  assert.equal(rows[0][col("Tags")], "EMPH; Harbourview, Test; End-to-end process"); assert.match(rows[9][col("Tags")], /Open question$/);
  assert.ok(!rows.some(r => r.join("|").includes("RQ-00002"))); // closed requirements stay out
  const files = D.boardsFiles(rows);
  assert.equal(files.length, 1); assert.ok(files[0].startsWith("﻿\"ID\",\"Work Item Type\",\"Title 1\"")); assert.ok(files[0].endsWith("\r\n"));
  assert.ok(files[0].includes('"RQ-00001 Approve ""big"" orders"'));
  const split = D.boardsFiles(rows, 8); // the first end-to-end tree has 8 rows: the rest starts a new file
  assert.equal(split.length, 2); assert.equal(split[0].split("\r\n").length - 2, 8); assert.match(split[1].split("\r\n")[1], /"Requirement","RQ-00003 Loose"/);
});

// ---------- slice 3: workshops like Microsoft ----------
const GUIDE = JSON.parse(readFileSync(join(root, "schema/workshops.json"), "utf8"));
test("Microsoft's workshop templates: 128 of three kinds, every question with its source, under CC BY-SA 4.0", () => {
  assert.equal(GUIDE.templates.length, 128);
  const kinds = k => GUIDE.templates.filter(t => t.kind === k).length;
  assert.deepEqual([kinds("board"), kinds("storyline"), kinds("deepdive")], [14, 14, 100]);
  assert.ok(W.questionCount(GUIDE) > 1800);
  for (const t of GUIDE.templates) for (const q of t.questions) assert.ok(q.source.startsWith(t.source), t.id + " " + q.text);
  assert.match(GUIDE.source.licence, /CC BY-SA 4\.0/);
  const board = W.templatesFor(GUIDE, "board", "90")[0];
  assert.ok(board.areas.length && board.cards.length && board.agenda.length);
  assert.equal(W.templatesFor(GUIDE, "deepdive", "90")[0].kind, "deepdive");
});

test("workshop kinds: Microsoft's type, Success by Design phase and child tasks named after the end-to-end process", () => {
  assert.equal(W.WORKSHOP_TYPE_OF_KIND.board, "Storyboard"); assert.equal(W.WORKSHOP_TYPE_OF_KIND.deepdive, "Detailed design");
  for (const v of Object.values(W.WORKSHOP_TYPE_OF_KIND)) assert.ok(C.option("microsoftWorkshopType", v) != null);
  for (const v of Object.values(W.SBD_PHASE_OF_KIND)) assert.ok(C.option("sbdPhase", v) != null);
  assert.equal(W.kindOfValue(W.kindValue("storyline")), "storyline"); assert.equal(W.kindOfValue(null), "discovery");
  const tasks = W.childTasksOf("board", "90.01", "Order to cash");
  assert.deepEqual(tasks.map(t => t.id + " " + t.title), ["90.01.001 Create order to cash user stories", "90.01.002 Configure order to cash solution", "90.01.003 Design high-level solution architecture"]);
  assert.equal(W.childTasksOf("storyline", "90.02", "Order to cash")[3].title, "Order to cash design document");
  assert.deepEqual(W.childTasksOf("discovery", "", "x"), []);
  assert.equal(W.readTasks(JSON.stringify(tasks)).length, 3); assert.deepEqual(W.readTasks("nonsense"), []);
});

test("one session order: five steps, the old phases as steps and tabs, agenda Previous and Next", () => {
  assert.deepEqual(W.STEPS.map(s => s.name), ["Prepare", "Run the agenda", "Analyse", "Conclusion", "Close"]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(W.stepOfPhase), [0, 1, 1, 1, 1, 1, 3]);
  assert.deepEqual([1, 2, 3, 4, 5].map(W.tabOfPhase), ["scope", "walk", "flow", "config", "fitgap"]);
  assert.equal(W.defaultTool("Overview of order to cash process (20 minutes)", "board"), "board");
  assert.equal(W.defaultTool("Demonstration of the storyline in Dynamics 365", "storyline"), "story");
  assert.equal(W.defaultTool("Wrap-Up and next steps", "board"), "notes");
  assert.equal(W.defaultTool("Data migration", "deepdive"), "questions");
  const t = W.templatesFor(GUIDE, "board", "90")[0];
  const run = { ...W.emptyRun("board", t.id, "90"), agenda: W.newAgenda("board", t, []) };
  assert.equal(run.agenda.length, t.agenda.length);
  assert.equal(W.moveAgenda(run, -1).end, false);
  let r = W.moveAgenda(run, 1);
  assert.equal(r.run.agendaKey, run.agenda[1].key); assert.deepEqual(r.run.done, [run.agenda[0].key]);
  for (let i = 0; i < 10 && !r.end; i++) r = W.moveAgenda(r.run, 1);
  assert.equal(r.end, true); assert.equal(r.run.done.length, run.agenda.length);
  const d = W.newAgenda("discovery", null, [{ id: "p1", code: "90.10.010", name: "Take orders" }]);
  assert.deepEqual(d, [{ key: "p:p1", text: "90.10.010 Take orders", tool: "process", itemId: "p1" }]);
  const synced = W.syncProcessLines(W.addLine({ ...W.emptyRun(), agenda: d }, "Own line"), [{ id: "p2", code: "", name: "Bill" }]);
  assert.deepEqual(synced.agenda.map(a => a.text), ["Bill", "Own line"]);
  // the run survives the session JSON
  const back = W.readRun(JSON.parse(JSON.stringify(W.setMark(r.run, "c1", { state: "strike", links: ["p1"] }))));
  assert.deepEqual(back.marks.c1, { state: "strike", links: ["p1"] }); assert.equal(W.readRun(null), undefined);
  assert.deepEqual(S.readSession(JSON.stringify({ processIds: [], run: back })).run.marks.c1.links, ["p1"]);
});

// a small catalog for the board: e (L1) > a1, a2 (L2) > p11, p12 / p21 (L3) > s111 (L4)
const ref = (id, level, parentId, code, name, scope = C.SCOPE.unspecified) => ({ id, level, parentId, code, name, catalogName: name, scope, scopeReason: "", fitGap: null, gapApproach: null, fitGapReason: "" });
const CAT = [ref("e", 1, null, "90", "Order to cash", C.SCOPE.in), ref("a1", 2, "e", "90.20", "Manage sales orders", C.SCOPE.in), ref("a2", 2, "e", "90.30", "Invoice customers", C.SCOPE.out),
  ref("p11", 3, "a1", "90.20.010", "Enter sales orders"), ref("p12", 3, "a1", "90.20.020", "Price sales orders"), ref("p21", 3, "a2", "90.30.010", "Create invoices"),
  ref("s111", 4, "p11", "90.20.010.100", "Enter a sales order manually")];
const AREAS = CAT.filter(x => x.level === 2);

test("scenario board: areas matched to the catalog by name (the guide's codes differ), cards guess their process, catalog fallback", () => {
  assert.equal(W.matchArea("90.55", "Invoice customers", AREAS).id, "a2"); // name wins over a different code
  assert.equal(W.matchArea("90.20", "Something else entirely", AREAS).id, "a1"); // then the code
  assert.equal(W.matchArea("99.99", "Nothing", AREAS), null);
  const t = { id: "90.01", kind: "board", unit: "90", title: "Board", areas: [{ code: "90.10", name: "Manage sales orders" }, { code: "90.15", name: "Invoice customers" }],
    cards: [{ area: "90.10", group: "Scenarios", text: "Price orders with discounts" }, { area: "90.15", group: "Compliance", text: "Credit holds" }], agenda: [], questions: [] };
  const cols = W.boardColumns(t, AREAS, CAT);
  assert.deepEqual(cols.map(c => c.code + ">" + (c.area && c.area.id)), ["90.10>a1", "90.15>a2"]);
  assert.deepEqual(cols[0].groups[0].cards[0].links, ["p12"]); // "price"
  assert.deepEqual(cols[1].groups[0].cards[0].links, []); // no word shared with Create invoices
  const cat = W.boardColumns(null, AREAS, CAT);
  assert.equal(cat[0].groups[0].group, "90.20.010 Enter sales orders"); assert.deepEqual(cat[0].groups[0].cards[0].links, ["s111"]);
  assert.deepEqual(W.boardViewOf("Overview of order to cash process"), { view: "overview" });
  assert.deepEqual(W.boardViewOf("Detailed discussion on key scenarios"), { view: "full" }); // the board stays together
  assert.deepEqual(W.boardViewOf("20.10 Establish a knowledge base"), { view: "full", area: "20.10" });
  // scope proposals: shown over today's, greyed when out or not applicable, a change drops the verdict
  let run = W.setScopeMark(W.emptyRun("board"), "a1", { scope: C.SCOPE.na, reason: "We don't sell" });
  assert.equal(W.scopeShown(run, AREAS[0]), C.SCOPE.na); assert.ok(W.scopeOff(W.scopeShown(run, AREAS[0]))); assert.ok(!W.scopeOff(C.SCOPE.in));
  run = { ...run, verdicts: { "scope:a1": "agreed" } };
  assert.equal(W.setScopeMark(run, "a1", { scope: C.SCOPE.out, reason: "We don't sell" }).verdicts["scope:a1"], undefined);
  assert.equal(W.setScopeMark(run, "a1", { scope: C.SCOPE.na, reason: "We don't sell" }).verdicts["scope:a1"], "agreed");
  run = W.setMark(run, cols[0].groups[0].cards[0].key, { state: "strike" });
  assert.deepEqual(W.boardCounts(cols, run), { cards: 2, kept: 0, struck: 1, main: 0 });
});

test("Close writes only what was agreed: scope, a struck card's processes out, fit-gap; nothing twice; a gap needs its approach", () => {
  const t = { id: "90.01", kind: "board", unit: "90", areas: [{ code: "90.10", name: "Manage sales orders" }], cards: [{ area: "90.10", group: "Scenarios", text: "Price orders" }], agenda: [], questions: [] };
  const cards = W.boardColumns(t, AREAS, CAT).flatMap(c => c.groups.flatMap(g => g.cards));
  let run = W.emptyRun("board", "90.01", "90");
  run = W.setScopeMark(run, "a2", { scope: C.SCOPE.in, reason: "We invoice" });
  run = W.setScopeMark(run, "e", { scope: C.SCOPE.in }); // already so: nothing to write
  run = W.setMark(run, cards[0].key, { state: "strike" });
  run = W.setProcessFit(run, "p11", { fitGap: C.FIT_GAP.gap, reason: "Approval step" });
  const names = { name: id => CAT.find(x => x.id === id).name, scopeLabel: v => C.labelOf("scope", v), fitLabel: f => C.labelOf("fitGapStatus", f.fitGap) };
  const items = W.conclusionItems(run, cards, names);
  assert.deepEqual(items.map(i => i.key), ["scope:a2", "scope:e", "card:" + cards[0].key, "pfit:p11"]);
  assert.match(items[2].text, /→ out: Price sales orders/);
  assert.equal(W.closeChanges(run, cards, CAT, "W1").length, 0); // no verdicts yet
  const all = W.agreeRest({ ...run, verdicts: { "scope:a2": "not_agreed" } }, items);
  assert.equal(all.verdicts["scope:a2"], "not_agreed"); assert.deepEqual(W.conclusionCounts(items, all), { agreed: 3, notAgreed: 1, parked: 0, open: 0 });
  let ch = W.closeChanges(all, cards, CAT, "W1");
  assert.deepEqual(ch.map(c => c.itemId), ["p12", "p11"]);
  assert.deepEqual(ch[0].patch, { scope: C.SCOPE.na, scopeReason: "Struck on the scenario board in W1: Price orders" });
  assert.equal(ch[1].patch.gapApproach, C.GAP_UNSPECIFIED);
  assert.equal(W.closeProblems(ch).length, 1); // a gap without its approach
  const fixed = { ...W.setProcessFit(all, "p11", { fitGap: C.FIT_GAP.gap, approach: C.option("gapSolutionApproach", "30 - Power Platform") }), verdicts: { ...all.verdicts } };
  ch = W.closeChanges(fixed, cards, CAT, "W1");
  assert.equal(W.closeProblems(ch).length, 0); assert.match(ch[1].label, /30 - Power Platform/);
  // a struck scenario card takes the scenario out of scope (30); a business process only goes Not applicable (40)
  const cat = W.boardColumns(null, AREAS, CAT).flatMap(c => c.groups.flatMap(g => g.cards));
  const r2 = { ...W.setMark(W.emptyRun("board"), cat[0].key, { state: "strike" }), verdicts: { ["card:" + cat[0].key]: "agreed" } };
  assert.deepEqual(W.closeChanges(r2, cat, CAT, "W2").map(c => c.itemId + "=" + c.patch.scope), ["s111=" + C.SCOPE.out]);
  // a card the facilitator linked to nothing changes nothing
  const r3 = { ...W.setMark(W.emptyRun("board"), cards[0].key, { state: "strike", links: [] }), verdicts: { ["card:" + cards[0].key]: "agreed" } };
  assert.equal(W.closeChanges(r3, cards, CAT, "W3").length, 0);
  assert.deepEqual(W.beforeOf(CAT[3]), { scope: C.SCOPE.unspecified, scopeReason: "", fitGap: null, gapApproach: null, fitGapReason: "" });
  assert.ok(W.closeWarnings(items, W.emptyRun(), [{ id: "1", title: "x", done: false }]).some(w => /child tasks/.test(w)));
});

test("storyline review: in-scope areas only, main path first, fit per step makes the process fit", () => {
  let run = W.emptyRun("storyline", "90.02", "90");
  assert.deepEqual(W.storyProcesses(run, CAT, "e").map(p => p.id), ["p11", "p12"]); // 90.30 is out of scope
  run = W.toggleMainPath(run, "p12");
  assert.deepEqual(W.storyProcesses(run, CAT, "e").map(p => p.id), ["p12", "p11"]);
  assert.deepEqual(W.storyProcesses(W.setScopeMark(run, "a2", { scope: C.SCOPE.in }), CAT, "e").map(p => p.id), ["p12", "p11", "p21"]);
  run = W.setStepFit(run, W.stepKey("p11", "A1"), { fit: "fits", name: "Enter" });
  assert.equal(W.fitFromSteps(run, "p11", ["A1", "A2"]), null);
  run = W.setStepFit(run, W.stepKey("p11", "A2"), { fit: "not_needed", name: "Check" });
  assert.equal(W.fitFromSteps(run, "p11", ["A1", "A2"]), C.FIT_GAP.fit);
  run = W.setStepFit(run, W.stepKey("p11", "A2"), { fit: "differs", name: "Check", reason: "Two approvals" });
  assert.equal(W.fitFromSteps(run, "p11", ["A1", "A2"]), C.FIT_GAP.gap);
  assert.deepEqual(W.gapAreas(run, CAT), ["a1"]);
  const links = [{ code: "90.20.010", url: "https://demo.example/so" }, { code: "90.20.010", step: "A2", url: "https://demo.example/approve" }];
  assert.equal(W.demoLinkOf(links, "90.20.010", "A2").url, "https://demo.example/approve");
  assert.equal(W.demoLinkOf(links, "90.20.010", "A1").url, "https://demo.example/so");
  assert.equal(W.demoLinkOf(links, "90.20.020"), null);
});

test("quick track: Microsoft's lines put aside and back, scope proposed from today, not checked is not 'no gap'", () => {
  const t = W.templatesFor(GUIDE, "board", "90")[0];
  const run = { ...W.emptyRun("board", t.id, "90"), agenda: W.newAgenda("board", t, []) };
  const q = W.toQuickTrack(run);
  assert.equal(q.track, "quick"); assert.deepEqual(q.agenda.map(a => a.tool), ["notes", "board", "board", "story", "notes"]);
  assert.equal(W.toQuickTrack({ ...run, kind: "storyline" }).track, undefined);
  const back = W.fromQuickTrack({ ...q, done: ["qt-1"] });
  assert.deepEqual(back.agenda, run.agenda); assert.equal(back.track, undefined); assert.deepEqual(back.done, []);
  const p = W.proposeScope(q, AREAS.concat(ref("x", 2, "e", "90.40", "X", C.SCOPE.unspecified)));
  assert.equal(p.proposed, 2); assert.equal(p.run.scope.a2.scope, C.SCOPE.out);
  assert.equal(W.proposeScope(p.run, AREAS).proposed, 0);
  assert.equal(W.fitChecked(q), false);
  assert.ok(W.closeWarnings([], { ...q, present: ["Ana"] }, []).some(w => /fit-checked nothing/.test(w)));
});

test("next workshop in Microsoft's order: board, storyline, deep-dives of areas in scope; quick track: only gap areas", () => {
  const board = W.templatesFor(GUIDE, "board", "90")[0], story = W.templatesFor(GUIDE, "storyline", "90")[0], deeps = W.templatesFor(GUIDE, "deepdive", "90");
  const area = deeps[0].unit, other = deeps.find(d => d.unit !== area).unit;
  const areas = { "90": [{ code: area, name: "first" }, { code: other, name: "second" }] };
  const held = p => ({ kind: "board", template: board.id, unit: "90", closed: true, ...p });
  assert.equal(W.nextTemplate(GUIDE, { kind: "discovery", template: "", unit: "90", closed: false }, [], ["90"], areas).template.id, board.id);
  assert.equal(W.nextTemplate(GUIDE, held(), [], ["90"], areas).template.id, story.id);
  assert.equal(W.nextTemplate(GUIDE, { kind: "storyline", template: story.id, unit: "90", closed: false }, [held()], ["90"], areas).template.unit, area);
  // a quick track that found a gap only in the second area: its deep-dive next, no storyline review
  const n = W.nextTemplate(GUIDE, held({ quick: true, checked: true, gapAreas: [{ code: other, name: "second" }] }), [], ["90"], areas);
  assert.equal(n.template.unit, other); assert.match(n.why, /Quick track/);
  // a quick track that checked nothing: the storyline review still follows
  assert.equal(W.nextTemplate(GUIDE, held({ quick: true, checked: false }), [], ["90"], areas).template.id, story.id);
  // all of 90 held: the next end-to-end process in scope
  const done = [held(), { kind: "storyline", template: story.id, unit: "90", closed: true }].concat(deeps.map(d => ({ kind: "deepdive", template: d.id, unit: d.unit, closed: true })));
  const x = W.nextTemplate(GUIDE, done[done.length - 1], done, ["90", "10"], { "90": areas["90"] });
  assert.equal(x.template.id, W.templatesFor(GUIDE, "board", "10")[0].id); assert.match(x.why, /Next end-to-end process in scope: 10/);
});

// ---------- slice 4: capture upgrades (Business Map U1, U2, U3, N5, N7, N1, F4, D1; made-up content) ----------
const rows4 = u => u.map(x => [x.at, x.speaker, x.text]);

test("transcript shape a: name and time on one line, then the words", () => {
  const u = S.parseTranscript("Anna Berg   0:03\nWe need the site on every invoice.\nAnd the cost centre.\n\nBen Koch   0:12\nWho signs the order?");
  assert.deepEqual(rows4(u), [[3, "Anna Berg", "We need the site on every invoice. And the cost centre."], [12, "Ben Koch", "Who signs the order?"]]);
});

test("transcript shape b: WebVTT with voice tags and cue numbers", () => {
  const u = S.parseTranscript("WEBVTT\n\n1\n00:00:03.000 --> 00:00:07.000\n<v Anna Berg>We need the site.</v>\n\n2\n00:00:09.500 --> 00:00:12.000\n<v Ben Koch>Who signs?</v>");
  assert.deepEqual(rows4(u), [[3, "Anna Berg", "We need the site."], [9.5, "Ben Koch", "Who signs?"]]);
});

test("transcript shape c: the name on its own line, the time on the next, then the words", () => {
  const u = S.parseTranscript("Anna Berg\n0:03\nWe need the site on every invoice.\nAnd the cost centre.\n\nBen Koch\n0:41\nWho signs the order?\n\nAnna Berg\n1:15\nThe project manager.");
  assert.deepEqual(rows4(u), [[3, "Anna Berg", "We need the site on every invoice. And the cost centre."], [41, "Ben Koch", "Who signs the order?"], [75, "Anna Berg", "The project manager."]]);
});

test("transcript shape d: the Teams .docx download, a time range then the name on its own line", () => {
  const u = S.parseTranscript("Transcript\n\n0:0:0.0 --> 0:0:5.120\nAnna Berg\nWe need the site on every invoice.\n\n0:0:6.300 --> 0:0:9.0\nBen Koch\nWho signs the order?");
  assert.deepEqual(rows4(u), [[0, "Anna Berg", "We need the site on every invoice."], [6.3, "Ben Koch", "Who signs the order?"]]);
});

test("transcript shape e: a date and clock time after the name count from the first line", () => {
  const de = S.parseTranscript("Anna Berg   11.11.2026 09:03\nWe need the site.\n\nBen Koch   11.11.2026 09:05\nWho signs?");
  assert.deepEqual(rows4(de), [[0, "Anna Berg", "We need the site."], [120, "Ben Koch", "Who signs?"]]);
  const us = S.parseTranscript("Anna Berg 11/11/2026 9:03 AM\nWe need the site.\n\nBen Koch 11/11/2026 1:10 PM\nWho signs?");
  assert.deepEqual(rows4(us), [[0, "Anna Berg", "We need the site."], [4 * 3600 + 7 * 60, "Ben Koch", "Who signs?"]]);
});

test("transcript shape f: times over an hour, colons in speech, and Note: on a line of its own stays in the turn", () => {
  const u = S.parseTranscript("Anna Berg   1:02:03\nWe have three types: partial, final and credit.\n\nNote: retention is five percent.\n\nBen Koch   1:03:00\nOkay.");
  assert.deepEqual(rows4(u), [[3723, "Anna Berg", "We have three types: partial, final and credit. Note: retention is five percent."], [3780, "Ben Koch", "Okay."]]);
  assert.ok(!u.some(x => x.speaker === "Note"));
  // a clock time said inside a turn is speech, not a new speaker
  assert.deepEqual(rows4(S.parseTranscript("Anna Berg   0:03\nWe start at\nthe office at 9:30 AM\n\nBen Koch   0:09\nFine.")), [[3, "Anna Berg", "We start at the office at 9:30 AM"], [9, "Ben Koch", "Fine."]]);
});

test("long turns are cut into sentences that keep the time and speaker, and the whole turn", () => {
  assert.deepEqual(S.splitSentences("We use z.B. two sites. The rate is 5.5 percent, e.g. for Nr. 3 only. Okay. Who signs it? Dr. Klein does."),
    ["We use z.B. two sites.", "The rate is 5.5 percent, e.g. for Nr. 3 only.", "Okay. Who signs it?", "Dr. Klein does."]);
  const turn = { at: 63, speaker: "Anna Berg", text: "We need the site on every invoice. Finance needs read-only access." };
  const s = S.transcriptLines([turn]);
  assert.deepEqual(s.map(S.sourceLine), ["[1:03] Anna Berg: We need the site on every invoice.", "[1:03] Anna Berg: Finance needs read-only access."]);
  assert.ok(s.every(x => x.turn === "[1:03] Anna Berg: We need the site on every invoice. Finance needs read-only access."));
  assert.deepEqual(S.transcriptLines([{ at: 1, speaker: "A", text: "One sentence only." }]), [{ at: 1, speaker: "A", text: "One sentence only." }]);
});

test("a requirement captured from a whole turn still shows on each of its sentences; used lines by quoted line or old number", () => {
  const turn = { at: 63, speaker: "Anna Berg", text: "We need the site on every invoice. Finance needs read-only access." };
  const s = S.transcriptLines([turn]);
  const m = S.usedLines(s, [{ reqId: "RQ-00007", sourceText: S.sourceLine(turn) }], [], {});
  assert.deepEqual([...m], [[0, "RQ-00007"], [1, "RQ-00007"]]);
  const own = S.usedLines(s, [{ reqId: "RQ-00008", sourceText: S.sourceLine(s[1]) }], [], { [S.sourceLine(s[0])]: "Licence: Finance, Team Members" });
  assert.deepEqual([...own], [[0, "Licence: Finance, Team Members"], [1, "RQ-00008"]]);
});

test("a negated need is not a must; needs and nötig are", () => {
  for (const t of ["We do not need a second approval.", "We don't need that report.", "No need to print it.", "Nobody needs to sign it.", "A PO is not required here.",
    "Das ist nicht nötig.", "Das brauchen wir nicht.", "Das muss nicht sein.", "Kein Export nötig.", "We needn't print it."]) assert.equal(S.lineSignals(t).must, false, t);
  for (const t of ["Finance needs read-only access.", "No, we need the site on every invoice.", "The technicians must record time offline.", "Wir brauchen die Baustelle auf jeder Rechnung.", "Eine Freigabe ist erforderlich."])
    assert.equal(S.lineSignals(t).must, true, t);
});

test("the paste box warns about missing speakers and times, or a long paste read as one line", () => {
  const raw = "some text\nmore text\neven more\nand more\nstill more";
  assert.match(S.pasteWarnings(raw, [{ at: null, speaker: "", text: raw }]).join(" "), /Only one line/);
  assert.deepEqual(S.pasteWarnings("Anna Berg   0:03\nHi there.", S.parseTranscript("Anna Berg   0:03\nHi there.")), []);
  assert.match(S.pasteWarnings("x", [{ at: null, speaker: "A", text: "x" }]).join(" "), /1 of 1 lines have no time/);
});

test("suggested type: licence, open point, flow change, business rule, requirement, else comment; the facilitator's questions are comments", () => {
  assert.equal(S.suggestType("Finance needs read-only access, about six people."), "licence");
  assert.equal(S.suggestType("Who signs the order?"), "open");
  assert.equal(S.suggestType("Usually the foreman signs the timesheets."), "open");
  assert.equal(S.suggestType("Who decides on the payment run is still open."), "open");
  assert.equal(S.suggestType("After approval we send it straight to the supplier."), "flow");
  assert.equal(S.suggestType("Orders above ten thousand need three quotes."), "rule");
  assert.equal(S.suggestType("Retention is five percent until acceptance."), "rule");
  assert.equal(S.suggestType("We must have the site on every invoice."), "req");
  assert.equal(S.suggestType("Expenses are collected on paper and typed in at month end."), "req");
  assert.equal(S.suggestType("We do not need a second approval."), "comment");
  assert.equal(S.suggestType("How do you invoice?", { facilitator: true }), "comment");
  assert.ok(S.isFacilitator("Lena Hoffmann", "lena hoffmann")); assert.ok(S.isFacilitator("Lena Hoffmann", "Lena"));
  assert.ok(!S.isFacilitator("Lena Hoffmann", "")); assert.ok(!S.isFacilitator("Jonas Keller", "Lena Hoffmann"));
});

test("line review: its own entry first, else what it was already used for, else to do; counts; undo rules; the To do view", () => {
  assert.deepEqual(S.reviewOf("We must have it.", undefined, ""), { status: "todo", type: "req", legacy: false });
  assert.deepEqual(S.reviewOf("We must have it.", { type: "rule" }, ""), { status: "todo", type: "rule", legacy: false });
  assert.deepEqual(S.reviewOf("x", { status: "rejected" }, ""), { status: "rejected", type: "comment", legacy: false });
  assert.deepEqual(S.reviewOf("x", undefined, "RQ-00001"), { status: "accepted", type: "req", legacy: true });
  assert.deepEqual(S.reviewOf("x", { status: "accepted", type: "rule" }, "RQ-00001"), { status: "accepted", type: "rule", legacy: false });
  assert.equal(S.usedType("Flow change: Approve"), "flow"); assert.equal(S.usedType("Licence: Office, Team Members"), "licence"); assert.equal(S.usedType("Open point"), "open");
  const c = S.reviewCounts([{ status: "accepted", type: "req" }, { status: "accepted", type: "open" }, { status: "rejected", type: "comment" }, { status: "todo", type: "rule" }]);
  assert.deepEqual(c, { total: 4, handled: 3, accepted: 2, rejected: 1, todo: 1, byType: { req: 1, rule: 0, comment: 0, open: 1, flow: 0, licence: 0 } });
  const open = { closed: false, signedOff: false };
  assert.equal(S.undoRule({ status: "rejected", type: "req", legacy: false }, open).can, true);
  assert.equal(S.undoRule({ status: "accepted", type: "rule", legacy: false }, open).can, true);
  assert.equal(S.undoRule({ status: "accepted", type: "req", legacy: false }, { closed: false, signedOff: true }).can, false);
  assert.equal(S.undoRule({ status: "rejected", type: "req", legacy: false }, { closed: true, signedOff: false }).can, false);
  assert.match(S.undoRule({ status: "accepted", type: "flow", legacy: false }, open).reason, /flow/);
  assert.match(S.undoRule({ status: "accepted", type: "licence", legacy: false }, open).reason, /role/);
  assert.equal(S.undoRule({ status: "accepted", type: "req", legacy: true }, open).can, false);
  let st = S.readSession("{}");
  st = S.withReview(st, "L1", { type: "rule" }); assert.deepEqual(st.review, { L1: { type: "rule" } });
  st = S.withReview(st, "L1", { status: "accepted", type: "rule" }); assert.equal(st.review.L1.status, "accepted");
  st = S.withReview(st, "L1", { type: undefined, text: "" }); assert.deepEqual(st.review, {});
  assert.deepEqual(S.readSession(JSON.stringify(S.withReview(S.readSession("{}"), "L2", { status: "rejected" }))).review, { L2: { status: "rejected" } });
  const items = [{ r: { status: "accepted" }, b: "p1" }, { r: { status: "rejected" }, b: "p1" }, { r: { status: "todo" }, b: "p1" }, { r: { status: "todo" }, b: "p2" }];
  const v = S.reviewView(items, i => i.b === "p1", "todo");
  assert.equal(v.todo, 1); assert.equal(v.shown.length, 1); assert.equal(v.scoped.length, 3);
  assert.equal(S.reviewView(items, () => true, "all").shown.length, 4);
});

// a workshop with two requirements (one with no owner), a process decision, a licence from the transcript and an action item
const rbReqs = [{ id: "r1", reqId: "RQ-00001", description: "Site on every invoice", owner: "Ana", mapping: "", approvedBy: "", said: "Ana Field", where: "Invoice customers" },
  { id: "r2", reqId: "RQ-00002", description: "Payment plan", owner: "", mapping: "Use milestones", approvedBy: "Ben" }];
const rbProcs = [{ id: "p1", name: "Invoice customers", visited: true, decisions: ["Fit", "Legacy ERP: Retire"] }];
const rbOpen = [{ text: "Who approves above 50k?", owner: "", due: "", source: "[2:00] Ben Office: Who approves above fifty thousand?" }, { text: "Done one", owner: "", due: "", done: true }];
const rbUsed = { "[0:40] Ben Office: Finance needs read-only access.": "Licence: Finance, Team Members", "[1:30] Ana Field: No second approval.": "Flow change: Approve", "3": "Licence: old number key" };

test("read-back lines have stable keys and keep the fixed phrases", () => {
  const items = S.readBackItems(rbReqs, rbProcs, rbOpen, S.transcriptDecisions(rbUsed));
  assert.deepEqual(items.map(i => i.key), ["req:r1", "req:r2", "dec:r2", "proc:p1:Fit", "proc:p1:Legacy ERP", "line:[0:40] Ben Office: Finance needs read-only access.", "line:[1:30] Ana Field: No second approval.",
    "owner:r2", "open:[2:00] Ben Office: Who approves above fifty thousand?"]);
  assert.deepEqual(items.map(i => i.kind), ["Requirement", "Requirement", "Decision", "Decision", "Decision", "Licence", "Decision", "Open point", "Open point"]);
  assert.equal(items[0].text, "Requirement: Site on every invoice (RQ-00001), owner Ana");
  assert.equal(items[0].meta, "RQ-00001 · said by Ana Field · Invoice customers");
  assert.equal(items[6].text, "Decision: Flow change: Approve");
  assert.equal(items[8].meta, "No owner yet");
  const again = S.readBackItems(rbReqs.slice().reverse(), rbProcs, rbOpen, S.transcriptDecisions(rbUsed));
  assert.deepEqual(new Set(again.map(i => i.key)), new Set(items.map(i => i.key)));
  assert.deepEqual(S.summaryLines(rbReqs, rbProcs, rbOpen).slice(0, 2), ["Requirement: Site on every invoice (RQ-00001), owner Ana", "Requirement: Payment plan (RQ-00002)"]);
});

test("a read-back mark toggles, Changed keeps what changed, counts and close checks follow", () => {
  const items = S.readBackItems(rbReqs, rbProcs, rbOpen, S.transcriptDecisions(rbUsed));
  let st = S.readSession("{}");
  st = S.markLine(st, "req:r1", "confirmed");
  st = S.markLine(st, "req:r2", "changed");
  st = S.markLine(st, "req:r2", "changed", "Milestones per site");
  st = S.markLine(st, "owner:r2", "open");
  st = S.markLine(st, "proc:p1:Fit", "confirmed"); st = S.markLine(st, "proc:p1:Fit", "confirmed"); // clicked again: cleared
  assert.deepEqual(st.readBack.marks["req:r2"], { mark: "changed", note: "Milestones per site" });
  assert.equal(st.readBack.marks["proc:p1:Fit"], undefined);
  assert.deepEqual(S.readBackCounts(items, st.readBack), { confirmed: 1, changed: 1, open: 1, left: 6 });
  assert.deepEqual(S.markLine(st, "req:r2", "confirmed").readBack.marks["req:r2"], { mark: "confirmed" });
  assert.deepEqual(S.readSession(JSON.stringify(st)).readBack, st.readBack);
  assert.deepEqual(S.readBackChecks(items, undefined, rbOpen, 3), ["9 read-back lines are not answered yet", "1 action item has no owner", "nobody is named as confirming for the organisation", "3 transcript lines are still to review"]);
  const marks = Object.fromEntries(items.map(i => [i.key, { mark: "confirmed" }]));
  assert.deepEqual(S.readBackChecks(items, { marks, confirmedBy: "Ana Field, Finance lead" }, rbOpen.map(o => ({ ...o, owner: "Ben" })), 0), []);
  const sum = S.readBackSummary(items, { ...st.readBack, confirmedBy: "Ana Field" });
  assert.deepEqual([sum.confirmed.length, sum.changed.length, sum.open.length, sum.notReadBack.length], [1, 1, 1, 6]);
  const html = S.readBackHtml("Harbourview: workshop summary", [["Workshop", "Lead to cash"]], sum);
  assert.match(html, /<h2>Confirmed<\/h2><ul><li>Site on every invoice \(RQ-00001\), owner Ana/);
  assert.match(html, /What changed: Milestones per site/); assert.match(html, /Not read back yet/); assert.match(html, /organisation by:<\/b> Ana Field/);
  assert.ok(!/<script/i.test(S.readBackHtml("<script>", [], S.readBackSummary([], undefined))));
});

test("meeting request: Teams link with subject, times, attendees and agenda; the prep pack per agenda part", () => {
  assert.deepEqual(S.emailsIn("Ana Field <A.Field@harbourview.example>\nBen Office, ben.office@harbourview.example; a.field@harbourview.example"), ["a.field@harbourview.example", "ben.office@harbourview.example"]);
  assert.equal(S.meetingSubject("Harbourview Properties", ["Project to profit"]), "Harbourview Properties process workshop: Project to profit");
  assert.equal(S.meetingMinutes(127), 135); assert.equal(S.meetingMinutes(10), 30);
  const text = S.agendaText([{ text: "80.20.010 Estimate projects", minutes: 12 }, { text: "Wrap up" }]);
  assert.match(text, /^1\. 80\.20\.010 Estimate projects \(0-12 min\)\n2\. Wrap up\n\nPlanned time: 12 minutes/);
  const url = new URL(S.teamsMeetingLink({ subject: "S", start: new Date("2026-11-20T08:00:00Z"), minutes: 90, attendees: ["a@x.example", "b@x.example"], content: text }));
  assert.equal(url.origin + url.pathname, "https://teams.microsoft.com/l/meeting/new");
  assert.equal(url.searchParams.get("startTime"), "2026-11-20T08:00:00.000Z"); assert.equal(url.searchParams.get("endTime"), "2026-11-20T09:30:00.000Z");
  assert.equal(url.searchParams.get("attendees"), "a@x.example,b@x.example");
  const long = new URL(S.teamsMeetingLink({ subject: "S", start: new Date(), minutes: 30, attendees: [], content: "x".repeat(5000) }));
  assert.equal(long.searchParams.get("content").length, 1500); assert.equal(long.searchParams.get("attendees"), null);
  const html = S.prepPackHtml("Harbourview: workshop prep pack", [["Date", "2026-11-20"]], [{ title: "80.20.010 Estimate projects", who: ["Project manager"], systems: ["Excel"], target: ["Project Operations"], questions: ["Which contract types do you use?"], flow: "Create quote → Approve" }]);
  assert.match(html, /Which contract types do you use\?/); assert.match(html, /today: Excel; after: Project Operations/); assert.match(html, /Flow to look at:<\/b> Create quote/); assert.match(html, /Who should come:<\/b> Project manager/);
});

test("screenshot marks: lines tied to nothing, numbered comments kept in the note's text after a fixed line", () => {
  const s = DR.makeStroke([[0, 0], [0.5, 0.5], [10, 10], [20, 20]], "#C50F1F", 4, []);
  assert.deepEqual(s.pts, [[0, 0], [10, 10], [20, 20]]); assert.equal(s.step, null);
  assert.equal(DR.makeStroke([[1, 1]], "#000", 4, []), null);
  const c = DR.makeComment(100, 50, "  Wrong price list  ", [], "Ana");
  assert.equal(c.text, "Wrong price list"); assert.equal(DR.makeComment(1, 1, "  ", []), null);
  const note = DR.noteWithMarks("Screenshot of the quote", { strokes: [s], comments: [c] });
  assert.match(note, /^Screenshot of the quote\n--- marks ---\n/);
  const m = DR.marksOf(note);
  assert.equal(m.lines.length, 1); assert.equal(m.comments[0].text, "Wrong price list");
  assert.equal(DR.shotText(note), "Screenshot of the quote\n1 line drawn on the picture\n1. Wrong price list");
  assert.equal(DR.noteWithMarks(note, { strokes: [], comments: [] }).split("--- marks ---").length, 2); // marks replaced, not added twice
  assert.deepEqual(DR.marksOf("plain note"), { lines: [], comments: [] });
  assert.equal(DR.undoLast({ strokes: [{ ...s, on: "2" }], comments: [{ ...c, on: "1" }] }).strokes.length, 0);
});

test("flow drawing: a line belongs to the step it is on (or near), kept per workshop and flow, and read as plain lines", () => {
  const boxes = [{ code: "P200", x: 0, y: 0, w: 168, h: 62 }, { code: "P300", x: 214, y: 0, w: 168, h: 62 }];
  assert.equal(DR.stepAt(50, 30, boxes), "P200"); assert.equal(DR.stepAt(200, 30, boxes), "P300"); assert.equal(DR.stepAt(900, 900, boxes), null);
  const a = DR.makeStroke([[10, 10], [60, 40]], "#C50F1F", 3, boxes), b = DR.makeComment(250, 20, "Manager signs here", boxes);
  assert.equal(a.step, "P200"); assert.equal(b.step, "P300");
  const raw = DR.writeDrawing("", "flow1", { strokes: [a], comments: [b] });
  assert.deepEqual(Object.keys(DR.readDrawings(raw)), ["flow1"]);
  const moved = DR.retie(DR.readDrawings(raw).flow1, [{ code: "P300", x: 0, y: 0, w: 400, h: 62 }]);
  assert.equal(moved.strokes[0].step, "P300");
  assert.deepEqual(DR.drawingLines(DR.readDrawings(raw).flow1, c => ({ P200: "Capture lead", P300: "Qualify lead" })[c]), ["1 line drawn on Capture lead", "Comment on Qualify lead: Manager signs here"]);
  assert.equal(DR.writeDrawing(raw, "flow1", DR.emptyDrawing()), "{}");
  assert.deepEqual(DR.readDrawings("not json"), {}); assert.deepEqual(DR.readDrawings(JSON.stringify({ f: { strokes: [{ id: 1 }], comments: [] } })), {});
  assert.throws(() => DR.writeDrawing("", "f", { strokes: [{ ...a, pts: Array.from({ length: 120000 }, (_, i) => [i, i]) }], comments: [] }), /too big/);
  assert.equal(DR.pathOf([[0, 0], [5, 5]]), "M0 0 L5 5");
});

test("a requirement opens its flow at its step: the link's words", () => {
  assert.equal(R.flowLinkText({ code: "80.20.010", name: "Estimate projects" }, "Approve the estimate"), "Open flow: 80.20.010 Estimate projects › Approve the estimate");
  assert.equal(R.flowLinkText({ code: "", name: "Own process" }, null), "Open flow: Own process");
});
