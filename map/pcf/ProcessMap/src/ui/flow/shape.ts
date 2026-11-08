// The canvas engine works on its own step shape; these adapters translate to and from activities.
import { SHAPE, DELTA } from "../../domain/codes";
import type { Activity, FlowLink as Link } from "../../domain/types";

export type FlowLink = Link;
export interface FlowStep {
  id: string; flowId: string; code: string; name: string; type: number; func: string; phase: string; next: FlowLink[];
  description: string; change: number; sort: number; reason?: string; pos?: { x: number; y: number } | null;
}
export const STEP_TYPE = { start: SHAPE.start, task: SHAPE.activity, decision: SHAPE.decision, end: SHAPE.end, subprocess: SHAPE.subprocess };
export const CHANGE = { unchanged: DELTA.same, added: DELTA.added, changed: DELTA.changed, removed: DELTA.removed };

export const toStep = (a: Activity): FlowStep => ({
  id: a.id, flowId: a.flowId, code: a.code, name: a.name, type: a.shape, func: a.lane, phase: a.stage, next: a.links,
  description: a.summary, change: a.delta, sort: a.rank, reason: a.rationale, pos: a.pos ?? null,
});
export const toActivity = (s: FlowStep): Activity => ({
  id: s.id, flowId: s.flowId, code: s.code, name: s.name, shape: s.type, lane: s.func, stage: s.phase, links: s.next,
  summary: s.description, delta: s.change, rank: s.sort, rationale: s.reason, pos: s.pos ?? null,
});
