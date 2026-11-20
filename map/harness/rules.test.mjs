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
  const m = S.usedLines(u, [{ reqId: "RQ-00003", verbatim: "[0:01] Ana: One." }], [{ text: "x", source: "[0:02] Ben: Two." }], { 3: "Flow change: Approve order", 4: "Licence: Technician, Team Members" }, [{ source: "[0:03] Ana: Three." }]);
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
    { key: "p1", code: "95.25.100", name: "Receive service requests", notUsed: false, appToday: "Spreadsheet", appTarget: "Field Service", disposition: "Transition", roles: ["Dispatcher"], scope: ["Emergency jobs <b>"], openQuestions: 2, activities: acts },
    { key: "p2", code: "95.25.950", name: "Schedule frontline workers", notUsed: false, appToday: "", appTarget: "", disposition: "", roles: [], scope: [], openQuestions: 0, activities: [] },
    { key: "p3", code: "95.35.100", name: "Old process", notUsed: true, appToday: "X", appTarget: "Y", disposition: "", roles: ["R"], scope: ["s"], openQuestions: 3, activities: acts },
  ]);
  const [x, y, z] = a.items;
  assert.equal(x.minutes, 5 + Math.ceil(3 * 1.5) + 2 + 2); assert.equal(x.from, 0); assert.equal(y.from, x.to); assert.equal(y.minutes, 5); assert.equal(z.minutes, 2); assert.equal(a.total, x.minutes + 5 + 2);
  assert.deepEqual(x.prompts, ["Do you do this? Who does it (Dispatcher)?", "Today in Spreadsheet: still right?", "After migration in Field Service: agreed?", "Planned: Transition. Agreed?", "In scope: Emergency jobs <b>",
    "Decision \u201cApproved?\u201d: what happens on each outcome, and who decides?", "2 setup questions to answer", "What can't the standard do here, and why does it matter?"]);
  assert.deepEqual(y.prompts.slice(0, 3), ["Do you do this? Who does it?", "Which system or tool is used today?", "Which system after migration?"]);
  assert.deepEqual(z.prompts, ["Marked not used: confirm nobody does this."]);
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
