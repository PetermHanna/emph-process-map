// Discovery workshop: the session's rules with no Dataverse or UI, so they can be tested alone.

export const PHASES: { name: string; discuss: string; produces: string }[] = [
  { name: "Prepare", discuss: "Participants and the end-to-end process for this session", produces: "The workshop record" },
  { name: "Scope", discuss: "Which business processes are in scope", produces: "Scope decisions" },
  { name: "Walk-through", discuss: "Process by process: do you run it, who owns it, in which system today?", produces: "Owner, roles and systems to keep, migrate or retire" },
  { name: "Process flow", discuss: "The usual path and who does each activity, then the exceptions", produces: "Changes to our process flow" },
  { name: "Configuration", discuss: "The configuration decisions for this process", produces: "Answers" },
  { name: "Fit-gap", discuss: "What standard doesn't cover, and why it matters", produces: "Requirements with priority, fit or gap" },
  { name: "Summary", discuss: "The facilitator reads back decisions and open points", produces: "Agreed list with owners and dates" },
];

export interface Visit { key: string; name: string; at: string }
/** An open point for the read-back: a RAID action item (or question) of the workshop. */
export interface OpenPoint { text: string; owner: string; due: string; done?: boolean; source?: string }
/** transcriptStart: when the recording began (ISO); captured: transcript line number -> what it became ("RQ-00012", "Open point", "Flow: P300"). */
/** processIds: the process items on the agenda. Open points are RAID rows (emph_raid), not part of the session. */
export interface SessionState { processIds: string[]; current: string | null; visits: Visit[]; transcriptStart?: string | null; captured?: Record<string, string> }

export const newSession = (processIds: string[] = []): SessionState => ({ processIds, current: null, visits: [] });

export function readSession(raw: string | null | undefined): SessionState {
  try {
    const j = JSON.parse(raw || "{}");
    const arr = (v: any) => (Array.isArray(v) ? v : []);
    const obj = (v: any) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    return { processIds: arr(j.processIds), current: j.current || null, visits: arr(j.visits), transcriptStart: j.transcriptStart || null, captured: obj(j.captured) };
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

export interface SummaryRequirement { reqId: string; description: string; owner: string; mapping: string; approvedBy: string }
/** decisions: what was decided for the process, e.g. "Legacy ERP: Retire" */
export interface SummaryProcess { name: string; decisions: string[]; visited: boolean }

/** The read-back in fixed phrases, so it sounds the same each time and can be matched to a transcript. */
export function summaryLines(reqs: SummaryRequirement[], processes: SummaryProcess[], actions: OpenPoint[]): string[] {
  const out: string[] = [];
  reqs.forEach(r => {
    out.push("Requirement: " + r.description + (r.reqId ? " (" + r.reqId + ")" : "") + (r.owner ? ", owner " + r.owner : ""));
    if (r.mapping) out.push("Decision: " + r.mapping + (r.approvedBy ? ", decided by " + r.approvedBy : ""));
  });
  processes.filter(p => p.visited).forEach(p => p.decisions.forEach(d => out.push("Decision: " + p.name + ": " + d)));
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

/** A visit key is a business process id, or "processId#activityCode" while walking its flow. */
export const processKeyOf = (key: string | null | undefined) => String(key || "").split("#")[0];
export const activityCodeOf = (key: string | null | undefined) => { const k = String(key || ""); const i = k.indexOf("#"); return i < 0 ? "" : k.slice(i + 1); };

// ---------- what a transcript line says ----------
const HEDGES = ["usually", "sometimes", "maybe", "probably", "perhaps", "normally", "mostly", "not always", "kind of", "sort of", "more or less", "i think", "i guess", "it depends",
  "somehow", "or something", "someone", "somebody", "meistens", "manchmal", "eigentlich", "vielleicht", "ungefähr", "normalerweise", "irgendwie", "kommt darauf an", "jemand", "glaube ich"];
// longest first, so "it depends" is one hedge and "not always" isn't also counted as something shorter
const HEDGE_RE = new RegExp("(?<![\\p{L}])(" + HEDGES.slice().sort((a, b) => b.length - a.length).map(h => h.replace(/ /g, "\\s+")).join("|") + ")(?![\\p{L}])", "giu");
const MUST_RE = /(?<![\p{L}])(must|need to|needs to|have to|has to|required|mandatory|muss|müssen|brauchen|zwingend)(?![\p{L}])/iu;
const LICENCE_RE = /(?<![\p{L}])(licen[cs]es?|licen[cs]ed|licensing|seats?|read-only|named users?|team members|lizenz(?:en)?)(?![\p{L}])/iu;

/** Hedging words (with where they are), and whether the line states a must or need, or talks about licences. */
export function lineSignals(text: string): { hedges: string[]; spans: { start: number; end: number }[]; must: boolean; licence: boolean } {
  const spans: { start: number; end: number }[] = [], hedges: string[] = [];
  for (const m of String(text || "").matchAll(HEDGE_RE)) { spans.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }); hedges.push(m[0].toLowerCase().replace(/\s+/g, " ")); }
  return { hedges, spans, must: MUST_RE.test(text || ""), licence: LICENCE_RE.test(text || "") };
}

/**
 * What each transcript line became: a requirement number (its quoted line), "Open point" (a RAID action item's source),
 * "Comment" (a comment's source), or what the session recorded ("Flow change: Approve order", "Licence: Technician, Team Members").
 */
export function usedLines(lines: Utterance[], requirements: { reqId: string; sourceText: string }[], openItems: { source?: string }[], used: Record<string, string> = {}, comments: { source: string }[] = []): Map<number, string> {
  const out = new Map<number, string>();
  lines.forEach((u, i) => {
    const q = sourceLine(u);
    const r = requirements.find(x => x.sourceText === q);
    const label = r ? r.reqId || "Requirement" : openItems.some(a => a.source === q) ? "Open point" : comments.some(c => c.source === q) ? "Comment" : used[String(i)] || "";
    if (label) out.set(i, label);
  });
  return out;
}

// ---------- the facilitator's agenda ----------
export interface AgendaBlock {
  /** systemsToday: "Legacy ERP (Retire)"; products: the target, read up from the scenarios in scope */
  key: string; code: string; name: string; notUsed: boolean; systemsToday: string[]; products: string[]; fitGap: string;
  roles: string[]; scope: string[]; openQuestions: number; activities: { name: string; decision: boolean }[];
}
export interface AgendaItem { key: string; code: string; name: string; from: number; to: number; minutes: number; prompts: string[]; chain: string }

/** Prompts and minutes per business process, one after the other. */
export function buildAgenda(blocks: AgendaBlock[]): { items: AgendaItem[]; total: number } {
  let at = 0;
  const items = blocks.map(b => {
    const prompts: string[] = [];
    let minutes: number;
    if (b.notUsed) { prompts.push("Marked not applicable: confirm nobody does this."); minutes = 2; }
    else {
      prompts.push("Do you do this? Who does it" + (b.roles.length ? " (" + b.roles.join(", ") + ")" : "") + "?");
      prompts.push(b.systemsToday.length ? "Today in " + b.systemsToday.join(", ") + ": still right?" : "Which system or tool is used today?");
      prompts.push(b.products.length ? "After migration in " + b.products.join(", ") + ": agreed?" : "Which product runs it after migration?");
      if (b.fitGap) prompts.push("Fit-gap so far: " + b.fitGap + ". Agreed?");
      if (b.scope.length) prompts.push("In scope: " + b.scope.join("; "));
      b.activities.filter(a => a.decision).forEach(a => prompts.push("Decision “" + a.name + "”: what happens on each outcome, and who decides?"));
      if (b.openQuestions) prompts.push(b.openQuestions + " setup question" + (b.openQuestions === 1 ? "" : "s") + " to answer");
      prompts.push("What can't the standard do here, and why does it matter?");
      minutes = 5 + Math.ceil(b.activities.length * 1.5) + b.openQuestions + (b.scope.length ? 2 : 0);
    }
    const item = { key: b.key, code: b.code, name: b.name, from: at, to: at + minutes, minutes, prompts, chain: b.notUsed ? "" : b.activities.map(a => a.name).join(" → ") };
    at += minutes;
    return item;
  });
  return { items, total: at };
}

const htmlText = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** The agenda as one printable page (also saved as .doc). */
export function agendaHtml(title: string, sub: string, a: { items: AgendaItem[]; total: number }): string {
  const rows = a.items.map((x, i) => `<div class="it"><h2>${i + 1}. ${x.code ? `<span class="c">${htmlText(x.code)}</span> ` : ""}${htmlText(x.name)} <span class="t">${x.from}–${x.to} min</span></h2>`
    + `<ul>${x.prompts.map(p => `<li>${htmlText(p)}</li>`).join("")}</ul>${x.chain ? `<p class="f">Flow: ${htmlText(x.chain)}</p>` : ""}</div>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${htmlText(title)}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;color:#1E293B;margin:24px}h1{font-size:20px;margin:0}`
    + `.s{color:#64748B;margin:4px 0 16px}.it{break-inside:avoid;border-top:1px solid #E2E8F0;padding:8px 0}h2{font-size:15px;margin:0 0 4px}.c{color:#64748B;font-family:Consolas,monospace;font-size:12px}`
    + `.t{color:#0D9488;font-weight:400;font-size:13px}ul{margin:4px 0;padding-left:20px}li{margin:2px 0}.f{color:#64748B;font-size:12px;margin:4px 0 0}</style></head>`
    + `<body><h1>${htmlText(title)}</h1><div class="s">${htmlText(sub)}${sub ? " · " : ""}${a.items.length} business processes, ${a.total} min</div>${rows}</body></html>`;
}
