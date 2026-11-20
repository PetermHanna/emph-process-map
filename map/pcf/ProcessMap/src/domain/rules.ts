// Requirement, scope, fit-gap, flow and sign-off rules with no Dataverse or UI, so they can be tested alone.
import { SIGNOFF, DELTA, SHAPE, SCOPE, FIT_GAP, GAP_UNSPECIFIED, APPROVAL, RAID, RAID_STATUS, ITEM_LABEL, labelOf, option, ListName } from "./codes";
import type { Activity, FlowLink, ProcessItem, Requirement, Raid, HistoryRow, LicencePrice, PriceKind } from "./types";

/** Rejected and closed (deferred, duplicate) requirements no longer count. */
export const isActive = (r: Pick<Requirement, "approval" | "closedReason">) => r.approval !== APPROVAL.rejected && !r.closedReason;

// ---------- the process item tree ----------
type Node = Pick<ProcessItem, "id" | "parentId" | "level" | "scope">;
// The catalog has about 4,700 items, so the tree is indexed once per items array (the model replaces the array on every change).
const INDEX = new WeakMap<object, { byId: Map<string, Node>; kids: Map<string | null, Node[]> }>();
function indexOf<T extends Node>(items: T[]) {
  let ix = INDEX.get(items);
  if (!ix) {
    ix = { byId: new Map(), kids: new Map() };
    for (const x of items) { ix.byId.set(x.id, x); const k = ix.kids.get(x.parentId); if (k) k.push(x); else ix.kids.set(x.parentId, [x]); }
    INDEX.set(items, ix);
  }
  return ix as unknown as { byId: Map<string, T>; kids: Map<string | null, T[]> };
}
export const childrenOf = <T extends Node>(items: T[], id: string | null): T[] => (indexOf(items).kids.get(id) || []).slice();
/** The item's parents, nearest first. */
export function ancestorsOf<T extends Node>(items: T[], item: T): T[] {
  const { byId } = indexOf(items), out: T[] = [], seen = new Set<string>();
  for (let p = item.parentId ? byId.get(item.parentId) : undefined; p && !seen.has(p.id); p = p.parentId ? byId.get(p.parentId) : undefined) { out.push(p); seen.add(p.id); }
  return out;
}
/** The item at `level` above (or at) this one. */
export const levelUp = <T extends Node>(items: T[], item: T, level: number): T | undefined => (item.level === level ? item : ancestorsOf(items, item).find(x => x.level === level));
/** All items below, any depth. */
export function descendantsOf<T extends Node>(items: T[], id: string): T[] {
  const out: T[] = [];
  for (let wave = childrenOf(items, id); wave.length; wave = wave.flatMap(x => childrenOf(items, x.id))) out.push(...wave);
  return out;
}

/** 30 - Out of scope or 40 - Not applicable. */
export const isOff = (scope: number | null | undefined) => scope === SCOPE.out || scope === SCOPE.na;
/**
 * The Scope values a level takes (Peter's decision 1, as Business Map): a business process (level 3) takes fit/gap, not
 * scope, so its Scope is only 10 - Unspecified or 40 - Not applicable. Levels 1, 2 and 4 take all four.
 */
export const scopeChoices = (level: number): number[] => (level === 3 ? [SCOPE.unspecified, SCOPE.na] : [SCOPE.unspecified, SCOPE.in, SCOPE.out, SCOPE.na]);
export const scopeProblem = (level: number, scope: number | null) =>
  scope == null || scopeChoices(level).includes(scope) ? null : level === 3 ? "A business process (level 3) takes fit/gap, not scope: its Scope is only 40 - Not applicable." : "Scope must be one of Microsoft's four values.";
/** Fit gap status and Gap solution approach belong to business processes (level 3) and scenarios (level 4). */
export const fitGapLevel = (level: number) => level >= 3;
/** Counts as in on its own: 20 - In scope at levels 1, 2 and 4; at level 3 anything but Not applicable (or an older Out of scope). */
const on = (x: Node) => (x.level === 3 ? !isOff(x.scope) : x.scope === SCOPE.in);
/**
 * In scope: the item and every item above it count as in. An end-to-end process or process area out of scope, not
 * applicable or not decided greys everything below it; a business process Not applicable greys its scenarios.
 */
export const inScope = <T extends Node>(items: T[], item: T) => on(item) && ancestorsOf(items, item).every(on);
/** The nearest item above that is Out of scope or Not applicable: the one that greys this item. */
export const offAbove = <T extends Node>(items: T[], item: T): T | undefined => ancestorsOf(items, item).find(a => isOff(a.scope));
export const scopeDecided = (scope: number | null) => scope != null && scope !== SCOPE.unspecified;

/** "Field Service, Finance" -> ["Field Service", "Finance"] */
export const productList = (s: string) => String(s || "").split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
/** The software of a scenario: its Products; for our own scenario on other software (Products "Other"), its Software solutions. */
export const softwareOf = (x: { products: string; softwareSolution?: string }) => {
  const p = productList(x.products);
  return (!p.length || (p.length === 1 && p[0] === "Other")) && x.softwareSolution ? productList(x.softwareSolution) : p;
};
/**
 * Products are read up from level 4: an item's products are those of its scenarios in scope. A scenario's products are its own;
 * an item with no scenarios keeps its own products (the catalog gives business processes products too).
 */
type Soft = Node & { products: string; softwareSolution?: string };
export function productsOf(items: Soft[], item: Soft): string[] {
  if (item.level >= 4) return softwareOf(item);
  const below = descendantsOf(items, item.id).filter(x => x.level === 4);
  const list = below.length ? below.filter(x => inScope(items, x)).flatMap(softwareOf) : productList(item.products);
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
}

/** Microsoft: a Gap needs a gap solution approach (not 10 - Unspecified). */
export const fitGapProblem = (x: { fitGap: number | null; gapApproach: number | null }) =>
  x.fitGap === FIT_GAP.gap && (x.gapApproach == null || x.gapApproach === GAP_UNSPECIFIED) ? "A gap needs a gap solution approach." : null;

/** A business process's fit-gap read up from its scenarios in scope: any Gap makes a Gap, all Fit a Fit, else not known. */
export function fitFromScenarios<T extends Node & { fitGap: number | null }>(items: T[], item: T): number | null {
  const used = childrenOf(items, item.id).filter(x => x.level === 4 && inScope(items, x));
  if (!used.length) return null;
  if (used.some(x => x.fitGap === FIT_GAP.gap)) return FIT_GAP.gap;
  return used.every(x => x.fitGap === FIT_GAP.fit) ? FIT_GAP.fit : null;
}

/** A process item's fit-gap from its active requirements: Gap if any is a gap, Fit if all rated ones fit, else not known. */
export function itemFitGap(reqs: Requirement[], itemId: string): { fitGap: number | null; gaps: number; rated: number; unrated: number } {
  const active = reqs.filter(r => r.itemId === itemId && isActive(r));
  const rated = active.filter(r => r.fitGap === FIT_GAP.fit || r.fitGap === FIT_GAP.gap);
  const gaps = rated.filter(r => r.fitGap === FIT_GAP.gap).length;
  return { fitGap: gaps ? FIT_GAP.gap : rated.length ? FIT_GAP.fit : null, gaps, rated: rated.length, unrated: active.length - rated.length };
}

/** The first line of a description, cut to fit the name column. */
export function titleOf(text: string, max = 200): string {
  const line = text.trim().split(/\r?\n/)[0].trim();
  return line.length <= max ? line : line.slice(0, max - 1).trimEnd() + "…";
}

export const requirementProblem = (r: { description: string; fitGap?: number | null; gapApproach?: number | null }) =>
  r.description.trim() ? fitGapProblem({ fitGap: r.fitGap ?? null, gapApproach: r.gapApproach ?? null }) : "A requirement needs a description.";

/** Fields a sign-off freezes; a change to any of them shows in the comparison. */
export const FROZEN = ["name", "description", "type", "priority", "approval", "fitGap", "gapApproach", "complexity", "mapping", "acceptanceCriteria", "closedReason", "approvedBy", "approvedOn", "owner", "raisedBy"] as const;
export const freeze = (r: Requirement) => Object.fromEntries(FROZEN.map(f => [f, r[f]])) as Record<string, unknown>;

export interface FrozenItem { type: number; key: string; name: string; description: string; snapshot: Record<string, any> }
export type Difference =
  | { kind: "added"; item: FrozenItem }
  | { kind: "removed"; item: FrozenItem }
  | { kind: "changed"; item: FrozenItem; fields: string[]; before: FrozenItem };

/** What differs between a signed-off set and today. A field missing from an older snapshot counts as empty. */
export function differences(frozen: FrozenItem[], current: FrozenItem[]): Difference[] {
  const id = (x: FrozenItem) => x.type + ":" + x.key;
  const now = new Map(current.map(x => [id(x), x]));
  const was = new Set(frozen.map(id));
  const val = (o: Record<string, any>, k: string) => JSON.stringify(o[k] ?? null);
  const out: Difference[] = [];
  for (const f of frozen) {
    const n = now.get(id(f));
    if (!n) { out.push({ kind: "removed", item: f }); continue; }
    const fields = Array.from(new Set([...Object.keys(f.snapshot), ...Object.keys(n.snapshot)])).filter(k => val(f.snapshot, k) !== val(n.snapshot, k));
    if (fields.length) out.push({ kind: "changed", item: n, fields, before: f });
  }
  for (const c of current) if (!was.has(id(c))) out.push({ kind: "added", item: c });
  return out;
}

/** A sign-off in review can be approved, unless a newer one is already approved. */
export const canApprove = (s: { version: number; state: number }, all: { version: number; state: number }[]) =>
  s.state === SIGNOFF.review && !all.some(x => x.state === SIGNOFF.approved && x.version > s.version);

/** IDs for our own process items run in their own series, apart from Microsoft's catalog numbers. */
export function nextOwnCode(codes: string[]): string {
  const max = Math.max(0, ...codes.map(x => /^X(\d+)$/.exec(x)).filter(Boolean).map(m => Number((m as RegExpExecArray)[1])));
  return "X" + String(max + 1).padStart(3, "0");
}

/** A new flow runs from Start to End, so it can be opened and drawn at once. */
export const starterActivities = (lane: string) => [
  { code: "A10", name: "Start", shape: SHAPE.start, lane, links: [{ to: "A90", label: "" }], rank: 10 },
  { code: "A90", name: "End", shape: SHAPE.end, lane, links: [] as FlowLink[], rank: 20 },
];

export interface FlowDelta { code: string; name: string; kind: "added" | "removed" | "changed"; rationale: string }

/**
 * Real differences from the reference. Adding or removing an activity rewires its neighbours too;
 * a neighbour whose only difference is that rewiring is not a change of its own.
 */
export function flowDeltas(ours: Activity[], ref: Activity[]): FlowDelta[] {
  const added = new Set(ours.filter(x => x.delta === DELTA.added).map(x => x.code));
  const removed = new Set(ours.filter(x => x.delta === DELTA.removed).map(x => x.code));
  const out: FlowDelta[] = [];
  const key = (l: FlowLink) => l.to + "|" + (l.label || "");
  for (const a of ours) {
    const rationale = a.rationale || "";
    if (added.has(a.code)) { out.push({ code: a.code, name: a.name, kind: "added", rationale }); continue; }
    if (removed.has(a.code)) { out.push({ code: a.code, name: a.name, kind: "removed", rationale }); continue; }
    const r = ref.find(x => x.code === a.code);
    if (!r) continue;
    const own = a.name !== r.name || a.shape !== r.shape || (a.lane || "") !== (r.lane || "") || (a.summary || "") !== (r.summary || "");
    const gained = a.links.filter(l => !r.links.some(x => key(x) === key(l))).map(l => l.to);
    const lost = r.links.filter(l => !a.links.some(x => key(x) === key(l))).map(l => l.to);
    const rewired = (gained.length > 0 || lost.length > 0) && !gained.some(c => added.has(c)) && !lost.some(c => removed.has(c));
    if (own || rewired) out.push({ code: a.code, name: a.name, kind: "changed", rationale });
  }
  return out;
}

/** Activities nothing leads to any more, leaving out Start and those the reference also has no way into. */
export function unreachable(ours: Activity[], ref: Activity[]): Activity[] {
  const live = ours.filter(x => x.delta !== DELTA.removed);
  const into = (list: Activity[], code: string) => list.some(x => x.links.some(l => l.to === code));
  return live.filter(a => {
    if (into(live, a.code) || a.shape === SHAPE.start) return false;
    const r = ref.find(x => x.code === a.code);
    return !r || into(ref, a.code);
  });
}

export const covers = (originRef: string, code: string) => originRef.split(",").includes(code);
export const coveredBy = (deltas: { code: string }[], links: Record<string, string>, requirementId: string) =>
  deltas.filter(c => links[c.code] === requirementId).map(c => c.code).join(",");

export const deltaText = (d: FlowDelta) =>
  ({ added: "New activity", removed: "Dropped activity", changed: "Changed activity" }[d.kind]) + " “" + d.name + "”" + (d.rationale.trim() ? ": " + d.rationale.trim() : "");

/** Has someone worked on a generated requirement beyond what the flow wrote? */
export function touchedByHand(r: Requirement, generated: string | null): boolean {
  return (r.approval != null && r.approval !== APPROVAL.new) || r.fitGap != null || r.gapApproach != null || r.priority != null || r.type != null || r.complexity != null
    || !!r.mapping || !!r.acceptanceCriteria || !!r.closedReason || !!r.approvedBy || !!r.approvedOn || !!r.owner || !!r.sourceText
    || (generated != null && r.description !== generated);
}

/** Next free activity code. */
export function nextActivityCode(list: { code: string }[]): string {
  const n = Math.max(0, ...list.map(x => Number(/^A(\d+)$/.exec(x.code)?.[1] || 0)));
  return "A" + (Math.ceil((n + 1) / 5) * 5);
}

// ---------- RAID (Microsoft's Risk, Assumption, Issue, Decision, Action item, Change request) ----------
/** Decisions and change requests are Proposed, Decided or Withdrawn; the other types Open, In progress or Closed. */
export const raidStatuses = (type: number): number[] =>
  type === RAID.decision || type === RAID.change ? [RAID_STATUS.proposed, RAID_STATUS.decided, RAID_STATUS.withdrawn] : [RAID_STATUS.open, RAID_STATUS.progress, RAID_STATUS.closed];
export const raidOpen = (status: number | null | undefined) => status == null || status === RAID_STATUS.open || status === RAID_STATUS.progress || status === RAID_STATUS.proposed;
/** The status a new item of a type starts in. */
export const raidStart = (type: number) => raidStatuses(type)[0];

export type RaidKey = keyof Raid;
export interface RaidField { key: RaidKey; label: string; kind: "text" | "note" | "choice" | "number"; list?: ListName }
const F = (key: RaidKey, label: string, kind: RaidField["kind"] = "text", list?: ListName): RaidField => ({ key, label, kind, list });
/** Each type's own fields, as Microsoft's ADO template has them (Priority, Owner and Target date are on every type). */
export const RAID_FIELDS: Record<number, RaidField[]> = {
  [RAID.risk]: [F("probability", "Probability (%)", "number"), F("impactSeverity", "Impact severity", "choice", "impactSeverity"), F("riskCategory", "Risk category", "choice", "riskCategory"),
    F("riskResponse", "Risk response", "choice", "riskResponse"), F("riskImpactAssessment", "Risk impact assessment", "note"), F("triggers", "Triggers", "note"), F("contingencyPlan", "Contingency plan", "note")],
  [RAID.assumption]: [F("impact", "Impact if it is wrong", "note"), F("resolution", "Validated how", "note")],
  [RAID.issue]: [F("issueType", "Issue type", "choice", "issueType"), F("severity", "Severity", "choice", "severity"), F("reportedBy", "Reported by"), F("impact", "Impact", "note"), F("resolution", "Resolution", "note")],
  [RAID.decision]: [F("decisionMaker", "Decision maker"), F("impact", "Impact", "note"), F("justification", "Justification", "note"), F("alternativeSolution", "Alternatives considered", "note")],
  [RAID.action]: [F("responsibleParty", "Responsible party", "choice", "responsibleParty"), F("responsibleRole", "Responsible role", "choice", "responsibleRole"), F("resolution", "Outcome", "note")],
  [RAID.change]: [F("changeRequestType", "Change request type", "choice", "changeRequestType"), F("requestor", "Requestor"), F("decisionMaker", "Approver"), F("justification", "Justification", "note"),
    F("impactAssessment", "Impact assessment", "note"), F("alternativeSolution", "Alternative solution", "note")],
};
/** What a RAID item must have before it is saved. */
export function raidProblem(r: Pick<Raid, "description" | "type" | "status" | "decisionMaker" | "probability">): string | null {
  if (!r.description.trim()) return "A RAID item needs a description.";
  if (!raidStatuses(r.type).includes(r.status)) return "That status is not one of a " + (labelOf("raidType", r.type) || "RAID item") + "'s.";
  if (r.type === RAID.decision && r.status === RAID_STATUS.decided && !r.decisionMaker.trim()) return "A decided decision needs a decision maker.";
  if (r.probability != null && (r.probability < 0 || r.probability > 100)) return "Probability is a percentage from 0 to 100.";
  return null;
}
/** RAID items filtered by type and status ("open" = still open, "closed" = done, or one status value): open first, then by target date. */
export function raidFilter<T extends Pick<Raid, "type" | "status" | "targetDate" | "createdOn">>(list: T[], type: number | null, status: "open" | "closed" | "all" | number): T[] {
  return list.filter(x => (type == null || x.type === type) && (status === "all" || (status === "open" ? raidOpen(x.status) : status === "closed" ? !raidOpen(x.status) : x.status === status)))
    .sort((a, b) => Number(raidOpen(b.status)) - Number(raidOpen(a.status)) || (a.targetDate || "9").localeCompare(b.targetDate || "9") || a.createdOn.localeCompare(b.createdOn));
}

/** The choice list of each frozen field, so a change request reads labels. */
const FROZEN_LIST: Record<string, ListName> = { scope: "scope", fitGap: "fitGapStatus", gapApproach: "gapSolutionApproach", priority: "priority", approval: "businessApprovalState",
  type: "requirementType", complexity: "estimatedComplexity", origin: "requirementOrigin" };
/** A change after an approved sign-off becomes a Change request: what changed, from what to what. */
export function changeRequestFor(d: Difference, signOff: { version: number }): { description: string; justification: string; frozenKey: string; changeRequestType: "Scope Change" | "Design Change" } {
  const show = (v: unknown, f = "") => (v == null || v === "" ? "empty" : FROZEN_LIST[f] && typeof v === "number" ? labelOf(FROZEN_LIST[f], v) || String(v)
    : typeof v === "boolean" ? (v ? "yes" : "no") : typeof v === "object" ? JSON.stringify(v).slice(0, 120) : String(v));
  const what = ITEM_LABEL[d.item.type] || "Item";
  const lines = d.kind === "changed" ? d.fields.map(f => f + ": " + show(d.before.snapshot[f], f) + " → " + show(d.item.snapshot[f], f))
    : [d.kind === "added" ? "Added since the sign-off." : "Removed since the sign-off."];
  return { description: "Change after sign-off v" + signOff.version + ": " + what + " " + d.item.name, justification: lines.join("\n"), frozenKey: d.item.type + ":" + d.item.key,
    changeRequestType: what === "Scope" ? "Scope Change" : "Design Change" };
}

// ---------- history (emph_history) ----------
export interface HistoryField { field: string; column: string; label: string; list: ListName | null }
const H = (field: string, column: string, label: string, list: ListName | null = null): HistoryField => ({ field, column, label, list });
/** The fields whose changes are written to emph_history, per table: the model field, the column, the label, the choice list. */
export const HISTORY_FIELDS: Record<string, HistoryField[]> = {
  emph_processitem: [H("name", "emph_name", "Name"), H("scope", "emph_scope", "Scope", "scope"), H("scopeReason", "emph_scopereason", "Scope reason"), H("fitGap", "emph_fitgapstatus", "Fit gap status", "fitGapStatus"),
    H("gapApproach", "emph_gapsolutionapproach", "Gap solution approach", "gapSolutionApproach"), H("fitGapReason", "emph_fitgapreason", "Fit gap rationale"), H("products", "emph_products", "Products"),
    H("softwareSolution", "emph_softwaresolutions", "Software solutions"), H("owner", "emph_businessprocessowner", "Business process owner"), H("workstreamLead", "emph_workstreamlead", "Workstream lead"),
    H("sme", "emph_subjectmatterexpert", "Subject matter expert"), H("complexity", "emph_baselinecomplexity", "Baseline complexity", "baselineComplexity"), H("priority", "emph_priority", "Priority", "priority")],
  emph_requirement: [H("description", "emph_description", "Description"), H("fitGap", "emph_fitgapstatus", "Fit gap status", "fitGapStatus"), H("gapApproach", "emph_gapsolutionapproach", "Gap solution approach", "gapSolutionApproach"),
    H("priority", "emph_priority", "Priority", "priority"), H("approval", "emph_approvalstate", "Business approval state", "businessApprovalState"), H("itemId", "_emph_item_value", "Process item"),
    H("owner", "emph_owner", "Owner"), H("acceptanceCriteria", "emph_acceptancecriteria", "Acceptance criteria"), H("mapping", "emph_requirementmapping", "Requirement mapping")],
};
export const historyField = (table: string, column: string) => (HISTORY_FIELDS[table] || []).find(x => x.column === column);
/** A value as the history shows it: the label of a choice, the text otherwise. */
export const historyText = (v: unknown, list: ListName | null) => (v == null ? "" : list ? labelOf(list, v as number) || String(v) : String(v));
/** The history of one row, newest first. */
export const historyOf = (rows: HistoryRow[], table: string, rowId: string) => rows.filter(h => h.table === table && h.rowId === rowId).sort((a, b) => b.createdOn.localeCompare(a.createdOn));

/**
 * What restoring a history row's old value writes: the field back to its old value. A Gap comes back with the gap
 * solution approach changed at the same moment, since a Gap needs one.
 */
export function restorePatch(h: HistoryRow, all: HistoryRow[]): { patch: Record<string, unknown> } | { problem: string } {
  const def = historyField(h.table, h.field);
  if (!def) return { problem: "This change can't be restored here." };
  let value: unknown = h.oldValue;
  if (def.list) {
    value = h.oldValue ? option(def.list, h.oldValue) : null;
    if (h.oldValue && value == null) return { problem: "“" + h.oldValue + "” is not one of the choices any more." };
  } else if (def.field === "itemId") value = h.oldValue || null;
  const patch: Record<string, unknown> = { [def.field]: value };
  if (def.field === "fitGap" && value === FIT_GAP.gap) {
    const t = Date.parse(h.createdOn);
    const twin = all.find(x => x.table === h.table && x.rowId === h.rowId && x.field === "emph_gapsolutionapproach" && Math.abs(Date.parse(x.createdOn) - t) < 2000);
    if (twin && twin.oldValue) patch.gapApproach = option("gapSolutionApproach", twin.oldValue);
  }
  return { patch };
}

// ---------- licences per role (Dynamics 365 licensing, as Business Map's C7) ----------
export const PRICE_KINDS: PriceKind[] = ["Base", "Attach", "Team Members", "Operations - Activity", "Device"];
/** Products that need no Dynamics 365 user licence of their own (Microsoft 365, Power Platform and the like are licensed apart). */
export const NOT_D365 = ["Microsoft 365", "Teams", "SharePoint", "Power BI", "Power Apps", "Power Automate", "Power Pages", "Azure", "Other", "Microsoft Copilot Studio", "Agent 365", "Project"];
export type LicenceTypeName = "Full" | "Team Members" | "Operations - Activity" | "Device" | "None";
export interface LicenceSuggestion { type: LicenceTypeName; base: string | null; attach: string[]; why: string }
/** The newest price of a product and kind valid on a day (rows for Team Members, Activity and Device may leave the product empty). */
export function priceOf(prices: LicencePrice[], product: string, kind: PriceKind, on = "9999-12-31"): LicencePrice | null {
  const rows = prices.filter(x => x.kind === kind && (x.product === product || (!x.product && kind !== "Base" && kind !== "Attach")) && (x.validFrom || "") <= on)
    .sort((a, b) => (b.validFrom || "").localeCompare(a.validFrom || ""));
  return rows[0] || null;
}
/**
 * Suggest a role's licence from the products of the scenarios it works in: working in a Dynamics 365 product = Full, with
 * the highest priced of them as the base and the others attached; reading only = Team Members; a shared device = Device;
 * nothing = None. Without prices the base is the first by name.
 */
export function suggestLicence(writes: string[], reads: string[], prices: LicencePrice[], device = false): LicenceSuggestion {
  const d365 = (p: string) => !NOT_D365.includes(p);
  const w = Array.from(new Set(writes.filter(d365))), r = Array.from(new Set(reads.filter(d365)));
  if (device && w.length) return { type: "Device", base: null, attach: [], why: "A shared device: a device licence." };
  if (!w.length) return r.length ? { type: "Team Members", base: null, attach: [], why: "Reads only in " + r.join(", ") + ": Team Members." } : { type: "None", base: null, attach: [], why: "Works in no Dynamics 365 product." };
  const cost = (p: string) => priceOf(prices, p, "Base")?.price ?? -1;
  const sorted = [...w].sort((a, b) => cost(b) - cost(a) || a.localeCompare(b));
  const base = sorted[0], attach = sorted.slice(1), known = priceOf(prices, base, "Base");
  return { type: "Full", base, attach, why: "Works in " + w.join(", ") + ": base " + base + (known ? " (" + known.price + " " + known.currency + ", the highest priced)" : "") + (attach.length ? ", attach " + attach.join(", ") : "") + "." };
}
/** Products of the in-scope scenarios below the items a role works in (or, at a level 4 item, its own software). */
export function roleProducts<T extends Soft>(items: T[], links: { itemId: string; roleId: string }[], roleId: string): string[] {
  const ids = new Set(links.filter(x => x.roleId === roleId).map(x => x.itemId));
  const out = items.filter(x => ids.has(x.id) && inScope(items, x)).flatMap(x => productsOf(items, x));
  return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
}
/** Attach products as a list ("Field Service; Finance" or with commas). */
export const splitProducts = (v: string | undefined) => productList(v || "");
/** What a role's licence must respect: Full needs a base product; attach licences need a Full user; the base is not attached again. */
export function licenceProblems(r: { type: string | null; base: string | null; attach: string }): string[] {
  const out: string[] = [], att = splitProducts(r.attach);
  if (r.type === "Full" && !r.base) out.push("A full user needs a base product (the highest priced app).");
  if (att.length && r.type !== "Full") out.push("Attach products need a full user with a base licence.");
  if (r.base && att.includes(r.base)) out.push("The base product is not attached again.");
  return out;
}
/** Licences per type and product, headcount weighted, with a monthly estimate from the price table (complete = every licence priced). */
export function licenceSummary(roles: { headcount: number | null; type: string | null; base: string | null; attach: string }[], prices: LicencePrice[] = [], on = "9999-12-31") {
  const products: Record<string, { base: number; attach: number }> = {};
  const totals: Record<LicenceTypeName | "open", number> = { Full: 0, "Team Members": 0, "Operations - Activity": 0, Device: 0, None: 0, open: 0 };
  let cost = 0, priced = true;
  const add = (p: LicencePrice | null, n: number) => { if (!n) return; if (p) cost += p.price * n; else priced = false; };
  for (const r of roles) {
    const n = r.headcount ?? 0;
    const t = (r.type && r.type in totals ? r.type : "open") as LicenceTypeName | "open";
    totals[t] += n;
    if (t === "Full") {
      if (r.base) { (products[r.base] = products[r.base] || { base: 0, attach: 0 }).base += n; add(priceOf(prices, r.base, "Base", on), n); } else if (n) priced = false;
      for (const a of splitProducts(r.attach)) { (products[a] = products[a] || { base: 0, attach: 0 }).attach += n; add(priceOf(prices, a, "Attach", on), n); }
    } else if (t === "Team Members" || t === "Operations - Activity" || t === "Device") add(priceOf(prices, "", t, on), n);
    else if (t === "open" && n) priced = false;
  }
  const currencies = Array.from(new Set(prices.map(p => p.currency).filter(Boolean)));
  return { products, totals, monthly: prices.length ? cost : null, currency: currencies.length === 1 ? currencies[0] : currencies.join("/"), complete: priced && prices.length > 0 };
}
