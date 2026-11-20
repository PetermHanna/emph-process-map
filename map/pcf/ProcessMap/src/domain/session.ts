// Workshop sessions: the rules with no Dataverse or UI, so they can be tested alone. The session order, board, storyline
// review and Close are in workshop.ts; this file keeps visits, the read-back, the transcript and the facilitator's agenda.
import { RunState, readRun } from "./workshop";
import type { AiRun } from "./types";

/** EMPH's seven phases before slice 3: Prepare and Summary became steps, the five between them the tabs of a business process line (workshop.ts). */
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
/** review: each transcript line's review, by its quoted line; readBack: what the room answered to the read-back. */
export interface SessionState {
  processIds: string[]; current: string | null; visits: Visit[]; transcriptStart?: string | null; captured?: Record<string, string>; run?: RunState;
  review?: Record<string, ReviewEntry>; readBack?: ReadBackState;
  /** the logs of this workshop's AI runs, newest first (the suggestions themselves are emph_proposal rows) */
  ai?: AiRun[];
}

export const newSession = (processIds: string[] = []): SessionState => ({ processIds, current: null, visits: [] });

export function readSession(raw: string | null | undefined): SessionState {
  try {
    const j = JSON.parse(raw || "{}");
    const arr = (v: any) => (Array.isArray(v) ? v : []);
    const obj = (v: any) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    const run = readRun(j.run);
    return { processIds: arr(j.processIds), current: j.current || null, visits: arr(j.visits), transcriptStart: j.transcriptStart || null, captured: obj(j.captured), ...(run ? { run } : {}),
      ...(Object.keys(obj(j.review)).length ? { review: obj(j.review) } : {}), ...(Object.keys(obj(j.readBack)).length ? { readBack: obj(j.readBack) } : {}),
      ...(arr(j.ai).length ? { ai: arr(j.ai).filter((x: any) => x && typeof x.run === "string") } : {}) };
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

/** id: the requirement's row, so its read-back line keeps its key when the list is reordered; said: who said it; where: the business process. */
export interface SummaryRequirement { id?: string; reqId: string; description: string; owner: string; mapping: string; approvedBy: string; said?: string; where?: string }
/** decisions: what was decided for the process, e.g. "Legacy ERP: Retire" */
export interface SummaryProcess { id?: string; name: string; decisions: string[]; visited: boolean }

/** One line of the read-back (Business Map U3). `key` stays the same when the list is reordered, so the room's answer stays on it. */
export interface ReadBackItem { key: string; kind: "Requirement" | "Decision" | "Licence" | "Open point"; text: string; meta: string; owner?: string; due?: string }

/** Licences and flow changes taken from the transcript, from the session's used list: quoted line -> what it became. */
export function transcriptDecisions(used: Record<string, string> | undefined): { line: string; what: string }[] {
  return Object.entries(used || {}).filter(([line, v]) => /^(Licence|Flow change):/.test(v) && !/^\d+$/.test(line)).map(([line, what]) => ({ line, what }));
}

/** The read-back in fixed phrases, so it sounds the same each time and can be matched to a transcript; each line with a stable key. */
export function readBackItems(reqs: SummaryRequirement[], processes: SummaryProcess[], actions: OpenPoint[], fromTranscript: { line: string; what: string }[] = []): ReadBackItem[] {
  const out: ReadBackItem[] = [];
  const rk = (r: SummaryRequirement) => r.id || r.reqId || r.description;
  reqs.forEach(r => {
    out.push({ key: "req:" + rk(r), kind: "Requirement", text: "Requirement: " + r.description + (r.reqId ? " (" + r.reqId + ")" : "") + (r.owner ? ", owner " + r.owner : ""),
      meta: [r.reqId, r.said && "said by " + r.said, r.where].filter(Boolean).join(" · ") });
    if (r.mapping) out.push({ key: "dec:" + rk(r), kind: "Decision", text: "Decision: " + r.mapping + (r.approvedBy ? ", decided by " + r.approvedBy : ""), meta: r.reqId ? "On " + r.reqId : "" });
  });
  processes.filter(p => p.visited).forEach(p => p.decisions.forEach(d => out.push({ key: "proc:" + (p.id || p.name) + ":" + d.split(":")[0], kind: "Decision", text: "Decision: " + p.name + ": " + d, meta: "Business process" })));
  fromTranscript.forEach(x => out.push({ key: "line:" + x.line, kind: x.what.startsWith("Licence") ? "Licence" : "Decision", text: x.what.startsWith("Licence") ? x.what : "Decision: " + x.what, meta: "From the transcript: " + x.line }));
  reqs.filter(r => !r.owner).forEach(r => out.push({ key: "owner:" + rk(r), kind: "Open point", text: "Open point: who owns " + (r.reqId || r.description) + "?", meta: "Nobody owns it yet" }));
  actions.filter(a => !a.done).forEach(a => out.push({ key: "open:" + (a.source || a.text), kind: "Open point", text: "Open point: " + a.text + (a.owner ? ", owner " + a.owner : "") + (a.due ? ", by " + a.due : ""),
    meta: a.owner ? "Owner " + a.owner + (a.due ? ", by " + a.due : "") : "No owner yet", owner: a.owner, due: a.due }));
  return out;
}
export const summaryLines = (reqs: SummaryRequirement[], processes: SummaryProcess[], actions: OpenPoint[], fromTranscript: { line: string; what: string }[] = []): string[] =>
  readBackItems(reqs, processes, actions, fromTranscript).map(x => x.text);

/** What the room answered to one read-back line. */
export type ReadBackMark = "confirmed" | "changed" | "open";
export const READBACK_MARKS: [ReadBackMark, string][] = [["confirmed", "Confirmed"], ["changed", "Changed"], ["open", "Open"]];
/** The read-back's record on the session: answers by line key, and who confirmed for the organisation. */
export interface ReadBackState { marks?: Record<string, { mark: ReadBackMark; note?: string }>; confirmedBy?: string }

/** Sets a line's answer; picking the same answer again clears it. A note is kept only on Changed. */
export function markLine(state: SessionState, key: string, mark: ReadBackMark, note?: string): SessionState {
  const rb = state.readBack || {};
  const marks = { ...(rb.marks || {}) };
  const was = marks[key];
  if (was && was.mark === mark && note === undefined) delete marks[key];
  else marks[key] = mark === "changed" ? { mark, note: note ?? (was?.mark === "changed" ? was.note : "") ?? "" } : { mark };
  return { ...state, readBack: { ...rb, marks } };
}

/** Confirmed, changed in the room, still open, not read back yet. Marks on lines no longer on the list don't count. */
export function readBackCounts(items: ReadBackItem[], rb: ReadBackState | undefined): { confirmed: number; changed: number; open: number; left: number } {
  const marks = rb?.marks || {};
  const n = (m: ReadBackMark) => items.filter(i => marks[i.key]?.mark === m).length;
  return { confirmed: n("confirmed"), changed: n("changed"), open: n("open"), left: items.filter(i => !marks[i.key]).length };
}

/** What is missing before the workshop is closed. Empty: it can close as it is. These warn; they don't stop Close. */
export function readBackChecks(items: ReadBackItem[], rb: ReadBackState | undefined, actions: OpenPoint[], transcriptTodo: number): string[] {
  const out: string[] = [];
  const c = readBackCounts(items, rb);
  const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);
  if (c.left) out.push(plural(c.left, "read-back line is not answered yet", "read-back lines are not answered yet"));
  const noOwner = actions.filter(a => !a.done && !String(a.owner || "").trim()).length;
  if (noOwner) out.push(plural(noOwner, "action item has no owner", "action items have no owner"));
  if (!String(rb?.confirmedBy || "").trim()) out.push("nobody is named as confirming for the organisation");
  if (transcriptTodo > 0) out.push(plural(transcriptTodo, "transcript line is still to review", "transcript lines are still to review"));
  return out;
}

/** The summary for the organisation: the same lines and answers as on screen, grouped by answer. */
export function readBackSummary(items: ReadBackItem[], rb: ReadBackState | undefined) {
  const marks = rb?.marks || {};
  const pick = (m: ReadBackMark) => items.filter(i => marks[i.key]?.mark === m);
  return { confirmed: pick("confirmed"), changed: pick("changed").map(i => ({ ...i, note: marks[i.key]?.note || "" })), open: pick("open"),
    notReadBack: items.filter(i => !marks[i.key]), confirmedBy: String(rb?.confirmedBy || "").trim() };
}

/** The summary as one HTML page, for Word or printing to PDF. */
export function readBackHtml(title: string, facts: [string, string][], sum: ReturnType<typeof readBackSummary>): string {
  const item = (i: ReadBackItem, extra = "") => `<li>${htmlText(i.text.replace(/^(Requirement|Decision|Open point): /, ""))}<span class="k"> (${htmlText(i.kind)})</span>${extra}</li>`;
  const section = (head: string, list: string) => `<h2>${htmlText(head)}</h2>` + (list ? `<ul>${list}</ul>` : `<p class="m">None.</p>`);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${htmlText(title)}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5pt;color:#1E293B}h1{font-size:18pt}h2{font-size:12pt;margin:14pt 0 2pt}.k,.m{color:#64748B}ul{margin:2pt 0 4pt 18pt}</style></head><body><h1>${htmlText(title)}</h1>`
    + facts.map(([k, v]) => `<p><b>${htmlText(k)}:</b> ${htmlText(v)}</p>`).join("")
    + section("Confirmed", sum.confirmed.map(i => item(i)).join(""))
    + section("Changed in the room", sum.changed.map(i => item(i, i.note ? `<br>What changed: ${htmlText(i.note)}` : "")).join(""))
    + section("Still open", sum.open.map(i => item(i, i.kind === "Open point" && i.meta ? `<br>${htmlText(i.meta)}` : "")).join(""))
    + (sum.notReadBack.length ? section("Not read back yet", sum.notReadBack.map(i => item(i)).join("")) : "")
    + `<p><b>Confirmed for the organisation by:</b> ${sum.confirmedBy ? htmlText(sum.confirmedBy) : "nobody named"}</p></body></html>`;
}

// ---------- the meeting request and the prep pack (Business Map N7) ----------
/** The e-mail addresses found in free text (the participants field), once each, in lower case. */
export const emailsIn = (text: string): string[] => Array.from(new Set((String(text || "").match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).map(x => x.toLowerCase())));
/** "Harbourview Properties process workshop: Project to profit" */
export const meetingSubject = (organisation: string, what: string[]) => (organisation ? organisation + " " : "") + "process workshop" + (what.length ? ": " + what.join(", ") : "");
/** The meeting's length: the agenda's minutes rounded up to a quarter hour, at least 30. */
export const meetingMinutes = (agendaMinutes: number) => Math.max(30, Math.ceil((agendaMinutes || 0) / 15) * 15);
/** The agenda as plain lines for the meeting body: one line each, with minutes where the agenda has them. */
export function agendaText(lines: { text: string; minutes?: number }[]): string {
  let at = 0;
  const total = lines.reduce((n, x) => n + (x.minutes || 0), 0);
  return lines.map((x, i) => { const from = at; at += x.minutes || 0; return (i + 1) + ". " + x.text + (x.minutes ? " (" + from + "-" + at + " min)" : ""); }).join("\n")
    + "\n\n" + (total ? "Planned time: " + total + " minutes. " : "") + "The prep pack is attached.";
}
/** Teams' scheduling link (teams.microsoft.com/l/meeting/new) with these fields filled. The body is cut to 1,500 characters so the link stays short enough. */
export function teamsMeetingLink(m: { subject: string; start: Date; minutes: number; attendees: string[]; content: string }): string {
  const end = new Date(m.start.getTime() + Math.max(15, m.minutes) * 60000);
  const body = m.content.length > 1500 ? m.content.slice(0, 1497) + "..." : m.content;
  const q: [string, string][] = [["subject", m.subject], ["startTime", m.start.toISOString()], ["endTime", end.toISOString()], ["content", body], ["attendees", m.attendees.join(",")]];
  return "https://teams.microsoft.com/l/meeting/new?" + q.filter(([, v]) => !!v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
}
/** One part of the prep pack: who should come, the systems to have at hand, questions to think about, the flow to look at. */
export interface PrepSection { title: string; who: string[]; systems: string[]; target: string[]; questions: string[]; flow: string }
/** The prep pack for the organisation, as one HTML page saved as .doc to attach to the meeting. */
export function prepPackHtml(title: string, facts: [string, string][], sections: PrepSection[]): string {
  const rows = sections.map((x, i) => `<h2>${i + 1}. ${htmlText(x.title)}</h2>`
    + `<p class="m"><b>Who should come:</b> ${x.who.length ? x.who.map(htmlText).join(", ") : "the people who do this work"}</p>`
    + (x.systems.length || x.target.length ? `<p class="m"><b>Systems to have at hand:</b> ${htmlText([x.systems.length && "today: " + x.systems.join(", "), x.target.length && "after: " + x.target.join(", ")].filter(Boolean).join("; "))}. Bring a typical example (a document, a screen, a report).</p>`
      : `<p class="m"><b>Systems:</b> which system or tool do you use for this today?</p>`)
    + (x.questions.length ? `<p class="m"><b>Questions to think about before the meeting:</b></p><ul>${x.questions.map(q => `<li>${htmlText(q)}</li>`).join("")}</ul>` : "")
    + (x.flow ? `<p class="m"><b>Flow to look at:</b> ${htmlText(x.flow)}</p>` : "")
    + `<p class="m">What can't your current way of working do here, and why does it matter?</p>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${htmlText(title)}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5pt;color:#1E293B}h1{font-size:18pt}h2{font-size:12pt;margin:14pt 0 2pt}.m{margin:2pt 0}ul{margin:2pt 0 4pt 18pt}</style></head><body>`
    + `<h1>${htmlText(title)}</h1>${facts.map(([k, v]) => `<p><b>${htmlText(k)}:</b> ${htmlText(v)}</p>`).join("")}<p>Please read this before the workshop. Each section is one part of the agenda. You don't need to answer in writing: we go through it together.</p>${rows}</body></html>`;
}

// ---------- meeting transcript ----------
// Teams has no live transcript for apps, so the facilitator pastes it. The shapes Teams gives (Business Map U1, a to f):
// a "Name   0:03" then the words; b WebVTT (.vtt) with <v Name>; c "Name" on one line and "0:03" on the next;
// d the .docx download: "0:0:0.0 --> 0:0:5.120", the name on its own line, then the words;
// e a date and clock time after the name ("11.11.2026 09:03", "11/11/2026 9:03 AM"): times count from the first line;
// f times over an hour, colons in speech, and "Note: ..." on a line of its own, which stays in the turn. Plain lines too.

/** `turn`: for a sentence cut from a longer turn, the whole turn as it was quoted before turns were cut into sentences. */
export interface Utterance { at: number | null; speaker: string; text: string; turn?: string }

/** "0:03" = 3, "1:02:05" = 3725, "00:01:02.345" = 62.345, "0:0:5.120" = 5.12 */
export function seconds(t: string): number | null {
  const m = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:[.,](\d+))?$/.exec(String(t || "").trim());
  if (!m) return null;
  const frac = m[4] ? Number("0." + m[4]) : 0;
  return (m[3] != null ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2])) + frac;
}
const NOTICE = /^(.{1,80}?\s)?(started|stopped) transcription\.?$/i;
const TIME = String.raw`(?:\d{1,2}:)?\d{1,2}:\d{1,2}(?:[.,]\d+)?`;
const CUE = new RegExp(String.raw`^(${TIME})\s*-->\s*(${TIME})`);
/** A date before a clock time, as Teams writes it in some languages: "11.11.2026 09:03", "11/11/2026 9:03 AM", "2026-11-11 09:03:15". */
const DATE = String.raw`(\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}),?`;
const AMPM = String.raw`([AaPp]\.?[Mm]\.?)`;
const WALL = String.raw`(\d{1,2}:\d{2}(?::\d{2})?)`;
/** A stamp: a wall clock with a date or AM/PM, or an offset. Six groups: date, clock, ampm, clock, ampm, offset. */
const STAMP = String.raw`(?:${DATE}\s+${WALL}(?:\s*${AMPM})?|${WALL}\s*${AMPM}|(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?))`;
const HEADER = new RegExp(String.raw`^(.+?)\s+${STAMP}$`);
const BARE = new RegExp(String.raw`^${STAMP}$`);
const PLAIN = new RegExp(String.raw`^(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*|(\d{1,2}:\d{2}(?::\d{2})?)\s+)([^:\[\]]{1,60}?):\s+(.+)$`);
const NAMED = /^([^:\[\]]{1,60}?):\s+(.+)$/;
const ends = (t: string) => /[.?!]["')\]]?$/.test(t.trim());
const clean = (t: string) => t.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Seconds from a stamp's six groups, and whether it was a wall clock. */
function stampSeconds(g: (string | undefined)[]): { at: number; wall: boolean } {
  const [date, clk, ap, clk2, ap2, off] = g;
  if (off) return { at: seconds(off) ?? 0, wall: false };
  const p = (clk || clk2 || "0:00").split(":").map(Number), ampm = (ap || ap2 || "").toLowerCase().replace(/\./g, "");
  let h = p[0] % 24;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  let day = 0;
  if (date) {
    const d = date.split(/[./-]/).map(Number);
    // 2026-11-11; 11.11.2026 is day first; 11/11/2026 is month first unless the first part can't be a month
    const [y, mo, dd] = date.includes("-") ? [d[0], d[1], d[2]] : date.includes(".") || d[0] > 12 ? [d[2], d[1], d[0]] : [d[2], d[0], d[1]];
    day = Date.UTC(y < 100 ? 2000 + y : y, mo - 1, dd) / 86400000;
  }
  return { at: day * 86400 + h * 3600 + p[1] * 60 + (p[2] || 0), wall: true };
}

/** Words before a colon that start a note, not a speaker: "Note: retention is five percent". */
const NOT_NAMES = new Set(["note", "notes", "hinweis", "notiz", "example", "beispiel", "agenda", "action", "todo", "decision", "entscheidung", "question", "frage", "answer", "antwort",
  "requirement", "anforderung", "step", "schritt", "option", "problem", "point", "punkt", "topic", "thema", "summary", "zusammenfassung", "important", "wichtig", "result", "ergebnis",
  "also", "and", "but", "so", "und", "aber", "yes", "no", "ja", "nein", "ok", "okay", "update", "status", "goal", "ziel", "risk", "risiko", "tip", "warning", "info", "fyi", "ps", "re",
  "subject", "betreff", "time", "zeit", "date", "datum", "type", "types", "typ", "transcript", "webvtt"]);
/** Could this be a person's name: short, starts with a letter, no digits, no sentence punctuation at the end. */
const looksLikeName = (s: string) => s.length <= 60 && /^\p{L}/u.test(s) && !/[.?!,;:]$/.test(s) && !/\d/.test(s) && s.split(/\s+/).length <= 5 && !NOT_NAMES.has(s.toLowerCase());

/** WebVTT and the .docx download: a cue runs to the next cue; one speaker's cues that follow on are joined. */
function parseCues(lines: string[]): Utterance[] {
  const out: (Utterance & { end: number })[] = [];
  const cueNo = (i: number) => /^\d+$/.test(lines[i]) && lines.slice(i + 1).find(Boolean) !== undefined && CUE.test(lines.slice(i + 1).find(Boolean) || "");
  const skip = (l: string, i: number) => !l || l === "WEBVTT" || /^NOTE\b/.test(l) || /^[0-9a-f-]{8,}(\/\d+-\d+)?$/i.test(l) || cueNo(i);
  for (let i = 0; i < lines.length; i++) {
    const cue = CUE.exec(lines[i]);
    if (!cue) continue; // header, NOTE and cue-id lines
    const body: string[] = [];
    while (i + 1 < lines.length && !CUE.test(lines[i + 1])) { i++; if (!skip(lines[i], i)) body.push(lines[i]); }
    const raw = body.join(" ");
    const v = /<v(?:\.[^ >]*)?\s+([^>]+)>/.exec(raw);
    const n = body.length ? NAMED.exec(body[0]) : null;
    let speaker = "", text = clean(raw);
    if (v) speaker = v[1].trim();
    else if (body.length >= 2 && looksLikeName(body[0])) { speaker = body[0]; text = clean(body.slice(1).join(" ")); }
    else if (n && looksLikeName(n[1].trim())) { speaker = n[1].trim(); text = clean([n[2]].concat(body.slice(1)).join(" ")); }
    if (!text || NOTICE.test(text)) continue;
    const at = seconds(cue[1]), end = seconds(cue[2]) ?? at ?? 0, prev = out[out.length - 1];
    if (prev && prev.speaker === speaker && at != null && at - prev.end < 4 && !ends(prev.text)) { prev.text += " " + text; prev.end = end; }
    else out.push({ at, speaker, text, end });
  }
  return out.map(({ at, speaker, text }) => ({ at, speaker, text }));
}

/** A pasted transcript as turns with a time (seconds from the start, or null), a speaker ("" when unknown) and the words. */
export function parseTranscript(raw: string): Utterance[] {
  const lines = String(raw || "").replace(/^﻿/, "").replace(/[   ]/g, " ").split(/\r?\n/).map(l => l.trim());
  if (lines.some(l => CUE.test(l))) return parseCues(lines);
  const out: Utterance[] = [], wall: boolean[] = [], speakers = new Set<string>();
  let open: Utterance | null = null; // a timed turn: its words follow until a blank line or the next turn
  let timed = false; // once names come with times, "Word: text" starts a turn only for someone already heard
  const push = (u: Utterance, isWall = false) => { out.push(u); wall.push(isWall); if (u.speaker) speakers.add(u.speaker); };
  const headerAt = (l: string) => { const h = HEADER.exec(l); return h && looksLikeName(h[1].trim()) ? { speaker: h[1].trim(), ...stampSeconds(h.slice(2, 8)) } : null; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) { open = null; continue; }
    if (NOTICE.test(line)) { open = null; continue; }
    const p = PLAIN.exec(line);
    if (p) { open = null; push({ at: seconds(p[1] || p[2]), speaker: p[3].trim(), text: p[4].trim() }); continue; }
    const h = headerAt(line);
    // inside a turn, "We need it by 9:30 AM" is speech: a header there needs a known speaker or the wide gap Teams puts before the time
    if (h && (!open || !open.text || speakers.has(h.speaker) || /\s{2,}\S+(\s*[AaPp]\.?[Mm]\.?)?$/.test(line))) { timed = true; open = { at: h.at, speaker: h.speaker, text: "" }; push(open, h.wall); continue; }
    const b = i + 1 < lines.length && looksLikeName(line) ? BARE.exec(lines[i + 1]) : null;
    if (b) { const s = stampSeconds(b.slice(1, 7)); timed = true; open = { at: s.at, speaker: line, text: "" }; push(open, s.wall); i++; continue; }
    if (open) { open.text = (open.text ? open.text + " " : "") + line; continue; }
    const n = NAMED.exec(line);
    if (n && (speakers.has(n[1].trim()) || (!timed && looksLikeName(n[1].trim())))) { push({ at: null, speaker: n[1].trim(), text: n[2].trim() }); continue; }
    const last = out[out.length - 1];
    // after a blank line in a timed transcript the words still belong to the last turn ("Note: ..."); untimed, a line of its own
    if (timed && last) last.text += " " + line; else push({ at: null, speaker: "", text: line });
  }
  // wall-clock times count from the first one
  const k0 = wall.indexOf(true);
  if (k0 >= 0) { const t0 = out[k0].at as number; out.forEach((x, k) => { if (wall[k] && x.at != null) x.at = Math.max(0, x.at - t0); }); }
  return out.map(u => ({ ...u, text: u.text.replace(/\s+/g, " ").trim() })).filter(u => u.text && !NOTICE.test(u.text));
}

/** Short words with a full stop that don't end a sentence, in English and German. */
const ABBREV = new Set(["z.b", "e.g", "i.e", "d.h", "u.a", "o.ä", "u.u", "s.o", "nr", "no", "bzw", "ca", "usw", "etc", "dr", "mr", "mrs", "ms", "prof", "vs", "inkl", "incl", "ggf", "ggfs", "evtl",
  "bspw", "st", "hr", "fr", "abs", "art", "kap", "fig", "approx", "resp", "sog", "vgl", "cf", "max", "min", "zzgl", "abt", "gem", "lt", "tel", "str", "jan", "feb", "mar", "apr", "jun", "jul",
  "aug", "sep", "sept", "oct", "okt", "nov", "dec", "dez"]);
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Cuts a turn into sentences. Abbreviations, decimals, initials and "3. Mai" don't end one; a one-word sentence ("Okay.") stays with the next. */
export function splitSentences(text: string): string[] {
  const cut: string[] = [];
  let from = 0, m: RegExpExecArray | null;
  const re = /[.?!]+["'”’)]*\s+(?=["'“„(]?[\p{Lu}\d])/gu;
  while ((m = re.exec(text))) {
    if (m[0][0] === ".") {
      const w = ((/(\S+)$/.exec(text.slice(0, m.index)) || ["", ""])[1]).replace(/^["'(“„]+/, "").toLowerCase();
      if (ABBREV.has(w) || /^\p{L}$/u.test(w) || /^\d{1,2}$/.test(w) || /^(\p{L}\.)+\p{L}$/u.test(w)) continue;
    }
    cut.push(text.slice(from, m.index + m[0].trimEnd().length).trim());
    from = m.index + m[0].length;
  }
  cut.push(text.slice(from).trim());
  const out: string[] = [];
  let held = "";
  cut.filter(Boolean).forEach(s => { const t = held ? held + " " + s : s; held = ""; if (wordCount(t) === 1) held = t; else out.push(t); });
  if (held) { if (out.length) out[out.length - 1] += " " + held; else out.push(held); }
  return out;
}

/** Each turn cut into its sentences, so one sentence can be kept on its own. A sentence keeps the turn's time and speaker, and the whole turn in `turn`. */
export function transcriptLines(turns: Utterance[]): Utterance[] {
  return turns.flatMap(u => {
    const ss = splitSentences(u.text);
    if (ss.length < 2) return [u];
    const turn = sourceLine(u);
    return ss.map(text => ({ at: u.at, speaker: u.speaker, text, turn }));
  });
}

/** What to warn about before a pasted transcript is kept: lines with no speaker or no time, or a long paste read as one line. */
export function pasteWarnings(raw: string, turns: Utterance[]): string[] {
  const out: string[] = [];
  const filled = String(raw || "").split(/\r?\n/).filter(l => l.trim()).length;
  if (turns.length === 1 && (filled > 4 || String(raw || "").length > 400)) out.push("Only one line was read from a long paste. The format was probably not recognised, so speakers and times are missing.");
  const noSpeaker = turns.filter(x => !x.speaker).length, noTime = turns.filter(x => x.at == null).length;
  if (turns.length && noSpeaker) out.push(noSpeaker + " of " + turns.length + " lines have no speaker.");
  if (turns.length && noTime) out.push(noTime + " of " + turns.length + " lines have no time, so they can't be placed on the agenda.");
  return out;
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
const MUST_RE = /(?<![\p{L}])(must|need|needs|need to|needs to|have to|has to|required|mandatory|muss|müssen|brauchen|benötigen|nötig|notwendig|erforderlich|zwingend)(?![\p{L}])/giu;
const NEGATORS = new Set(["not", "don't", "dont", "doesn't", "doesnt", "didn't", "won't", "isn't", "aren't", "shouldn't", "needn't", "never", "no", "nobody", "none", "nothing", "without",
  "nicht", "kein", "keine", "keinen", "keiner", "keines", "keinem", "niemand", "nie", "ohne"]);
/** A must that isn't negated ("do not need", "no need", "muss nicht", "kein Export nötig"). Only words in the same clause count. */
function hasMust(text: string): boolean {
  const t = String(text || "").toLowerCase().replace(/[’`]/g, "'");
  for (const m of Array.from(t.matchAll(MUST_RE))) {
    const before = t.slice(0, m.index).split(/[,;.:!?]/).pop()!.split(/\s+/).filter(Boolean).slice(-3);
    const after = t.slice((m.index || 0) + m[0].length).split(/[,;.:!?]/)[0].split(/\s+/).filter(Boolean).slice(0, 2);
    const negated = before.some(w => NEGATORS.has(w)) || (after[0] === "not" || after[0] === "no") || after.some(w => w === "nicht" || /^kein/.test(w));
    if (!negated) return true;
  }
  return false;
}
const LICENCE_RE = /(?<![\p{L}])(licen[cs]es?|licen[cs]ed|licensing|seats?|read-only|named users?|team members|lizenz(?:en)?)(?![\p{L}])/iu;

/** Hedging words (with where they are), and whether the line states a must or need that isn't negated, or talks about licences. */
export function lineSignals(text: string): { hedges: string[]; spans: { start: number; end: number }[]; must: boolean; licence: boolean } {
  const spans: { start: number; end: number }[] = [], hedges: string[] = [];
  for (const m of String(text || "").matchAll(HEDGE_RE)) { spans.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }); hedges.push(m[0].toLowerCase().replace(/\s+/g, " ")); }
  return { hedges, spans, must: hasMust(text), licence: LICENCE_RE.test(text || "") };
}

/**
 * What each transcript line became: a requirement number (its quoted line), "Open point" (a RAID action item's source),
 * "Comment" (a comment's source), or what the session recorded ("Flow change: Approve order", "Licence: Technician, Team Members"),
 * kept by the quoted line (or by the line's number, as sessions did before). A sentence cut from a longer turn also counts
 * what its whole turn became, so a capture made before turns were cut into sentences shows on each of them.
 */
export function usedLines(lines: Utterance[], requirements: { reqId: string; sourceText: string }[], openItems: { source?: string }[], used: Record<string, string> = {}, comments: { source: string }[] = []): Map<number, string> {
  const out = new Map<number, string>();
  const of = (q: string) => { const r = requirements.find(x => x.sourceText === q); return r ? r.reqId || "Requirement" : openItems.some(a => a.source === q) ? "Open point" : comments.some(c => c.source === q) ? "Comment" : used[q] || ""; };
  lines.forEach((u, i) => {
    const label = of(sourceLine(u)) || used[String(i)] || (u.turn ? of(u.turn) : "");
    if (label) out.set(i, label);
  });
  return out;
}

// ---------- reviewing each transcript line (Business Map U2, F4) ----------
/** What a transcript line can be kept as. A business rule is a requirement of type Business rule. */
export type ReviewType = "req" | "rule" | "comment" | "open" | "flow" | "licence";
export const REVIEW_TYPES: Record<ReviewType, string> = { req: "Requirement", rule: "Business rule", comment: "Comment", open: "Open point", flow: "Flow change", licence: "Licence" };
/** One line's review, kept on the session by its quoted line. No status: still to do (the facilitator may have picked a type or edited the words). */
export interface ReviewEntry { status?: "accepted" | "rejected"; type?: ReviewType; text?: string }
export interface LineReview { status: "todo" | "accepted" | "rejected"; type: ReviewType; /** used before reviews were kept (a capture, an open point, the used list) */ legacy: boolean }

const OPEN_WORDS = /\b(still open|to clarify|clarify|not decided|who decides|unclear|noch offen|klären)\b/i;
const FLOW_WORDS = /\b(step|steps|straight to|directly|skip|skips|skipped|no separate|schritt|direkt)\b/i;
const RULE_ALWAYS = /\b(unless|only then|only if|only when|only after|until|follows? the [\w ]*(plan|contract|rule|policy)|percent|außer wenn|erst dann|nur wenn)\b|%/i;
const RULE_LIMIT = /\b(above|below|over|under|more than|less than|at least|at most|up to|über|unter|ab)\b/i;
const NUMBER = /\d|\b(hundred|thousand|million|tausend|ten|twenty|fifty|five|three|two|zehn|fünf|fünfzig)\b/i;
const PAIN = /\b(on paper|typed in|type them in|by hand|manually|excel|should go away|auf papier|von hand|händisch)\b/i;

/**
 * What a line should most likely be kept as. The facilitator's own lines are comments (they ask the room).
 * Order: licence; open point (a question, vague words, "still open"); flow change; business rule (a limit with a number,
 * "unless", "only then"); requirement (a must, a pain today); anything else is a comment.
 */
export function suggestType(text: string, opts: { facilitator?: boolean } = {}): ReviewType {
  if (opts.facilitator) return "comment";
  const sig = lineSignals(text);
  if (sig.licence) return "licence";
  if (/\?["'”)]*\s*$/.test(String(text || "").trim()) || sig.hedges.length || OPEN_WORDS.test(text)) return "open";
  if (FLOW_WORDS.test(text) && !sig.must) return "flow";
  if (RULE_ALWAYS.test(text) || (RULE_LIMIT.test(text) && NUMBER.test(text))) return "rule";
  if (sig.must || PAIN.test(text)) return "req";
  return "comment";
}

/** Is this the workshop's facilitator speaking? By name; the first name alone counts too. */
export function isFacilitator(speaker: string, facilitator: string | null | undefined): boolean {
  const a = String(speaker || "").trim().toLowerCase(), f = String(facilitator || "").trim().toLowerCase();
  if (!a || !f) return false;
  return a === f || a.split(/\s+/)[0] === f || f.split(/\s+/)[0] === a || a.startsWith(f + " ") || f.startsWith(a + " ");
}

/** The type of something a line became before reviews were kept, from its badge. */
export function usedType(label: string): ReviewType | null {
  if (/^RQ-|^Requirement$/.test(label)) return "req";
  if (label === "Comment") return "comment";
  if (label === "Open point") return "open";
  if (/^Flow change/.test(label)) return "flow";
  if (/^Licence/.test(label)) return "licence";
  return null;
}

/** Where a line stands: its own review first, else what it was already used for (counts as accepted), else to do with the suggested type. */
export function reviewOf(text: string, entry: ReviewEntry | undefined, used: string, facilitator = false): LineReview {
  if (entry?.status) return { status: entry.status, type: entry.type || usedType(used) || suggestType(text, { facilitator }), legacy: false };
  const u = usedType(used);
  if (u) return { status: "accepted", type: u, legacy: true };
  return { status: "todo", type: entry?.type || suggestType(text, { facilitator }), legacy: false };
}

/**
 * Can a handled line go back on the list? Not relevant: while the workshop is open. An accepted requirement, comment or
 * open point: its record is removed, so only while the workshop is open and, for a requirement, not once a sign-off holds it.
 * A flow change or a licence was saved on the flow or the role and stays.
 */
export function undoRule(r: LineReview, ctx: { closed: boolean; /** the requirement is approved (Business approval state) */ signedOff: boolean }): { can: boolean; reason: string } {
  if (r.status === "todo") return { can: false, reason: "" };
  if (ctx.closed) return { can: false, reason: "The workshop is closed." };
  if (r.status === "rejected") return { can: true, reason: "" };
  if (r.type === "flow") return { can: false, reason: "A flow change can't be undone here: change it in the flow." };
  if (r.type === "licence") return { can: false, reason: "A licence can't be undone here: change it on the role in Settings." };
  if (r.legacy) return { can: false, reason: "Kept before line reviews: change it where it was saved." };
  if ((r.type === "req" || r.type === "rule") && ctx.signedOff) return { can: false, reason: "This requirement is approved, so it stays: change it on the Requirements page." };
  return { can: true, reason: "" };
}

/** How far the review is: handled lines, accepted and not relevant, and accepted lines per type. */
export function reviewCounts(rs: LineReview[]): { total: number; handled: number; accepted: number; rejected: number; todo: number; byType: Record<ReviewType, number> } {
  const byType = { req: 0, rule: 0, comment: 0, open: 0, flow: 0, licence: 0 } as Record<ReviewType, number>;
  let accepted = 0, rejected = 0;
  rs.forEach(r => { if (r.status === "accepted") { accepted++; byType[r.type]++; } else if (r.status === "rejected") rejected++; });
  return { total: rs.length, handled: accepted + rejected, accepted, rejected, todo: rs.length - accepted - rejected, byType };
}

/** The session with one line's review set (by its quoted line), or removed when the entry is empty. */
export function withReview(state: SessionState, line: string, entry: ReviewEntry | null): SessionState {
  const all = { ...(state.review || {}) };
  const keep = !!entry && Object.values(entry).some(v => v != null && v !== "");
  if (keep) all[line] = entry!; else delete all[line];
  return { ...state, review: all };
}

/** The lines a review list shows: those in scope (this business process's, or all), then the To do filter; To do counts the same scoped lines. */
export function reviewView<T extends { r: { status: LineReview["status"] } }>(items: T[], inScope: (i: T) => boolean, filter: "todo" | "all"): { scoped: T[]; shown: T[]; todo: number } {
  const scoped = items.filter(inScope);
  const todo = scoped.filter(i => i.r.status === "todo");
  return { scoped, shown: filter === "todo" ? todo : scoped, todo: todo.length };
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
