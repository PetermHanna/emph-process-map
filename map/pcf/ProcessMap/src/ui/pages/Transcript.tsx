// The meeting transcript of a workshop: pasted from Teams (Teams has no live transcript for apps), placed on the agenda by time,
// and turned line by line into a requirement, a comment, an open point, a flow change or a licence need.
import * as React from "react";
import { Button, Field, Input, Switch, Textarea, Tooltip } from "@fluentui/react-components";
import { C, useLook } from "../look";
import { Pill } from "../kit";
import { parseTranscript, transcriptStats, linesByVisit, lineSignals, clock, processKeyOf, activityCodeOf, Utterance } from "../../domain/session";
import type { Workshop, ProcessItem } from "../../domain/types";

export type LineUse = "requirement" | "comment" | "open" | "flow" | "licence";
export type Line = Utterance & { i: number; key: string };

const toLocal = (iso: string | null | undefined) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d.getTime()) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocal = (v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); };

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

export function TranscriptPanel({ w, current, closed, save, saveSession, used, onUse }: {
  w: Workshop; agenda: ProcessItem[]; current: ProcessItem | null; closed: boolean; used: Map<number, string>;
  save: (patch: Partial<Workshop>) => void; saveSession: (fn: (s: Workshop["session"]) => Workshop["session"]) => void; onUse: (line: Line, use: LineUse) => void;
}) {
  const l = useLook();
  const [draft, setDraft] = React.useState<string | null>(w.transcript ? null : "");
  const [all, setAll] = React.useState(false);
  const lines = React.useMemo(() => parseTranscript(w.transcript), [w.transcript]);
  const stats = React.useMemo(() => transcriptStats(lines), [lines]);
  const start = w.session.transcriptStart || w.session.visits[0]?.at || null;
  const placed = React.useMemo(() => linesByVisit(lines, w.session.visits, start), [lines, w.session.visits, start]);
  const keyOf = React.useMemo(() => { const m = new Map<number, string>(); Object.entries(placed).forEach(([k, xs]) => xs.forEach(x => m.set(x.i, k))); return m; }, [placed]);

  if (draft !== null) {
    const preview = parseTranscript(draft), ps = transcriptStats(preview);
    return (
      <div className={l.card} data-emph="transcript" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className={l.section} style={{ marginTop: 0 }}>Meeting transcript</div>
        <div className={l.muted} style={{ fontSize: 12 }}>In Teams, open the meeting's Transcript, then download it (.vtt or .docx) or select all and copy. Paste it here.</div>
        <Textarea data-emph="transcript-paste" rows={10} value={draft} onChange={(_, d) => setDraft(d.value)} placeholder={"Ana Field   0:03\nWe always check the credit limit first.\n\nor  [0:03] Ana Field: ...  or a .vtt file"} />
        <div className={l.muted} data-emph="transcript-preview">{draft.trim() ? "Read " + ps.lines + " lines from " + ps.speakers.length + " speakers" + (ps.noSpeaker ? ", " + ps.noSpeaker + " without a speaker" : "") + (ps.minutes != null ? ", " + ps.minutes + " min" : ", no times") : "Nothing pasted yet."}</div>
        {w.transcript && <div style={{ color: C.warn, fontSize: 12 }}>Keeping a new transcript replaces the old one. Requirements, comments and open points already made stay.</div>}
        <div className={l.row}>
          <Button appearance="primary" data-emph="transcript-keep" disabled={closed || !preview.length} onClick={() => { save({ transcript: draft }); saveSession(s => ({ ...s, captured: {}, transcriptStart: s.transcriptStart || s.visits[0]?.at || null })); setDraft(null); }}>Keep this transcript</Button>
          {w.transcript && <Button onClick={() => setDraft(null)}>Cancel</Button>}
        </div>
      </div>
    );
  }

  const visitName = (key: string) => w.session.visits.find(v => v.key === key)?.name || activityCodeOf(key);
  const shown: Line[] = all ? lines.map((u, i) => ({ ...u, i, key: keyOf.get(i) || "" }))
    : Object.entries(placed).filter(([k]) => (current ? processKeyOf(k) === current.id : k === "")).flatMap(([k, xs]) => xs.map(x => ({ ...x, key: k }))).sort((a, b) => a.i - b.i);
  const row = (u: Line) => {
    const done = used.get(u.i);
    const step = activityCodeOf(u.key) ? visitName(u.key) : "";
    return (
      <div key={u.i} data-emph="transcript-line" data-line={u.i} style={{ borderBottom: "1px solid " + C.line, padding: "6px 0", opacity: done ? 0.7 : 1 }}>
        <div style={{ fontSize: 12, color: C.muted }}>{u.at != null ? clock(u.at) + " · " : ""}<b style={{ color: "#334155" }}>{u.speaker || "Unknown speaker"}</b>{step && <span data-emph="line-step"> › {step}</span>}</div>
        <div style={{ fontSize: 13, margin: "2px 0 4px" }}><Marked text={u.text} /></div>
        {done ? <Pill text={done} tone="ok" /> : !closed && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <Button size="small" appearance="primary" data-emph="line-capture" onClick={() => onUse(u, "requirement")}>Capture</Button>
            <Tooltip content={"A remark on " + (step || (current ? current.name : "the business process"))} relationship="description"><Button size="small" data-emph="line-comment" disabled={!current && !processKeyOf(u.key)} onClick={() => onUse(u, "comment")}>Comment</Button></Tooltip>
            <Tooltip content="An open point or a contradiction to settle: goes to the action items" relationship="description"><Button size="small" data-emph="line-open" onClick={() => onUse(u, "open")}>Open point</Button></Tooltip>
            <Tooltip content={current ? "A change to how " + current.name + " runs: the sentence becomes an activity's reason" : "Pick a business process first"} relationship="description"><Button size="small" disabled={!current} data-emph="line-flow" onClick={() => onUse(u, "flow")}>Flow</Button></Tooltip>
            <Tooltip content="Who needs which licence, and how many: saved on the role" relationship="description"><Button size="small" data-emph="line-licence" onClick={() => onUse(u, "licence")}>Licence</Button></Tooltip>
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
        {stats.lines} lines{stats.minutes != null ? " · " + stats.minutes + " min" : ""}{stats.noSpeaker ? " · " + stats.noSpeaker + " without a speaker" : ""} · {used.size} used
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{stats.speakers.map(s => <Pill key={s.speaker} text={s.speaker + " " + s.words + " words"} />)}</div>
      <Field label="Recording started at" hint="Lines are placed on the business process (or flow step) being discussed at that moment.">
        <Input type="datetime-local" data-emph="transcript-start" disabled={closed} value={toLocal(start)} onChange={(_, d) => { const v = fromLocal(d.value); if (v) saveSession(s => ({ ...s, transcriptStart: v })); }} />
      </Field>
      <Switch label="All lines" checked={all} onChange={(_, d) => setAll(d.checked)} />
      {!all && <div style={{ fontWeight: 600, fontSize: 13 }}>{current ? current.name : "Before the first business process"}</div>}
      <div style={{ maxHeight: 520, overflow: "auto" }} data-emph="transcript-lines">
        {shown.length ? shown.map(row) : <div className={l.muted} style={{ fontSize: 12 }}>{all ? "No lines." : "No lines while this was being discussed. Check the start time, or switch on All lines."}</div>}
      </div>
      <div style={{ fontSize: 11, color: C.muted }}><mark style={{ background: "#FEF3C7" }}>usually</mark> hedging: a variant or exception to ask about</div>
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
