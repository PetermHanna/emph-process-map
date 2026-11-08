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
export interface ActionItem { text: string; owner: string; due: string; done?: boolean; source?: string }
/** transcriptStart: when the recording began (ISO); captured: transcript line number -> what it became ("RQ-00012", "Open point", "Flow: P300"). */
export interface SessionState { processIds: string[]; current: string | null; visits: Visit[]; actions: ActionItem[]; transcriptStart?: string | null; captured?: Record<string, string> }

export const newSession = (processIds: string[] = []): SessionState => ({ processIds, current: null, visits: [], actions: [] });

export function readSession(raw: string | null | undefined): SessionState {
  try {
    const j = JSON.parse(raw || "{}");
    const arr = (v: any) => (Array.isArray(v) ? v : []);
    const obj = (v: any) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    return { processIds: arr(j.processIds), current: j.current || null, visits: arr(j.visits), actions: arr(j.actions), transcriptStart: j.transcriptStart || null, captured: obj(j.captured) };
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

// ---------- meeting transcript ----------
// Teams has no live transcript for apps, so the facilitator pastes it: a .vtt file, the Teams copy (or .docx text), or plain lines.

export interface Utterance { at: number | null; speaker: string; text: string }

const CLOCK = String.raw`\d{1,2}:\d{2}(?::\d{2})?`;
/** "0:03" = 3, "1:02:05" = 3725, "00:01:02.345" = 62.345 */
export function seconds(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.,](\d+))?$/.exec(t.trim());
  if (!m) return null;
  const frac = m[4] ? Number("0." + m[4]) : 0;
  return (m[3] != null ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2])) + frac;
}
const NOTICE = /^(.{1,80}?\s)?(started|stopped) transcription\.?$/i;
const CUE = /^((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/;
const HEADER = new RegExp(String.raw`^([^:\[\]]{1,80}?)\s+(${CLOCK})\s*$`);
const PLAIN = new RegExp(String.raw`^(?:\[(${CLOCK})\]\s*|(${CLOCK})\s+)?([^:\[\]]{1,60}?):\s+(.+)$`);
const ends = (t: string) => /[.?!]["')\]]?$/.test(t.trim());
const clean = (t: string) => t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function parseVtt(lines: string[]): Utterance[] {
  const out: (Utterance & { end: number })[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cue = CUE.exec(lines[i].trim());
    if (!cue) continue; // header, NOTE and cue-id lines
    const body: string[] = [];
    while (i + 1 < lines.length && lines[i + 1].trim() && !CUE.test(lines[i + 1].trim())) body.push(lines[++i]);
    const raw = body.join(" ");
    const v = /<v(?:\.[^ >]*)?\s+([^>]+)>/.exec(raw);
    const speaker = v ? v[1].trim() : "", text = clean(raw);
    if (!text || NOTICE.test(text)) continue;
    const at = seconds(cue[1]), end = seconds(cue[2]) ?? at ?? 0, prev = out[out.length - 1];
    if (prev && prev.speaker === speaker && at != null && at - prev.end < 4 && !ends(prev.text)) { prev.text += " " + text; prev.end = end; }
    else out.push({ at, speaker, text, end });
  }
  return out.map(({ at, speaker, text }) => ({ at, speaker, text }));
}

/** A pasted transcript as lines with a time (seconds from the start, or null), a speaker ("" when unknown) and the words. */
export function parseTranscript(raw: string): Utterance[] {
  const lines = String(raw || "").replace(/^﻿/, "").split(/\r?\n/);
  if (lines.some(l => CUE.test(l.trim()))) return parseVtt(lines);
  const out: Utterance[] = [];
  let open: Utterance | null = null; // a Teams block: "Name   0:03", then the words until a blank line or the next header
  for (const line of lines.map(l => l.trim())) {
    if (!line || NOTICE.test(line)) { open = null; continue; }
    const h = HEADER.exec(line);
    if (h) { open = { at: seconds(h[2]), speaker: h[1].trim(), text: "" }; out.push(open); continue; }
    if (open) { open.text = (open.text ? open.text + " " : "") + line; continue; }
    const p = PLAIN.exec(line);
    if (p) { out.push({ at: seconds(p[1] || p[2] || ""), speaker: p[3].trim(), text: p[4].trim() }); continue; }
    out.push({ at: null, speaker: "", text: line });
  }
  return out.filter(u => u.text && !NOTICE.test(u.text));
}

export function transcriptStats(u: Utterance[]): { lines: number; minutes: number | null; noSpeaker: number; speakers: { speaker: string; words: number }[] } {
  const times = u.map(x => x.at).filter((x): x is number => x != null);
  const words = new Map<string, number>();
  u.filter(x => x.speaker).forEach(x => words.set(x.speaker, (words.get(x.speaker) || 0) + x.text.split(/\s+/).filter(Boolean).length));
  return { lines: u.length, minutes: times.length ? Math.round(Math.max(...times) / 60) : null, noSpeaker: u.filter(x => !x.speaker).length,
    speakers: [...words].map(([speaker, w]) => ({ speaker, words: w })).sort((a, b) => b.words - a.words) };
}

export const clock = (sec: number) => { const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = String(s % 60).padStart(2, "0"); return h ? h + ":" + String(m).padStart(2, "0") + ":" + r : m + ":" + r; };
/** The line as quoted in a requirement: "[m:ss] Speaker: text". */
export const sourceLine = (u: Utterance) => (u.at != null ? "[" + clock(u.at) + "] " : "") + (u.speaker ? u.speaker + ": " : "") + u.text;

/**
 * Puts each timed line under the business process being discussed then: the last visit that began at or before
 * start + offset. Lines before the first visit go under "", lines without a time are left out. `i` is the line's number.
 */
export function linesByVisit(u: Utterance[], visits: Visit[], startIso: string | null): Record<string, (Utterance & { i: number })[]> {
  const out: Record<string, (Utterance & { i: number })[]> = {};
  const start = startIso ? new Date(startIso).getTime() : visits.length ? new Date(visits[0].at).getTime() : NaN;
  if (isNaN(start)) return out;
  const vs = visits.map(v => ({ key: v.key, t: new Date(v.at).getTime() })).sort((a, b) => a.t - b.t);
  u.forEach((x, i) => {
    if (x.at == null) return;
    const t = start + x.at * 1000;
    let key = "";
    for (const v of vs) { if (v.t <= t) key = v.key; else break; }
    (out[key] = out[key] || []).push({ ...x, i });
  });
  return out;
}

/** Words worth a second look: hedging (a variant or an exception), must and need, licences. */
export const MARKS: { kind: "hedge" | "must" | "licence"; re: RegExp }[] = [
  { kind: "hedge", re: /\b(usually|sometimes|maybe|perhaps|normally|mostly|not always|it depends|eigentlich|meistens|manchmal|normalerweise|vielleicht|kommt darauf an)\b/gi },
  { kind: "must", re: /\b(must|need to|needs to|have to|has to|required|mandatory|always|never|muss|müssen|brauchen|immer|nie)\b/gi },
  { kind: "licence", re: /\b(licen[cs]es?|licen[cs]ed|seats?|read-only|named users?|Lizenz(?:en)?)\b/gi },
];
export function marks(text: string): { start: number; end: number; kind: string }[] {
  const out: { start: number; end: number; kind: string }[] = [];
  for (const { kind, re } of MARKS) for (const m of text.matchAll(re)) out.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind });
  return out.sort((a, b) => a.start - b.start).filter((m, i, a) => !a.slice(0, i).some(x => x.end > m.start));
}
