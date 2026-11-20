// Requirement, scope, fit-gap, flow and sign-off rules with no Dataverse or UI, so they can be tested alone.
import { SIGNOFF, DELTA, SHAPE, SCOPE, FIT_GAP, GAP_UNSPECIFIED, APPROVAL } from "./codes";
import type { Activity, FlowLink, ProcessItem, Requirement } from "./types";

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

/**
 * Microsoft's Scope, 20 - In scope, counts only when every parent is in scope too: an item out of scope (or not decided)
 * greys everything below it.
 */
export const inScope = <T extends Node>(items: T[], item: T) => item.scope === SCOPE.in && ancestorsOf(items, item).every(a => a.scope === SCOPE.in);
export const scopeDecided = (scope: number | null) => scope != null && scope !== SCOPE.unspecified;

/** "Field Service, Finance" -> ["Field Service", "Finance"] */
export const productList = (s: string) => String(s || "").split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
/**
 * Products are read up from level 4: an item's products are those of its scenarios in scope. A scenario's products are its own;
 * an item with no scenarios keeps its own products (the catalog gives business processes products too).
 */
export function productsOf(items: (Node & { products: string })[], item: Node & { products: string }): string[] {
  if (item.level >= 4) return productList(item.products);
  const below = descendantsOf(items, item.id).filter(x => x.level === 4);
  const list = below.length ? below.filter(x => inScope(items, x)).flatMap(x => productList(x.products)) : productList(item.products);
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
}

/** Microsoft: a Gap needs a gap solution approach (not 10 - Unspecified). */
export const fitGapProblem = (x: { fitGap: number | null; gapApproach: number | null }) =>
  x.fitGap === FIT_GAP.gap && (x.gapApproach == null || x.gapApproach === GAP_UNSPECIFIED) ? "A gap needs a gap solution approach." : null;

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
