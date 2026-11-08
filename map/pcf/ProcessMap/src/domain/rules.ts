// Requirement, flow and sign-off rules with no Dataverse or UI, so they can be tested alone.
import { REQ_STATE, SIGNOFF, DELTA, SHAPE } from "./codes";
import type { Activity, FlowLink, Requirement } from "./types";

/** Rejected, duplicate and deferred requirements no longer count. */
export const isActive = (r: Pick<Requirement, "state">) => r.state !== REQ_STATE.rejected && r.state !== REQ_STATE.duplicate && r.state !== REQ_STATE.deferred;

/** A process's coverage is its weakest rated active requirement. */
export function processCoverage(reqs: Requirement[], processId: string): { coverage: number | null; weakest: Requirement | null; rated: number; unrated: number } {
  const active = reqs.filter(r => r.processId === processId && isActive(r));
  const rated = active.filter(r => r.coverage != null);
  const weakest = rated.reduce<Requirement | null>((w, r) => (!w || (r.coverage as number) > (w.coverage as number) ? r : w), null);
  return { coverage: weakest ? weakest.coverage : null, weakest, rated: rated.length, unrated: active.length - rated.length };
}

/** The first line of a description, cut to fit the name column. */
export function titleOf(text: string, max = 200): string {
  const line = text.trim().split(/\r?\n/)[0].trim();
  return line.length <= max ? line : line.slice(0, max - 1).trimEnd() + "…";
}

export const requirementProblem = (r: { description: string }) => (r.description.trim() ? null : "A requirement needs a description.");

/** Fields a sign-off freezes; a change to any of them shows in the comparison. */
export const FROZEN = ["name", "description", "moscow", "category", "state", "coverage", "size", "resolution", "resolvedBy", "resolvedOn", "owner", "raisedBy"] as const;
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

/** IDs for our own business processes run in their own series, apart from Microsoft's catalog numbers. */
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
  return r.state !== REQ_STATE.draft || r.coverage != null || r.moscow != null || r.category != null || r.size != null || !!r.resolution || !!r.resolvedBy || !!r.resolvedOn || !!r.owner || !!r.verbatim
    || (generated != null && r.description !== generated);
}

/** Next free activity code. */
export function nextActivityCode(list: { code: string }[]): string {
  const n = Math.max(0, ...list.map(x => Number(/^A(\d+)$/.exec(x.code)?.[1] || 0)));
  return "A" + (Math.ceil((n + 1) / 5) * 5);
}
