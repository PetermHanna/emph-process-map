// The meeting transcript of a workshop: pasted from Teams (Teams has no live transcript for apps), placed on the agenda by time,
// cut into sentences, and reviewed line by line (Business Map U1, U2, F4): each line is a suggestion with a type (requirement,
// business rule, comment, open point, flow change, licence) that the facilitator accepts as it is, edits first, or marks not relevant.
import * as React from "react";
import { Button, Field, Input, Switch, Textarea, Tooltip } from "@fluentui/react-components";
import { C, useLook } from "../look";
import { Pill } from "../kit";
import { parseTranscript, transcriptLines, transcriptStats, linesByVisit, lineSignals, clock, processKeyOf, activityCodeOf, pasteWarnings, reviewCounts, REVIEW_TYPES, Utterance, LineReview, ReviewType } from "../../domain/session";
import type { Workshop, ProcessItem } from "../../domain/types";

export type LineUse = "requirement" | "rule" | "comment" | "open" | "flow" | "licence";
export type Line = Utterance & { i: number; key: string };
/** The line action for each review type. */
export const USE_OF: Record<ReviewType, LineUse> = { req: "requirement", rule: "rule", comment: "comment", open: "open", flow: "flow", licence: "licence" };
/** One line's review as the Runner works it out: where it stands, whether it can go back on the list, and the words as edited. */
export interface LineState { r: LineReview; undo: { can: boolean; reason: string }; text?: string }
export interface ReviewActions { reject: (u: Line) => void; undo: (u: Line) => void }

const toLocal = (iso: string | null | undefined) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d.getTime()) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocal = (v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); };
/** The transcript as the review list reads it: Teams' turns cut into sentences. */
export const linesOf = (raw: string) => transcriptLines(parseTranscript(raw));

/** The words, with hedging marked; must and licence as tags. */
export function Marked({ text }: { text: string }) {
  const sig = lineSignals(text), out: React.ReactNode[] = [];
  let at = 0;
  sig.spans.forEach((m, k) => {
    if (m.start > at) out.push(text.slice(at, m.start));
    out.push(<mark key={k} data-mark="hedge" title="A variant or an exception? Ask when, and who decides." style={{ background: "#FEF3C7", color: "inherit", borderRadius: 3, padding: "0 2px" }}>{text.slice(m.start, m.end)}</mark>);
    at = m.end;
  });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}{sig.must && <> <Pill text="must" tone="bad" /></>}{sig.licence && <> <Pill text="licence" tone="brand" /></>}</>;
}

const BUTTONS: { type: ReviewType; label: string; emph: string; tip: (where: string) => string }[] = [
  { type: "req", label: "Capture", emph: "line-capture", tip: () => "A requirement, with the line as its source" },
  { type: "rule", label: "Rule", emph: "line-rule", tip: () => "A business rule: a requirement of type Business rule (a limit, an \"only if\", an \"unless\")" },
  { type: "comment", label: "Comment", emph: "line-comment", tip: w => "A remark on " + w },
  { type: "open", label: "Open point", emph: "line-open", tip: () => "An open point or a contradiction to settle: goes to the action items" },
  { type: "flow", label: "Flow", emph: "line-flow", tip: w => "A change to how " + w + " runs: the sentence becomes an activity's reason" },
  { type: "licence", label: "Licence", emph: "line-licence", tip: () => "Who needs which licence, and how many: saved on the role" },
];

export function TranscriptPanel({ w, current, closed, save, saveSession, used, onUse, states, actions }: {
  w: Workshop; agenda: ProcessItem[]; current: ProcessItem | null; closed: boolean; used: Map<number, string>;
  save: (patch: Partial<Workshop>) => void; saveSession: (fn: (s: Workshop["session"]) => Workshop["session"]) => void; onUse: (line: Line, use: LineUse, text: string) => void;
  states: Map<number, LineState>; actions: ReviewActions;
}) {
  const l = useLook();
  const [draft, setDraft] = React.useState<string | null>(w.transcript ? null : "");
  const [startAt, setStartAt] = React.useState<string | null>(null);
  const [all, setAll] = React.useState(false);
  const [todoOnly, setTodoOnly] = React.useState(false);
  const [editing, setEditing] = React.useState<number | null>(null);
  const [edits, setEdits] = React.useState<Record<number, string>>({}); // words edited before the line is kept
  const lines = React.useMemo(() => linesOf(w.transcript), [w.transcript]);
  const stats = React.useMemo(() => transcriptStats(lines), [lines]);
  const start = w.session.transcriptStart || w.session.visits[0]?.at || null;
  const placed = React.useMemo(() => linesByVisit(lines, w.session.visits, start), [lines, w.session.visits, start]);
  const keyOf = React.useMemo(() => { const m = new Map<number, string>(); Object.entries(placed).forEach(([k, xs]) => xs.forEach(x => m.set(x.i, k))); return m; }, [placed]);
  const counts = reviewCounts(lines.map((_, i) => states.get(i)?.r || { status: "todo", type: "comment", legacy: false }));

  if (draft !== null) {
    const turns = parseTranscript(draft), preview = transcriptLines(turns), ps = transcriptStats(preview), warn = draft.trim() ? pasteWarnings(draft, turns) : [];
    const keepStart = startAt ?? toLocal(start || new Date().toISOString());
    return (
      <div className={l.card} data-emph="transcript" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className={l.section} style={{ marginTop: 0 }}>Meeting transcript</div>
        <div className={l.muted} style={{ fontSize: 12 }}>In Teams, open the meeting's Transcript, then download it (.vtt or .docx) or select all and copy. Paste it here.</div>
        <Textarea data-emph="transcript-paste" rows={10} value={draft} onChange={(_, d) => setDraft(d.value)} placeholder={"Ana Field   0:03\nWe always check the credit limit first.\n\nor  [0:03] Ana Field: ...  or a .vtt or .docx download"} />
        <div className={l.muted} data-emph="transcript-preview">{draft.trim() ? "Read " + ps.lines + " lines from " + ps.speakers.length + " speakers" + (ps.noSpeaker ? ", " + ps.noSpeaker + " without a speaker" : "") + (ps.minutes != null ? ", " + ps.minutes + " min" : ", no times") + (preview.length > turns.length ? " (" + turns.length + " turns cut into sentences)" : "") : "Nothing pasted yet."}</div>
        {warn.map(x => <div key={x} data-emph="transcript-warning" style={{ color: C.warn, fontSize: 12 }}>{x}</div>)}
        {preview.length > 0 && (
          <table className={l.table} data-emph="transcript-preview-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Time</th><th>Speaker</th><th>Words</th></tr></thead>
            <tbody>{preview.slice(0, 15).map((u, k) => <tr key={k}><td>{u.at != null ? clock(u.at) : ""}</td><td>{u.speaker || <span style={{ color: C.warn }}>none</span>}</td><td>{u.text}</td></tr>)}</tbody>
          </table>
        )}
        {preview.length > 15 && <div className={l.muted} style={{ fontSize: 12 }}>and {preview.length - 15} more</div>}
        <Field label="Recording started at" hint="Lines are placed on the business process (or flow step) being discussed at that moment.">
          <Input type="datetime-local" data-emph="transcript-keep-start" value={keepStart} onChange={(_, d) => setStartAt(d.value)} />
        </Field>
        {w.transcript && <div style={{ color: C.warn, fontSize: 12 }}>Keeping a new transcript replaces the old one. Requirements, comments and open points already made stay.</div>}
        <div className={l.row}>
          <Button appearance="primary" data-emph="transcript-keep" disabled={closed || !preview.length} onClick={() => {
            const at = startAt ? fromLocal(startAt) : null;
            save({ transcript: draft }); saveSession(s => ({ ...s, captured: {}, transcriptStart: at || s.transcriptStart || s.visits[0]?.at || null })); setDraft(null); setStartAt(null);
          }}>Keep this transcript</Button>
          {w.transcript && <Button onClick={() => setDraft(null)}>Cancel</Button>}
        </div>
      </div>
    );
  }

  const visitName = (key: string) => w.session.visits.find(v => v.key === key)?.name || activityCodeOf(key);
  const inScope: Line[] = all ? lines.map((u, i) => ({ ...u, i, key: keyOf.get(i) || "" }))
    : Object.entries(placed).filter(([k]) => (current ? processKeyOf(k) === current.id : k === "")).flatMap(([k, xs]) => xs.map(x => ({ ...x, key: k }))).sort((a, b) => a.i - b.i);
  const todoHere = inScope.filter(u => (states.get(u.i)?.r.status || "todo") === "todo").length;
  const shown = todoOnly ? inScope.filter(u => (states.get(u.i)?.r.status || "todo") === "todo") : inScope;
  const row = (u: Line) => {
    const st = states.get(u.i), r = st?.r || { status: "todo", type: "comment", legacy: false } as LineReview;
    const done = used.get(u.i) || (r.status === "rejected" ? "Not relevant" : r.status === "accepted" ? REVIEW_TYPES[r.type] : "");
    const step = activityCodeOf(u.key) ? visitName(u.key) : "";
    const where = step || (current ? current.name : "the business process");
    const words = edits[u.i] ?? st?.text ?? u.text;
    const isEditing = editing === u.i && !done;
    return (
      <div key={u.i} data-emph="transcript-line" data-line={u.i} data-status={r.status} style={{ borderBottom: "1px solid " + C.line, padding: "6px 0", opacity: done ? 0.7 : 1 }}>
        <div style={{ fontSize: 12, color: C.muted, display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ flexGrow: 1 }}>{u.at != null ? clock(u.at) + " · " : ""}<b style={{ color: "#334155" }}>{u.speaker || "Unknown speaker"}</b>{step && <span data-emph="line-step"> › {step}</span>}</span>
          {!done && <span data-emph="line-type" data-type={r.type}><Pill text={"Suggested: " + REVIEW_TYPES[r.type]} tone={r.type === "req" || r.type === "rule" ? "bad" : r.type === "open" ? "warn" : "info"} /></span>}
        </div>
        {isEditing ? <Textarea data-emph="line-text" rows={2} value={words} onChange={(_, d) => setEdits(e => ({ ...e, [u.i]: d.value }))} style={{ width: "100%", margin: "2px 0 4px" }} />
          : <div style={{ fontSize: 13, margin: "2px 0 4px" }}><Marked text={words} />{words !== u.text && <span className={l.muted} style={{ fontSize: 11 }}> (edited)</span>}</div>}
        {done ? (
          <div className={l.row}>
            <Pill text={done} tone={r.status === "rejected" ? "neutral" : "ok"} />
            {!closed && (st?.undo.can ? <Button size="small" appearance="subtle" data-emph="line-undo" onClick={() => actions.undo(u)}>Undo</Button>
              : st?.undo.reason ? <span className={l.muted} style={{ fontSize: 11 }}>{st.undo.reason}</span> : null)}
          </div>
        ) : !closed && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {BUTTONS.map(b => (
              <Tooltip key={b.type} content={b.tip(where)} relationship="description">
                <Button size="small" appearance={b.type === r.type ? "primary" : "secondary"} data-emph={b.emph}
                  disabled={(b.type === "comment" && !current && !processKeyOf(u.key)) || (b.type === "flow" && !current)} onClick={() => { setEditing(null); onUse(u, USE_OF[b.type], words); }}>{b.label}</Button>
              </Tooltip>
            ))}
            <Button size="small" appearance="subtle" data-emph="line-edit" onClick={() => setEditing(isEditing ? null : u.i)}>{isEditing ? "Done" : "Edit"}</Button>
            <Tooltip content="Nothing to keep from this line. It can go back on the list while the workshop is open." relationship="description"><Button size="small" appearance="subtle" data-emph="line-reject" onClick={() => actions.reject(u)}>Not relevant</Button></Tooltip>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={l.card} data-emph="transcript" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className={l.row} style={{ justifyContent: "space-between" }}>
        <div className={l.section} style={{ margin: 0 }}>Meeting transcript</div>
        {!closed && <Button size="small" appearance="subtle" onClick={() => setDraft("")}>Replace</Button>}
      </div>
      <div className={l.muted} style={{ fontSize: 12 }} data-emph="transcript-stats">
        {stats.lines} lines{stats.minutes != null ? " · " + stats.minutes + " min" : ""}{stats.noSpeaker ? " · " + stats.noSpeaker + " without a speaker" : ""} · {counts.accepted} used · {counts.todo} to do{counts.rejected ? " · " + counts.rejected + " not relevant" : ""}
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{stats.speakers.map(s => <Pill key={s.speaker} text={s.speaker + " " + s.words + " words"} />)}</div>
      <Field label="Recording started at" hint="Lines are placed on the business process (or flow step) being discussed at that moment.">
        <Input type="datetime-local" data-emph="transcript-start" disabled={closed} value={toLocal(start)} onChange={(_, d) => { const v = fromLocal(d.value); if (v) saveSession(s => ({ ...s, transcriptStart: v })); }} />
      </Field>
      <div className={l.row}>
        <Switch label="All lines" checked={all} onChange={(_, d) => setAll(d.checked)} />
        <Switch label={"To do only (" + todoHere + ")"} data-emph="transcript-todo" checked={todoOnly} onChange={(_, d) => setTodoOnly(d.checked)} />
      </div>
      {!all && <div style={{ fontWeight: 600, fontSize: 13 }}>{current ? current.name : "Before the first business process"}</div>}
      <div style={{ maxHeight: 520, overflow: "auto" }} data-emph="transcript-lines">
        {shown.length ? shown.map(row) : <div className={l.muted} style={{ fontSize: 12 }}>{todoOnly && inScope.length ? "Every line here is handled." : all ? "No lines." : "No lines while this was being discussed. Check the start time, or switch on All lines."}</div>}
      </div>
      <div style={{ fontSize: 11, color: C.muted }}><mark style={{ background: "#FEF3C7" }}>usually</mark> hedging: a variant or exception to ask about. The suggested type is the highlighted button; nothing is kept until you press one.</div>
    </div>
  );
}

/** One frame of a screen, window or tab the user picks, as base64 JPEG (at most 1920 wide). Null when the user cancels. */
export async function grabScreen(): Promise<string | null> {
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); }
  catch (e: any) { if (e?.name === "NotAllowedError" || e?.name === "AbortError") return null; throw e; }
  try {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.srcObject = stream;
    await v.play();
    await new Promise(r => setTimeout(r, 300)); // let the first real frame arrive
    const scale = Math.min(1, 1920 / (v.videoWidth || 1920));
    const c = document.createElement("canvas");
    c.width = Math.round((v.videoWidth || 1280) * scale); c.height = Math.round((v.videoHeight || 720) * scale);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82).split(",")[1];
  } finally { stream.getTracks().forEach(t => t.stop()); }
}
