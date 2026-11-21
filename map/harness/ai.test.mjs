// AI analysis (slice 5): the change set, the guard, the suggestions, the review segments, accept with history, the caller,
// the files. No real model: every answer here is made up. Run from map/: node --test harness/ai.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import zlib from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(root, "pcf/package.json"))("typescript");
const out = mkdtempSync(join(tmpdir(), "emph-ai-"));
const src = join(root, "pcf/ProcessMap/src");
const emit = (file, name) => {
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: "ESNext", target: "ES2020" } }).outputText
    .replace(/from "\.\.\/data\/(\w+)"/g, 'from "./$1.mjs"').replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(out, name + ".mjs"), js);
};
for (const n of ["codes", "types", "workshop", "session", "rules", "drawing", "ai", "aiModels", "aiFiles", "repository"]) emit(join(src, "domain", n + ".ts"), n);
emit(join(src, "data", "api.ts"), "api");
const load = n => import(pathToFileURL(join(out, n + ".mjs")));
const C = await load("codes"), A = await load("ai"), M = await load("aiModels"), F = await load("aiFiles"), RP = await load("repository"), API = await load("api");

// ---------- a small made-up organisation ----------
const item = (id, level, parentId, code, name, p = {}) => ({ id, level, parentId, code, name, catalogName: name, summary: "", rank: 10, scope: C.SCOPE.in, scopeReason: "", scopeApproach: "", fitGap: null, gapApproach: null,
  fitGapReason: "", owner: "", workstreamLead: "", sme: "", complexity: null, priority: null, processType: null, isOwn: false, author: null, catalogStatus: null, products: "", softwareSolution: "",
  setHow: null, setBy: "", setOn: null, present: "", workshopName: "", accent: "", comments: "", ...p });
const act = (id, code, name, shape, links, rank, p = {}) => ({ id, flowId: "f1", code, name, shape, lane: "Clerk", stage: "", links: links.map(to => ({ to, label: "" })), summary: "", delta: C.DELTA.same, rank, rationale: "", pos: null, ...p });
function model() {
  return {
    workspace: { id: "ws1", organisation: "Northwind Test Works", settings: { prices: [], demoLinks: [] } },
    items: [item("e80", 1, null, "80", "Project to profit"), item("a20", 2, "e80", "80.20", "Plan projects"), item("p10", 3, "a20", "80.20.010", "Create project", { scope: C.SCOPE.unspecified, workshopName: "Kick-off" }),
      item("p20", 3, "a20", "80.20.020", "Estimate project", { scope: C.SCOPE.unspecified }), item("s1", 4, "p10", "80.20.010.100", "Create a fixed price project"),
      item("a30", 2, "e80", "80.30", "Deliver projects", { scope: C.SCOPE.out }), item("e90", 1, null, "90", "Hire to retire", { scope: C.SCOPE.out })],
    systems: [{ id: "sy1", itemId: "a20", name: "Spreadsheet planner", vendor: "", decision: null, retireOn: null, users: "", hosting: "", note: "" }],
    roles: [{ id: "ro1", name: "Project clerk", summary: "", rank: 10, headcount: 3, licenceType: C.LICENCE.full }],
    itemRoles: [], flows: [{ id: "f1", itemId: "p10", name: "Create project", type: C.FLOW_TYPE.reference, state: C.FLOW_STATE.draft, code: "80.20.010", sourceLink: "https://learn.microsoft.com/example", comments: "", referenceId: null }],
    decisions: [], requirements: [{ id: "q1", reqId: "RQ-00001", name: "Budget", description: "A budget per project phase", itemId: "p10", origin: C.REQ_ORIGIN.captured, originRef: "", originFlowId: null, review: false,
      type: null, fitGap: null, gapApproach: null, scopeApproach: "", acceptanceCriteria: "", mapping: "", priority: null, approval: C.APPROVAL.approved, author: null, complexity: null, owner: "", approvedBy: "", approvedOn: null,
      closedReason: "", sourceType: "", sourceText: "", raisedBy: "", workshopId: null, evidenceFlowId: null }],
    raids: [], workshops: [{ id: "w1", name: "Projects deep dive", heldOn: "2026-11-18", facilitator: "Fran", participants: "", minutes: "", phase: 2, status: C.SESSION.open, itemId: "e80", msType: null, sbdPhase: null, kind: null, order: 1, units: "80", childTasks: "", session: { processIds: ["p10"], current: null, visits: [] }, transcript: "", drawings: "" }],
    signOffs: [], comments: [], history: [], proposals: [],
  };
}
const ACTS = [act("x1", "S1", "Start", C.SHAPE.start, ["P100"], 10), act("x2", "P100", "Enter project details", C.SHAPE.activity, ["P200"], 20), act("x3", "P200", "Approve project", C.SHAPE.decision, ["E1"], 30), act("x4", "E1", "End", C.SHAPE.end, [], 40)];
const LINES = [
  { at: 5, speaker: "Ana Field", text: "Every project needs a budget approval above ten thousand euros." },
  { at: 20, speaker: "Ben Stone", text: "I think the controller usually checks it." },
  { at: 40, speaker: "Ana Field", text: "We plan everything in the spreadsheet planner today." },
];
function setup(m = model()) {
  const lines = A.timeline({ lines: LINES, start: "2026-11-18T09:00:00Z", visits: [{ key: "p10", name: "Create project", at: "2026-11-18T09:00:00Z" }],
    shots: [{ id: "n1", subject: "Screenshot: project form", createdOn: "2026-11-18T09:00:30Z", text: "Screenshot: project form\n1. Budget field is missing" }] });
  const picture = A.buildPicture({ model: m, focusId: "e80", processIds: ["p10"], activities: { f1: ACTS }, workshopId: "w1" });
  const req = A.buildRequest({ model: m, picture, lines, activities: { f1: ACTS }, task: { kind: "workshop", name: "Projects deep dive", date: "2026-11-18", kindName: "Deep dive" },
    documents: [{ name: "policy.docx", text: "Projects above ten thousand euros need the approval of the controller." }, { name: "scan.pdf", file: { mimeType: "application/pdf", base64: "", pages: 1 } }], fileIndex: 0 });
  return { m, lines, picture, req };
}
const ev = (where, quote, source = "S1") => [{ source, where, quote }];
const it = (p) => ({ ref: "", object: "requirement", op: "create", target: "", parent: "80.20.010", fields: {}, evidence: [], confidence: "high", note: "", same: "", ...p });
const set = items => ({ version: "emph-1", summary: "s", items, questions: [] });

// ---------- the request ----------
test("the timeline puts a screenshot at its moment and the lines on what was on screen", () => {
  const { lines, req } = setup();
  assert.deepEqual(lines.map(l => l.kind), ["spoken", "spoken", "screenshot", "spoken"]);
  assert.equal(lines[2].id, "L0003"); assert.equal(lines[2].speaker, "Screenshot"); assert.match(lines[2].text, /Budget field is missing/);
  assert.match(req.Transcript, /^== On screen: 80\.20\.010 Create project ==\nL0001 \| 0:05 \| Ana Field \| Every project/);
  assert.deepEqual(req.pictures, [{ line: "L0003", kind: "screenshot" }]);
  const late = A.timeline({ lines: LINES, start: null, visits: [], shots: [{ id: "n", subject: "x", createdOn: "2026-11-18T09:00:30Z", text: "a picture" }] });
  assert.equal(late[3].kind, "screenshot", "without a start time a seen line goes last");
});
test("the picture lists the focus with IDs, levels and the agenda's flow; sources are numbered", () => {
  const { picture, req } = setup();
  const ids = picture.map(p => p.id);
  for (const id of ["ORG", "80", "80.20", "80.20.010", "80.20.010.100", "FL-1", "FL-1.P100", "RQ-00001", "RO-1", "SY-1"]) assert.ok(ids.includes(id), id);
  assert.equal(picture.find(p => p.id === "80.20.010").level, "Confirmed");
  assert.equal(picture.find(p => p.id === "RQ-00001").level, "Confirmed");
  assert.ok(!ids.includes("80.30.010"), "an area out of scope is listed without its processes");
  assert.deepEqual(req.guard.sources.map(s => s.id + ":" + s.kind), ["S1:transcript", "S2:pictures", "S3:text", "S4:file"]);
  assert.match(req.Documents, /^=== S3 \| policy\.docx ===/);
  assert.match(req.Context, /SOURCES \(id \| kind \| name\)/);
  assert.equal(req.documentFile.name, "scan.pdf");
});

// ---------- parsing ----------
test("the change set is read from flat items, a fields object or key/value pairs, in a fence or with text around it", () => {
  const raw = '```json\n{"version":"emph-1","summary":"x","items":[{"ref":"n1","object":"Requirement","op":"CREATE","parent":"80.20.010","text":"A budget","priority":"must","approach":"","evidence":[{"source":"s1","where":"L0001","quote":"q"}]},' +
    '{"ref":"n2","object":"fit gap","op":"change","target":"80.20.010","fields":{"fit":"gap"}},{"ref":"n3","object":"risk","op":"create","fields":[{"key":"text","value":"Late data"}],"same":"n1"}],"questions":[{"unit":"80","text":"Who approves?","why":"approval"}]}\n```';
  const s = A.parseChangeSet("Here it is: " + raw);
  assert.equal(s.items[0].object, "requirement"); assert.equal(s.items[0].op, "create"); assert.deepEqual(s.items[0].fields, { text: "A budget", priority: "must" });
  assert.equal(s.items[0].evidence[0].source, "S1");
  assert.equal(s.items[1].object, "fit_gap"); assert.equal(s.items[1].fields.fit, "gap");
  assert.equal(s.items[2].fields.text, "Late data"); assert.equal(s.items[2].same, "n1"); assert.equal(s.items[2].confidence, "medium");
  assert.equal(s.questions[0].text, "Who approves?");
  assert.throws(() => A.parseChangeSet('{"summary":"no items"}'), /no items list/);
  assert.throws(() => A.parseChangeSet("not json"), /no JSON/);
});

// ---------- the guard ----------
test("the guard drops invented and short quotes, and moves a quote to the line it is on", () => {
  const { req } = setup();
  const r = A.guardChangeSet(set([
    it({ ref: "n1", fields: { text: "Budget approval above ten thousand euros" }, evidence: ev("L0002", "needs a budget approval above ten thousand euros") }),
    it({ ref: "n2", fields: { text: "Projects are approved by the board" }, evidence: ev("L0001", "the board approves every project") }),
    it({ ref: "n3", fields: { text: "A planner" }, evidence: ev("L0003", "spreadsheet planner") }),
    it({ ref: "n4", fields: { text: "Controller approval" }, evidence: ev("", "need the approval of the controller", "S3") }),
    it({ ref: "n5", fields: { text: "Scan says" }, evidence: ev("page 1", "anything at all", "S4") }),
    it({ ref: "n6", fields: { text: "Ghost" }, evidence: ev("", "this source was never sent", "S9") }),
  ]), req.guard);
  assert.deepEqual(r.kept.map(k => k.ref), ["n1", "n4", "n5"]);
  assert.equal(r.kept[0].evidence[0].where, "L0001", "moved to the line that holds the quote");
  assert.equal(r.kept[2].quotesUnchecked, 1); assert.equal(r.kept[2].confidence, "medium", "only unchecked quotes: high becomes medium");
  assert.match(r.dropped.find(d => d.item.ref === "n2").reason, /the quote is not in S1/);
  assert.match(r.dropped.find(d => d.item.ref === "n3").reason, /too short/);
  assert.match(r.dropped.find(d => d.item.ref === "n6").reason, /S9 was not sent/);
  assert.match(A.guardText(r), /3 kept, 3 dropped/);
});
test("the guard: a target must exist and be the right kind; a create names none; numbers must be in the quotes", () => {
  const { req } = setup();
  const q = ev("L0001", "Every project needs a budget approval above ten thousand euros");
  const r = A.guardChangeSet(set([
    it({ ref: "a", op: "change", target: "RQ-09999", fields: { text: "x y z" }, evidence: q }),
    it({ ref: "b", op: "change", target: "SY-1", fields: { text: "x y z" }, evidence: q }),
    it({ ref: "c", target: "RQ-00001", fields: { text: "x y z" }, evidence: q }),
    it({ ref: "d", fields: { text: "Approval above 20,000 euros" }, evidence: q }),
    it({ ref: "e", fields: { text: "Approval above 10,000 euros" }, evidence: q }),
    it({ ref: "f", object: "scope", op: "create", target: "99.99", evidence: q }),
    it({ ref: "g", object: "teleport", op: "create", evidence: q }),
    it({ ref: "e", fields: { text: "again" }, evidence: q }),
    it({ ref: "h", object: "licence", op: "create", fields: { licence: "Full" }, evidence: q }),
  ]), req.guard);
  const why = Object.fromEntries(r.dropped.map(d => [d.item.ref + (d.item.fields.text === "again" ? "2" : ""), d.reason]));
  assert.match(why.a, /RQ-09999 is not in the picture/);
  assert.match(why.b, /SY-1 is a system, not a requirement/);
  assert.match(why.c, /a create names an existing target/);
  assert.match(why.d, /number 20000 is not in its quotes/);
  assert.match(why.f, /99\.99 is not a process item/);
  assert.match(why.g, /unknown object teleport/);
  assert.match(why.e2, /used twice/);
  assert.match(why.h, /can't be created/);
  assert.deepEqual(r.kept.map(k => k.ref), ["e"], "ten thousand is 10,000");
});
test("the guard: a Gap needs Microsoft's gap solution approach; fit-gap only on levels 3 and 4", () => {
  const { req } = setup();
  const q = ev("L0001", "Every project needs a budget approval");
  const fg = (ref, target, f) => it({ ref, object: "fit_gap", op: "change", target, parent: "", fields: f, evidence: q });
  const r = A.guardChangeSet(set([fg("a", "80.20.010", { fit: "gap" }), fg("b", "80.20.010", { fit: "gap", approach: "10 - Unspecified" }), fg("c", "80.20.010", { fit: "gap", approach: "Power Platform" }),
    fg("d", "80.20", { fit: "fit" }), fg("e", "80.20.020", { fit: "maybe" }), it({ ref: "f", fields: { text: "A budget check", fit: "gap" }, evidence: q }), fg("g", "80.20.010.100", { fit: "gap", approach: "20" })]), req.guard);
  assert.deepEqual(r.kept.map(k => k.ref), ["c", "g"]);
  for (const ref of ["a", "b", "f"]) assert.match(r.dropped.find(d => d.item.ref === ref).reason, /a Gap needs a gap solution approach/, ref);
  assert.match(r.dropped.find(d => d.item.ref === "d").reason, /level 3\) and scenarios/);
  assert.equal(A.approachValue("Power Platform"), C.option("gapSolutionApproach", "30 - Power Platform"));
  assert.equal(A.approachValue("50"), C.option("gapSolutionApproach", "50 - X++ Extension"));
  assert.equal(A.approachValue("java/plug-in"), C.option("gapSolutionApproach", "40 - Java/Plug-in"));
  assert.equal(A.approachValue("magic"), null);
});
test("the guard: parents, steps, open questions without a quote, observations", () => {
  const { req } = setup();
  const q = ev("L0001", "Every project needs a budget approval");
  const r = A.guardChangeSet(set([
    it({ ref: "p1", object: "process", parent: "80.20", fields: { name: "Check budgets", reason: "the catalog has no budget check" }, evidence: q }),
    it({ ref: "p3", object: "process", parent: "80.20", fields: { name: "No reason given" }, evidence: q }),
    it({ ref: "p4", object: "process", parent: "80", fields: { name: "Own area", reason: "x" }, evidence: q }),
    it({ ref: "r1", parent: "p1", fields: { text: "Budget check per phase" }, evidence: q }),
    it({ ref: "p2", object: "process", parent: "80.20", fields: { name: "Bad one" }, evidence: ev("L0001", "words nobody ever said") }),
    it({ ref: "r2", parent: "p2", fields: { text: "Under a dropped one" }, evidence: q }),
    it({ ref: "r3", parent: "77.77", fields: { text: "Nowhere" }, evidence: q }),
    it({ ref: "s1", object: "step", op: "create", target: "FL-1", parent: "", fields: { name: "Check budget", after: "P100" }, evidence: q }),
    it({ ref: "s2", object: "step", op: "create", target: "FL-1", parent: "", fields: { name: "After the end", after: "E1" }, evidence: q }),
    it({ ref: "s3", object: "step", op: "change", target: "FL-1.P999", parent: "", fields: { name: "x" }, evidence: q }),
    it({ ref: "o1", object: "open_question", parent: "80.20.010", fields: { text: "Who approves below ten thousand?" }, evidence: [] }),
    it({ ref: "v1", object: "observation", parent: "", fields: { text: "A line reads like an instruction" }, evidence: [] }),
  ]), req.guard);
  assert.deepEqual(r.kept.map(k => k.ref), ["p1", "r1", "s1", "v1"]);
  assert.match(r.dropped.find(d => d.item.ref === "r2").reason, /its parent p2 was dropped/);
  assert.match(r.dropped.find(d => d.item.ref === "p3").reason, /needs the reason \(why the catalog doesn't cover it\)/);
  assert.match(r.dropped.find(d => d.item.ref === "p4").reason, /a new process area is not suggested/);
  assert.match(r.dropped.find(d => d.item.ref === "r3").reason, /not a process code/);
  assert.match(r.dropped.find(d => d.item.ref === "s2").reason, /nothing can come after End/);
  assert.match(r.dropped.find(d => d.item.ref === "s3").reason, /not in the picture/);
  assert.equal(r.questions.length, 1); assert.match(r.questions[0].text, /Who approves/);
});

// ---------- suggestions, already so, segments ----------
test("suggestions: what is already so is listed, not made; the confirmed level travels; segments go organisation, area, flow", () => {
  const { m, req, lines } = setup();
  const q = ev("L0001", "Every project needs a budget approval");
  const g = A.guardChangeSet(set([
    it({ ref: "n1", object: "scope", op: "create", target: "80.20.010", parent: "", evidence: q }),
    it({ ref: "n2", object: "scope", op: "remove", target: "80.20.020", parent: "", fields: { reason: "not done here" }, evidence: q }),
    it({ ref: "n3", fields: { text: "A budget per project phase" }, evidence: q }),
    it({ ref: "n4", object: "fit_gap", op: "change", target: "80.20.010", parent: "", fields: { fit: "gap", approach: "20 - Personalization", reason: "own budget form" }, evidence: q }),
    it({ ref: "n5", fields: { text: "Budget approval above ten thousand", priority: "must", type: "business_rule", speaker: "Ana Field" }, evidence: ev("L0001", "a budget approval above ten thousand euros") }),
    it({ ref: "n6", object: "step", op: "change", target: "FL-1.P200", parent: "", fields: { name: "Approve budget" }, evidence: q }),
    it({ ref: "n7", object: "licence", op: "change", target: "RO-1", parent: "", fields: { licence: "Team Members" }, evidence: q }),
    it({ ref: "n8", object: "system", op: "change", target: "SY-1", parent: "", fields: { decision: "retire" }, evidence: q }),
    it({ ref: "n9", object: "observation", parent: "", fields: { text: "Two people disagree on the approver" }, evidence: [] }),
  ]), req.guard);
  const mp = A.proposalsOf(g, req.guard, m, { run: "ai-1", workshopId: "w1", lines });
  assert.deepEqual(mp.skipped.map(s => s.ref + ": " + s.why), ["n1: 80.20.010 is in scope already", "n3: is requirement RQ-00001 already"]);
  const by = ref => mp.proposals.find(p => p.details.ref === ref);
  assert.equal(by("n2").proposed, "40 - Not applicable (not done here)", "a business process goes Not applicable, not Out of scope");
  assert.equal(by("n4").details.level, "Confirmed"); assert.equal(by("n4").current, "not set"); assert.match(by("n4").proposed, /^Gap \(20 - Personalization\)/);
  assert.match(by("n5").proposed, /\(Business rule, Must\)/); assert.equal(by("n5").status, C.PROPOSAL.suggested); assert.equal(by("n5").source, C.PROPOSAL_SOURCE.transcript);
  assert.equal(by("n6").details.segment, "flow:f1"); assert.equal(by("n6").details.stepCode, "P200"); assert.equal(by("n6").targetRowId, "", "a reference flow's step: our process is made on accept");
  assert.match(by("n7").current, /^Full, 3 people/); assert.match(by("n8").proposed, /^Retire/);
  const segs = A.segmentsOf(mp.proposals.map((p, i) => ({ ...p, id: "x" + i })), m);
  assert.deepEqual(segs.map(s => s.key), ["org", "80.20", "flow:f1"]);
  assert.equal(segs[0].title, "Organisation and notes"); assert.equal(segs[1].title, "80.20 Plan projects"); assert.equal(A.segmentCount(segs[1]), "4 of 4 open");
});
test("a later call's \"same\" joins the first call's item; its other items keep their own refs", () => {
  const a = set([it({ ref: "n1", fields: { text: "x" }, evidence: ev("L0001", "a b c") })]);
  const b = set([it({ ref: "n1", same: "n1", evidence: ev("page 1", "d e f", "S4") }), it({ ref: "n2", parent: "n1", fields: { text: "y" }, evidence: ev("page 2", "g h i", "S4") })]);
  const { set: s, joined } = A.mergeSets(a, b, "d1");
  assert.equal(joined, 1); assert.equal(s.items.length, 2); assert.equal(s.items[0].evidence.length, 2);
  assert.equal(s.items[1].ref, "n2"); assert.equal(s.items[1].parent, "n1", "its parent is the item it repeats");
  const c = A.mergeSets(a, set([it({ ref: "n1", fields: { text: "z" }, evidence: ev("p", "j k l", "S4") })]), "d1").set;
  assert.equal(c.items[1].ref, "d1.n1", "a clashing ref is renamed");
});

// ---------- accept, edit, reject, clear: with history ----------
function fakeGateway(m) {
  const T = { emph_flowactivity: ACTS.map(a => ({ emph_flowactivityid: a.id, emph_name: a.name, emph_activitycode: a.code, emph_shape: a.shape, emph_lane: a.lane, emph_links: JSON.stringify(a.links), emph_delta: a.delta, emph_rank: a.rank, _emph_processflow_value: "f1" })) };
  let n = 0;
  const rows = t => (T[t] = T[t] || []);
  return {
    T, async query(t, q) { const f = /\$filter=(\w+) eq ([\w-]+)/.exec(q || ""); return rows(t).filter(r => !f || r[f[1]] === f[2]).map(r => ({ ...r })); },
    async insert(t, d) { const id = "g" + ++n; const r = { [t + "id"]: id, ...d }; for (const k of Object.keys(d)) if (k.endsWith("@odata.bind")) r["_" + k.split("@")[0].toLowerCase() + "_value"] = /\(([^)]+)\)/.exec(d[k])[1]; if (t === "emph_requirement") r.emph_reqid = "RQ-0" + (1000 + n); rows(t).push(r); return id; },
    async patch(t, id, d) { const r = rows(t).find(x => x[t + "id"] === id); if (r) Object.assign(r, d); },
    async drop(t, id) { T[t] = rows(t).filter(x => x[t + "id"] !== id); },
    async promptReady() { return null; }, async predict() { return { ok: false, filtered: false, message: "no model in the tests" }; },
  };
}
async function runOf(items) {
  const s = setup();
  const g = A.guardChangeSet(set(items), s.req.guard);
  const mp = A.proposalsOf(g, s.req.guard, s.m, { run: "ai-t", workshopId: "w1", lines: s.lines });
  const gw = fakeGateway(s.m), repo = new RP.Repository(gw, "Reviewer One");
  const log = A.runLog(g, s.req.guard, mp, { run: "ai-t", at: "2026-11-18T10:00:00Z", task: "workshop", workshopId: "w1", model: "chat", seconds: 3, estimate: "", calls: [{ name: "first", ok: true, error: "", seconds: 3 }] });
  const model = await repo.saveRun(s.m, mp.proposals, log);
  return { gw, repo, model, by: ref => model.proposals.find(p => p.details.ref === ref) };
}
const q1 = ev("L0001", "Every project needs a budget approval above ten thousand euros");
test("accepting applies through the repository with How AI accepted and history; edited words make it Edited; decided once", async () => {
  const { gw, repo, model, by } = await runOf([
    it({ ref: "n1", fields: { text: "Budget approval above ten thousand euros", priority: "must", type: "business_rule", speaker: "Ana Field" }, evidence: q1 }),
    it({ ref: "n2", object: "fit_gap", op: "change", target: "80.20.010", parent: "", fields: { fit: "gap", approach: "Power Platform", reason: "approval flow" }, evidence: q1 }),
    it({ ref: "n3", object: "risk", fields: { text: "Approvals may slow project starts", owner: "Ben Stone" }, evidence: q1 }),
  ]);
  assert.equal(gw.T.emph_proposal.length, 3); assert.ok(gw.T.emph_proposal.every(r => r.emph_status === C.PROPOSAL.suggested && r.emph_run === "ai-t" && r._emph_workshop_value === "w1"));
  assert.equal(model.workshops[0].session.ai[0].run, "ai-t", "the run log is on the workshop");
  let m = await repo.acceptProposal(model, by("n1"), "Budget approval needed above ten thousand euros");
  const rq = m.requirements[m.requirements.length - 1];
  assert.equal(rq.description, "Budget approval needed above ten thousand euros"); assert.equal(rq.type, C.option("requirementType", "Business rule")); assert.equal(rq.priority, C.option("priority", "1"));
  assert.equal(rq.raisedBy, "Ana Field"); assert.equal(rq.workshopId, "w1"); assert.equal(rq.itemId, "p10"); assert.equal(rq.sourceType, "AI analysis (accepted)");
  let h = gw.T.emph_history.at(-1);
  assert.equal(h.emph_how, C.HOW.ai); assert.equal(h.emph_field, "Created"); assert.equal(h.emph_workshopname, "Projects deep dive"); assert.equal(h.emph_by, "Reviewer One");
  assert.equal(m.proposals.find(p => p.details.ref === "n1").status, C.PROPOSAL.edited);
  await assert.rejects(repo.acceptProposal(m, m.proposals.find(p => p.details.ref === "n1")), /decided already/);
  m = await repo.acceptProposal(m, m.proposals.find(p => p.details.ref === "n2"));
  const p10 = m.items.find(x => x.id === "p10");
  assert.equal(p10.fitGap, C.FIT_GAP.gap); assert.equal(p10.gapApproach, C.option("gapSolutionApproach", "30 - Power Platform")); assert.equal(p10.setHow, C.HOW.ai);
  h = gw.T.emph_history.filter(x => x.emph_field === "emph_fitgapstatus").at(-1);
  assert.equal(h.emph_how, C.HOW.ai); assert.equal(h.emph_newvalue, "Gap");
  m = await repo.acceptProposal(m, m.proposals.find(p => p.details.ref === "n3"));
  const r = m.raids.at(-1);
  assert.equal(r.type, C.RAID.risk); assert.equal(r.owner, "Ben Stone"); assert.match(r.source, /^AI analysis of workshop transcript/);
  assert.equal(m.proposals.find(p => p.details.ref === "n3").status, C.PROPOSAL.accepted);
});
test("reject, Clear this run (only untouched suggestions go), and a child waits for its new process", async () => {
  const { gw, repo, model, by } = await runOf([
    it({ ref: "p1", object: "process", parent: "80.20", fields: { name: "Check budgets", reason: "no catalog process checks phase budgets" }, evidence: q1 }),
    it({ ref: "r1", parent: "p1", fields: { text: "Budget check per phase" }, evidence: q1 }),
    it({ ref: "r2", fields: { text: "Approval above ten thousand euros" }, evidence: q1 }),
    it({ ref: "r3", fields: { text: "Approvals above ten thousand euros by the controller" }, evidence: q1 }),
  ]);
  await assert.rejects(repo.acceptProposal(model, by("r1")), /accept that one first/);
  let m = await repo.acceptProposal(model, by("p1"));
  const own = m.items.find(x => x.name === "Check budgets");
  assert.ok(own && own.isOwn && own.parentId === "a20");
  m = await repo.acceptProposal(m, m.proposals.find(p => p.details.ref === "r1"));
  assert.equal(m.requirements.at(-1).itemId, own.id, "the requirement goes under the process accepted just before");
  m = await repo.rejectProposal(m, m.proposals.find(p => p.details.ref === "r2"));
  m = await repo.clearRun(m, "ai-t");
  assert.deepEqual(m.proposals.map(p => p.details.ref + ":" + C.labelOf("proposalStatus", p.status)), ["p1:Accepted", "r1:Accepted", "r2:Rejected"]);
  assert.equal(gw.T.emph_proposal.length, 3);
});
test("a flow step suggestion makes our process from Microsoft's reference and changes the step there", async () => {
  const { gw, repo, model, by } = await runOf([it({ ref: "s1", object: "step", op: "change", target: "FL-1.P200", parent: "", fields: { name: "Approve budget" }, evidence: q1 }),
    it({ ref: "s2", object: "step", op: "create", target: "FL-1", parent: "", fields: { name: "Check budget", after: "P100", lane: "Controller" }, evidence: q1 })]);
  let m = await repo.acceptProposal(model, by("s1"));
  const ours = m.flows.find(f => f.type === C.FLOW_TYPE.ours);
  assert.ok(ours, "our process was made");
  const step = gw.T.emph_flowactivity.find(a => a._emph_processflow_value === ours.id && a.emph_activitycode === "P200");
  assert.equal(step.emph_name, "Approve budget"); assert.equal(step.emph_delta, C.DELTA.changed); assert.match(step.emph_rationale, /AI analysis/);
  m = await repo.acceptProposal(m, m.proposals.find(p => p.details.ref === "s2"));
  const mine = gw.T.emph_flowactivity.filter(a => a._emph_processflow_value === ours.id);
  const added = mine.find(a => a.emph_name === "Check budget");
  assert.equal(added.emph_delta, C.DELTA.added); assert.equal(added.emph_lane, "Controller");
  assert.deepEqual(JSON.parse(mine.find(a => a.emph_activitycode === "P100").emph_links).map(l => l.to), [added.emph_activitycode]);
  assert.deepEqual(JSON.parse(added.emph_links).map(l => l.to), ["P200"]);
});

// ---------- the question generator ----------
test("question generator: inputs from the flow; links must be given, steps must exist, no repeats, at most 8", () => {
  const m = model();
  const inp = A.questionInputs(m, m.items.find(x => x.id === "p10"), { activities: ACTS, asked: ["Who approves a project?"], systems: ["Spreadsheet planner"] });
  assert.match(inp.Process, /80\.20\.010 Create project/); assert.match(inp.Catalog, /P100 Enter project details \[Clerk\]/); assert.match(inp.Catalog, /80\.20\.010\.100/);
  assert.deepEqual(inp.links, ["https://learn.microsoft.com/example"]); assert.match(inp.Known, /budget per project phase/);
  const many = Array.from({ length: 12 }, (_, i) => ({ text: "Question " + i + "?", why: "w" }));
  const r = A.checkQuestions(JSON.stringify({ questions: [{ text: "Who approves a project?" }, { text: "Which fields are mandatory?", step: "P100", link: "https://learn.microsoft.com/example" },
    { text: "What numbering?", step: "Z9", link: "https://example.com/made-up" }, ...many] }), inp);
  assert.ok(r.ok);
  assert.equal(r.questions.length, 8); assert.equal(r.questions[0].step, "P100 Enter project details"); assert.equal(r.questions[0].link, "https://learn.microsoft.com/example");
  assert.equal(r.questions[1].link, ""); assert.equal(r.questions[1].step, ""); assert.equal(r.questions[1].problems.length, 2);
  assert.ok(r.dropped.some(d => d.why === "asked already"));
  assert.equal(A.checkQuestions("nonsense", inp).ok, false);
});

// ---------- the caller ----------
test("the Predict caller finds a prompt by name (an id is used as it is), polls a long call, reports a content filter", async () => {
  const calls = [];
  const reply = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });
  const fetchFn = async (url, init) => {
    calls.push([init?.method || "GET", url, init?.body ? JSON.parse(init.body) : null]);
    if (url.includes("msdyn_aimodels?")) return reply(200, { value: url.includes("Missing") ? [] : [{ msdyn_aimodelid: "11111111-2222-4333-8444-555555555555" }] });
    if (url.endsWith(".Predict") && calls.filter(c => c[0] === "POST").length === 1) return reply(200, { overrideHttpStatusCode: 202, overrideLocation: "https://poll.example/1" });
    if (url.startsWith("https://poll")) return reply(200, { responsev2: { predictionOutput: { text: '{"items":[]}' } } });
    return reply(400, { error: { message: "InputContentFiltered: blocked" } });
  };
  const c = new API.PromptCaller(fetchFn, "", async () => {});
  assert.match(await c.ready("Missing prompt"), /not set up/);
  const r = await c.predict("EMPH Analyse", { Context: "c", Transcript: "t" });
  assert.equal(r.ok, true); assert.equal(r.output, '{"items":[]}');
  const post = calls.find(x => x[0] === "POST");
  assert.match(post[1], /msdyn_aimodels\(11111111-2222-4333-8444-555555555555\)\/Microsoft\.Dynamics\.CRM\.Predict$/);
  assert.equal(post[2].version, "2.0"); assert.equal(post[2].requestv2.Context, "c"); assert.ok(JSON.parse(post[2].source).partnerSource);
  const f = await c.predict("{AAAAAAAA-2222-4333-8444-555555555555}", {});
  assert.equal(f.ok, false); assert.equal(f.filtered, true);
  assert.ok(calls.some(x => x[1].includes("aaaaaaaa-2222") || x[1].includes("AAAAAAAA-2222")), "an id goes straight to Predict");
});
test("model choice: credits and time first, reasoning far dearer; prompt names by default, else the settings", () => {
  const chat = M.estimateRun([{ chars: 20000, pictures: 2 }], "chat"), think = M.estimateRun([{ chars: 20000, pictures: 2 }], "reasoning");
  assert.ok(think.credits > 15 * chat.credits && think.seconds > 4 * chat.seconds);
  assert.match(M.estimateText(chat), /^about \d[\d,]* AI Builder credits, about \d+ s$/);
  assert.match(M.estimateText(M.estimateRun([{ chars: 200000 }], "reasoning")), /100 s limit/);
  assert.equal(M.promptOf(undefined, "analyse", "reasoning"), "EMPH Analyse (GPT-5 reasoning)");
  assert.equal(M.promptOf({ analyse: { chat: " My prompt " } }, "analyse", "chat"), "My prompt");
  assert.ok(M.progressOf(1000, 10) < 1);
});

// ---------- the prompt files ----------
test("the prompt files declare the inputs the app sends, and their output example reads as a change set", () => {
  const md = readFileSync(join(root, "schema/prompts/analyse.md"), "utf8").replace(/\r\n/g, "\n");
  for (const i of M.PROMPT_INPUTS.analyse) { assert.ok(md.includes("| `" + i.name + "` | " + (i.type === "text" ? "Text" : "Image or document")), i.name); assert.ok(md.includes("[" + i.name + "]"), "placeholder " + i.name); }
  const instr = /## Instructions[\s\S]*?```text\n([\s\S]*?)\n```/.exec(md)[1];
  assert.ok(Math.abs(instr.length - M.PROMPT_CHARS.analyse) < 1500, "PROMPT_CHARS.analyse is about the prompt's length: " + instr.length);
  for (const o of A.OBJECTS) assert.ok(instr.includes("- " + o + ":") || instr.includes(", " + o + ":") || instr.includes(o + ", ") || instr.includes(" " + o + ":"), o);
  const example = /## Output[\s\S]*?```json\n([\s\S]*?)\n```/.exec(md)[1];
  const s = A.parseChangeSet(example);
  assert.equal(s.version, A.CONTRACT); assert.equal(s.items[0].object, "requirement");
  assert.ok(!/elevion|ampro|hermos/i.test(md), "no Elevion content");
  const qmd = readFileSync(join(root, "schema/prompts/questions.md"), "utf8").replace(/\r\n/g, "\n");
  for (const i of M.PROMPT_INPUTS.questions) { assert.ok(qmd.includes("| `" + i.name + "` |"), i.name); assert.ok(qmd.includes("[" + i.name + "]"), "placeholder " + i.name); }
  assert.ok(A.checkQuestions(/## Output[\s\S]*?```json\n([\s\S]*?)\n```/.exec(qmd)[1], { links: [], steps: [], Asked: "" }).ok);
});

// ---------- files ----------
const crc32 = buf => { let c, crc = 0xffffffff; for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; };
test("files: the blank picture is a real PNG; uploads go as a file, as text or as a converted picture; old Office files are refused", () => {
  const png = Buffer.from(F.BLANK_PNG, "base64");
  let at = 8;
  while (at < png.length) { const len = png.readUInt32BE(at), type = png.subarray(at + 4, at + 8); assert.equal(crc32(png.subarray(at + 4, at + 8 + len)), png.readUInt32BE(at + 8 + len), type.toString()); at += 12 + len; }
  assert.deepEqual(F.uploadWay("a.pdf", "application/pdf", 10), { ok: true, way: "file", mimeType: "application/pdf" });
  assert.deepEqual(F.uploadWay("a.docx", "", 10), { ok: true, way: "text", kind: "docx" });
  assert.deepEqual(F.uploadWay("a.webp", "", 10), { ok: true, way: "picture" });
  assert.equal(F.uploadWay("a.doc", "", 10).ok, false); assert.equal(F.uploadWay("a.zip", "", 10).ok, false); assert.equal(F.uploadWay("a.pdf", "", 30 * 1024 * 1024).ok, false);
  const pdf = F.documentPdf([{ heading: "Page 1 = line L0003 (screenshot)", lines: ["Größe: 10 €"] }, { heading: "two", lines: [] }]);
  assert.equal(Buffer.from(pdf.subarray(0, 5)).toString(), "%PDF-"); assert.equal(F.pdfPages(pdf), 2); assert.equal(F.pdfProblem(pdf), null);
  assert.equal(F.toBase64(F.fromBase64("aGVsbG8=")), "aGVsbG8=");
});
test("files: a Word document's text is read in the browser (zip, deflate, paragraphs)", async () => {
  const files = { "word/document.xml": '<w:document><w:body><w:p><w:r><w:t>Projects above ten thousand</w:t></w:r><w:r><w:t xml:space="preserve"> euros need approval.</w:t></w:r></w:p><w:p><w:r><w:t>R&amp;D projects are exempt.</w:t></w:r></w:p></w:body></w:document>', "word/media/image1.png": "x" };
  const parts = [], central = [];
  let off = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text), data = zlib.deflateRawSync(raw), nb = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nb.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(raw.length, 24); cen.writeUInt16LE(nb.length, 28); cen.writeUInt32LE(off, 42);
    parts.push(local, nb, data); central.push(cen, nb); off += 30 + nb.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(2, 8); end.writeUInt16LE(2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  const zip = new Uint8Array(Buffer.concat([...parts, cd, end]));
  const ex = await F.readTextUpload("policy.docx", "docx", zip, async b => new Uint8Array(zlib.inflateRawSync(b)));
  assert.deepEqual(ex.sections[0].lines, ["Projects above ten thousand euros need approval.", "R&D projects are exempt."]);
  assert.equal(ex.pictures, 1);
  assert.match(F.extractedText(ex), /^## Text\nProjects above/);
});
