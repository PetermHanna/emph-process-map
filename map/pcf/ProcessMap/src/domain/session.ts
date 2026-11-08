// Discovery workshop: the session's rules with no Dataverse or UI, so they can be tested alone.
import { DISPOSITION_LABEL } from "./codes";

export const PHASES: { name: string; discuss: string; produces: string }[] = [
  { name: "Prepare", discuss: "Participants and the end-to-end process for this session", produces: "The workshop record" },
  { name: "Scope", discuss: "Which business processes are in scope", produces: "Scope decisions" },
  { name: "Walk-through", discuss: "Process by process: do you run it, who owns it, in which application?", produces: "Retain, transition, retire or gap" },
  { name: "Process flow", discuss: "The usual path and who does each activity, then the exceptions", produces: "Changes to our process flow" },
  { name: "Configuration", discuss: "The configuration decisions for this process", produces: "Answers" },
  { name: "Fit-gap", discuss: "What standard doesn't cover, and why it matters", produces: "Requirements with priority and coverage" },
  { name: "Summary", discuss: "The facilitator reads back decisions and open points", produces: "Agreed list with owners and dates" },
];

export interface Visit { key: string; name: string; at: string }
export interface ActionItem { text: string; owner: string; due: string; done?: boolean }
export interface SessionState { processIds: string[]; current: string | null; visits: Visit[]; actions: ActionItem[] }

export const newSession = (processIds: string[] = []): SessionState => ({ processIds, current: null, visits: [], actions: [] });

export function readSession(raw: string | null | undefined): SessionState {
  try {
    const j = JSON.parse(raw || "{}");
    const arr = (v: any) => (Array.isArray(v) ? v : []);
    return { processIds: arr(j.processIds), current: j.current || null, visits: arr(j.visits), actions: arr(j.actions) };
  } catch { return newSession(); }
}

/** Moving to a business process records the time; staying on the same one adds nothing. */
export function visit(state: SessionState, key: string, name: string, at: string): SessionState {
  if (state.current === key) return state;
  return { ...state, current: key, visits: state.visits.concat({ key, name, at }) };
}

/** Minutes per business process, up to the next visit or `end`. Repeated visits add up. */
export function minutesPerVisit(visits: Visit[], end: string): { key: string; name: string; minutes: number }[] {
  const out: { key: string; name: string; minutes: number }[] = [];
  visits.forEach((v, i) => {
    const until = i + 1 < visits.length ? visits[i + 1].at : end;
    const minutes = Math.max(0, Math.round((new Date(until).getTime() - new Date(v.at).getTime()) / 60000));
    const ex = out.find(x => x.key === v.key);
    if (ex) ex.minutes += minutes; else out.push({ key: v.key, name: v.name, minutes });
  });
  return out;
}

export const wasVisited = (visits: Visit[], key: string) => visits.some(v => v.key === key);

export interface SummaryRequirement { reqId: string; description: string; owner: string; resolution: string; resolvedBy: string }
export interface SummaryProcess { name: string; disposition: number | null; visited: boolean }

/** The read-back in fixed phrases, so it sounds the same each time and can be matched to a transcript. */
export function summaryLines(reqs: SummaryRequirement[], processes: SummaryProcess[], actions: ActionItem[]): string[] {
  const out: string[] = [];
  reqs.forEach(r => {
    out.push("Requirement: " + r.description + (r.reqId ? " (" + r.reqId + ")" : "") + (r.owner ? ", owner " + r.owner : ""));
    if (r.resolution) out.push("Decision: " + r.resolution + (r.resolvedBy ? ", decided by " + r.resolvedBy : ""));
  });
  processes.filter(p => p.visited && p.disposition != null).forEach(p => out.push("Decision: " + p.name + ": " + (DISPOSITION_LABEL[p.disposition as number] || "")));
  reqs.filter(r => !r.owner).forEach(r => out.push("Open point: who owns " + (r.reqId || r.description) + "?"));
  actions.filter(a => !a.done).forEach(a => out.push("Open point: " + a.text + (a.owner ? ", owner " + a.owner : "") + (a.due ? ", by " + a.due : "")));
  return out;
}
