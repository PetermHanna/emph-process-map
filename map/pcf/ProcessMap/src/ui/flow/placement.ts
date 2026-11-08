// Flow editing by dropping steps into slots: no hand-drawn links.
// A slot is a place on a forward link (a gap between two steps, or a branch of a choice). Dropping a step into a slot
// takes it out of its old place (its predecessors are joined to its successor) and puts it on that link; the lane it is
// dropped in sets its role. A new choice gets two branches, Yes and No, that rejoin at the step after it. Branch labels,
// targets (also back to earlier steps) and order are edited in the choice's properties.
import { FlowStep, FlowLink, STEP_TYPE, CHANGE } from "./shape";

/** `stacked`: a further branch of a choice sharing its target; it is drawn in a row below the choice, so its role comes from the choice, not from the lane under the dot. */
export interface Slot { id: string; from: string; to: string; k: number; x: number; y: number; label: string; stacked: boolean }
export interface Geometry { pos: Map<string, { x: number; y: number }>; back: Set<string>; W: number; H: number; ROW: number }

/** The k-th link of `from` that points to `to` (several branches of a choice may point to the same step). */
const linkIndex = (s: FlowStep, to: string, k: number) => { let n = -1; for (let i = 0; i < s.next.length; i++) if (s.next[i].to === to && ++n === k) return i; return -1; };

/** Slots on every forward link, placed in the gap between the two steps (for a choice: in the row of its branch). */
export function slots(steps: FlowStep[], g: Geometry, moving?: string | null): Slot[] {
  const by = new Map(steps.map(s => [s.code, s]));
  const out: Slot[] = [];
  steps.forEach(a => {
    const seen = new Map<string, number>();
    a.next.forEach((l, i) => {
      const b = by.get(l.to); const k = seen.get(l.to) || 0; seen.set(l.to, k + 1);
      if (!b || g.back.has(a.code + ">" + l.to) || a.code === moving || l.to === moving) return;
      const pa = g.pos.get(a.code), pb = g.pos.get(b.code); if (!pa || !pb) return;
      const x = (pa.x + g.W + pb.x) / 2;
      // branches of a choice that share their target are stacked under the choice, in branch order
      const shared = a.type === STEP_TYPE.decision && a.next.filter(z => z.to === l.to).length > 1;
      const row = a.next.slice(0, i).filter(z => z.to === l.to).length;
      const y = shared ? pa.y + g.H / 2 + row * g.ROW : pb.y + g.H / 2;
      out.push({ id: a.code + ">" + l.to + ">" + k, from: a.code, to: l.to, k, x, y, label: l.label, stacked: shared && row > 0 });
    });
  });
  return out;
}

export interface PickRules {
  /** centre of the dragged step where it started; null for a new step from the palette */
  origin: { x: number; y: number } | null;
  /** a drop this close to a dot uses that dot */
  hitX: number; hitY: number;
  /** a step dragged less than this sideways only changes lane */
  straight: number;
  /** sideways reach when the pointer is in another lane than the dot */
  column: number;
  laneAt: (y: number) => number;
}

const closest = (list: Slot[], x: number, y: number): Slot | null => {
  let best: Slot | null = null, top = Infinity;
  for (const s of list) { const v = Math.abs(s.x - x) + Math.abs(s.y - y) * 0.45; if (v < top) { top = v; best = s; } }
  return best;
};

/**
 * The slot a drop at this point uses (flow coordinates). Only a drop that clearly aims at a place rewires the flow:
 * on or next to a dot, or (the lane sets the role) in the same column from another lane. Straight up or down only changes the lane.
 */
export function pickSlot(list: Slot[], x: number, y: number, r: PickRules): Slot | null {
  const hit = list.filter(s => Math.abs(s.x - x) <= r.hitX && Math.abs(s.y - y) <= r.hitY);
  if (hit.length) return closest(hit, x, y);
  if (r.origin && Math.abs(x - r.origin.x) < r.straight) return null;
  const lane = r.laneAt(y);
  return closest(list.filter(s => Math.abs(s.x - x) <= r.column && (!r.origin || r.laneAt(s.y) !== lane)), x, y);
}

/** Steps the flow reaches from its start (or, without a start, from the steps nothing leads to). */
function reached(steps: FlowStep[]): Set<string> {
  const by = new Map(steps.map(s => [s.code, s]));
  const starts = steps.filter(s => s.type === STEP_TYPE.start);
  const roots = starts.length ? starts : steps.filter(s => !steps.some(o => o.next.some(l => l.to === s.code)));
  const seen = new Set<string>(), stack = roots.map(s => s.code);
  while (stack.length) { const c = stack.pop()!; if (seen.has(c)) continue; seen.add(c); for (const l of by.get(c)?.next || []) if (by.has(l.to)) stack.push(l.to); }
  return seen;
}

/** Names of the steps a change would disconnect: reached from the start before, not after. */
export function cutOff(before: FlowStep[], after: FlowStep[]): string[] {
  const was = reached(before), now = reached(after);
  return after.filter(s => was.has(s.code) && !now.has(s.code)).map(s => s.name);
}

const clone = (steps: FlowStep[]) => steps.map(s => ({ ...s, next: s.next.map(l => ({ ...l })) }));

/** Steps reachable from `code` by forward links (not loops back). */
function reach(steps: FlowStep[], code: string, back: Set<string>): Set<string> {
  const by = new Map(steps.map(s => [s.code, s])), seen = new Set<string>(), stack = [code];
  while (stack.length) { const c = stack.pop()!; for (const l of by.get(c)?.next || []) if (!back.has(c + ">" + l.to) && by.has(l.to) && !seen.has(l.to)) { seen.add(l.to); stack.push(l.to); } }
  return seen;
}
/** A choice with its branches: the steps between it and the step where all branches meet again (the join). */
export function choiceBlock(steps: FlowStep[], code: string, back: Set<string>): { block: Set<string>; join: string | null } {
  const me = steps.find(s => s.code === code)!;
  const fwd = me.next.filter(l => !back.has(code + ">" + l.to) && steps.some(s => s.code === l.to)).map(l => l.to);
  if (!fwd.length) return { block: new Set([code]), join: null };
  const sets = fwd.map(t => new Set([t, ...reach(steps, t, back)]));
  const common = [...sets[0]].filter(c => sets.every(x => x.has(c)) && c !== code);
  // the join is the common step that every other common step comes after
  const join = common.find(c => common.every(o => o === c || reach(steps, c, back).has(o))) || null;
  const block = new Set<string>([code]);
  if (!join) return { block, join: null };
  const stop = new Set([join, ...reach(steps, join, back)]);
  fwd.forEach(t => { if (!stop.has(t)) { block.add(t); reach(steps, t, back).forEach(c => { if (!stop.has(c)) block.add(c); }); } });
  return { block, join };
}

/** Takes a step out of its place: links into it go on to where it went (a choice: to its first branch). Loops into it stay. */
function detach(steps: FlowStep[], code: string, back: Set<string>): void {
  const me = steps.find(s => s.code === code)!;
  const on = me.next.find(l => l.to !== code && !back.has(code + ">" + l.to))?.to || me.next[0]?.to;
  steps.forEach(p => {
    if (p.code === code) return;
    p.next = p.next.flatMap(l => {
      if (l.to !== code) return [l];
      if (back.has(p.code + ">" + code)) return [l]; // a loop back into it keeps pointing at it
      if (!on || on === p.code) return [];
      // a plain step never gets the same link twice; branches of a choice may share a target
      if (p.type !== STEP_TYPE.decision && p.next.some(z => z.to === on)) return [];
      return [{ to: on, label: l.label }];
    });
  });
  if (me.type === STEP_TYPE.decision) { if (me.next.length) me.next[0] = { ...me.next[0], to: "" }; }
  else me.next = [];
}

/** Puts a step on the slot's link: a → step → b. A choice keeps its other branches; its first branch carries the flow on. */
function insert(steps: FlowStep[], code: string, slot: Slot): boolean {
  const a = steps.find(s => s.code === slot.from), me = steps.find(s => s.code === code);
  if (!a || !me) return false;
  const i = linkIndex(a, slot.to, slot.k); if (i < 0) return false;
  a.next[i] = { to: code, label: a.next[i].label };
  if (me.type === STEP_TYPE.decision) {
    if (!me.next.length) me.next = [{ to: slot.to, label: "Yes" }, { to: slot.to, label: "No" }];
    else { me.next[0] = { ...me.next[0], to: slot.to }; me.next = me.next.filter(l => l.to); }
  } else if (me.type !== STEP_TYPE.end) me.next = [{ to: slot.to, label: "" }];
  return true;
}

export interface Placed { steps: FlowStep[]; changed: string[]; created: string | null }

/**
 * Drops a step (an existing code, or a new step of the given type) into a slot and/or a lane.
 * Returns the whole new list and the codes that changed, or null when nothing would change.
 */
export function place(steps: FlowStep[], what: { code: string } | { type: number; code: string; flowId: string; sort: number },
  lane: string, slot: Slot | null, back: Set<string>): Placed | null {
  const out = clone(steps);
  let created: string | null = null;
  if ("type" in what) {
    if (!slot) return null; // a new step needs a place in the flow
    const name = what.type === STEP_TYPE.decision ? "New choice" : what.type === STEP_TYPE.end ? "End" : "New step";
    out.push({ id: "", flowId: what.flowId, code: what.code, name, type: what.type, func: lane, phase: "", next: [], description: "", change: CHANGE.added, sort: what.sort });
    created = what.code;
  } else {
    const me = out.find(s => s.code === what.code); if (!me) return null;
    if (slot) {
      if (slot.from === me.code || slot.to === me.code) slot = null;
      else if (me.type === STEP_TYPE.start) return null; // the start stays first
    }
    if (!slot && (me.func || "") === lane) return null;
    if (slot && me.type === STEP_TYPE.decision) {
      // a choice moves together with its branches, up to the step where they meet again
      const { block, join } = choiceBlock(out, me.code, back);
      if (!join || block.has(slot.from) || block.has(slot.to)) return null;
      const a = out.find(s => s.code === slot!.from)!, i = linkIndex(a, slot.to, slot.k); if (i < 0) return null;
      out.forEach(p => { if (!block.has(p.code)) p.next = p.next.map(l => (l.to === me.code && !back.has(p.code + ">" + me.code) ? { ...l, to: join } : l)); });
      a.next[i] = { to: me.code, label: a.next[i].label };
      out.forEach(p => { if (block.has(p.code)) p.next = p.next.map(l => (l.to === join ? { ...l, to: slot!.to } : l)); });
      me.func = lane;
      slot = null;
    } else {
      if (slot) detach(out, me.code, back);
      me.func = lane;
    }
  }
  if (slot && !insert(out, created || (what as any).code, slot)) return null;
  const changed = out.filter(s => { const o = steps.find(x => x.code === s.code); return !o || o.func !== s.func || JSON.stringify(o.next) !== JSON.stringify(s.next); }).map(s => s.code);
  out.forEach(s => { if (changed.includes(s.code) && s.change === CHANGE.unchanged) s.change = CHANGE.changed; });
  return { steps: out, changed, created };
}

/** Branch editing in the properties of a choice. */
export function setBranches(st: FlowStep, next: FlowLink[]): FlowStep { return { ...st, next }; }
export function moveBranch(next: FlowLink[], i: number, d: -1 | 1): FlowLink[] {
  const j = i + d; if (j < 0 || j >= next.length) return next;
  const n = next.slice(); [n[i], n[j]] = [n[j], n[i]]; return n;
}
