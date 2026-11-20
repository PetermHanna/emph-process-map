// Right after a screenshot is taken, the facilitator can draw on it and pin numbered comments, or skip (Business Map N5).
// The marks are burnt into the stored picture, so everyone sees them, and kept as JSON in the note's text (drawing.ts).
import * as React from "react";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Textarea, ToggleButton, Tooltip } from "@fluentui/react-components";
import { ArrowUndo20Regular, Comment20Regular, Edit20Regular } from "@fluentui/react-icons";
import { C } from "../look";
import { COLOURS, DrawComment, Pt, ShotMarks, Stroke, makeComment, makeStroke, pathOf, undoLast } from "../../domain/drawing";

/** The picture with its marks drawn in, as base64 JPEG (no data: prefix). */
export async function burnIn(src: string, marks: ShotMarks): Promise<string> {
  const img = new Image();
  await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("The picture could not be read.")); img.src = src; });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  g.lineCap = "round"; g.lineJoin = "round";
  marks.strokes.forEach(s => { g.strokeStyle = s.colour; g.lineWidth = s.size; g.stroke(new Path2D(pathOf(s.pts))); });
  const r = Math.max(10, c.width / 120), font = Math.max(12, c.width / 90);
  marks.comments.forEach((m, i) => {
    g.fillStyle = "#C50F1F"; g.beginPath(); g.arc(m.x, m.y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.font = "bold " + font + "px Segoe UI, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(i + 1), m.x, m.y);
    g.textAlign = "left"; g.font = font + "px Segoe UI, Arial";
    const text = m.text.length > 80 ? m.text.slice(0, 77) + "..." : m.text, w = g.measureText(text).width + font;
    const x = Math.min(m.x + r + 4, c.width - w - 4), y = m.y - font;
    g.fillStyle = "rgba(255,244,206,0.95)"; g.fillRect(x, y, w, font * 2); g.strokeStyle = "#E5C365"; g.lineWidth = 1; g.strokeRect(x, y, w, font * 2);
    g.fillStyle = "#242424"; g.fillText(text, x + font / 2, y + font);
  });
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export function ShotAnnotate({ src, title, by, onSave, onSkip }: { src: string; title: string; by: string; onSave: (marks: ShotMarks) => Promise<void> | void; onSkip: () => void }) {
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);
  const [marks, setMarks] = React.useState<ShotMarks>({ strokes: [], comments: [] });
  const [mode, setMode] = React.useState<"pen" | "comment">("pen");
  const [colour, setColour] = React.useState(COLOURS[0]);
  const [live, setLive] = React.useState<Pt[] | null>(null);
  const [pending, setPending] = React.useState<{ x: number; y: number } | null>(null);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const svg = React.useRef<SVGSVGElement>(null);
  const liveRef = React.useRef<Pt[] | null>(null);
  const pen = size ? Math.max(4, size.w / 260) : 5;
  const at = (e: React.PointerEvent): Pt => { const r = svg.current!.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * size!.w, ((e.clientY - r.top) / r.height) * size!.h]; };
  const addComment = () => { if (pending) { const c = makeComment(pending.x, pending.y, text, [], by); if (c) setMarks(m => ({ ...m, comments: m.comments.concat(c) })); } setPending(null); setText(""); };
  const save = async () => { setBusy(true); setErr(null); try { await onSave(marks); } catch (e: any) { setErr("Not saved: " + (e?.message || e)); } finally { setBusy(false); } };
  const none = !marks.strokes.length && !marks.comments.length;
  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open && !busy) onSkip(); }}>
      <DialogSurface style={{ maxWidth: "94vw", width: "94vw" }}><DialogBody>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div data-emph="shot-tools" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <ToggleButton data-emph="shot-pen" size="small" icon={<Edit20Regular />} checked={mode === "pen"} onClick={() => setMode("pen")}>Draw</ToggleButton>
            <ToggleButton data-emph="shot-comment" size="small" icon={<Comment20Regular />} checked={mode === "comment"} onClick={() => setMode("comment")}>Comment</ToggleButton>
            {COLOURS.map(c => <button key={c} aria-label={"Pen colour " + c} aria-pressed={colour === c} onClick={() => { setColour(c); setMode("pen"); }} style={{ width: 20, height: 20, borderRadius: 10, background: c, border: colour === c ? "3px solid #242424" : "2px solid #fff", boxShadow: "0 0 0 1px #C7C7C7", cursor: "pointer", padding: 0 }} />)}
            <Tooltip content="Take back the last line or comment" relationship="label"><Button size="small" appearance="subtle" icon={<ArrowUndo20Regular />} disabled={none} onClick={() => setMarks(m => undoLast(m) as ShotMarks)} /></Tooltip>
            <span style={{ color: C.muted, fontSize: 12 }}>{mode === "pen" ? "Draw on the picture." : "Click where the comment goes."} {marks.strokes.length} lines, {marks.comments.length} comments.</span>
          </div>
          <div style={{ position: "relative", maxHeight: "68vh", overflow: "auto" }}>
            <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
              <img src={src} alt={title} style={{ width: "100%", display: "block", userSelect: "none" }} draggable={false} onLoad={e => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
              {size && (
                <svg ref={svg} data-emph="shot-canvas" viewBox={"0 0 " + size.w + " " + size.h} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: mode === "pen" ? "crosshair" : "copy", touchAction: "none" }}
                  onPointerDown={e => {
                    if (e.button !== 0) return;
                    if (mode === "comment") { const p = at(e); setPending({ x: p[0], y: p[1] }); setText(""); return; }
                    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* a pointer the browser no longer tracks */ } liveRef.current = [at(e)]; setLive(liveRef.current);
                  }}
                  onPointerMove={e => { if (!liveRef.current) return; liveRef.current = liveRef.current.concat([at(e)]); setLive(liveRef.current); }}
                  onPointerUp={() => { const pts = liveRef.current; liveRef.current = null; setLive(null); if (pts) { const s: Stroke | null = makeStroke(pts, colour, pen, [], by); if (s) setMarks(m => ({ ...m, strokes: m.strokes.concat(s) })); } }}>
                  {marks.strokes.map(s => <path key={s.id} d={pathOf(s.pts)} fill="none" stroke={s.colour} strokeWidth={s.size} strokeLinecap="round" strokeLinejoin="round" />)}
                  {live && <path d={pathOf(live)} fill="none" stroke={colour} strokeWidth={pen} strokeLinecap="round" opacity={0.85} />}
                  {marks.comments.map((c: DrawComment, i) => <g key={c.id}><circle cx={c.x} cy={c.y} r={pen * 2.4} fill="#C50F1F" /><text x={c.x} y={c.y} fill="#fff" fontSize={pen * 2.6} fontWeight={700} textAnchor="middle" dominantBaseline="central">{i + 1}</text></g>)}
                </svg>
              )}
              {pending && size && (
                <div data-emph="shot-comment-box" style={{ position: "absolute", left: Math.min(94, (pending.x / size.w) * 100) + "%", top: (pending.y / size.h) * 100 + "%", width: 240, transform: pending.x / size.w > 0.7 ? "translateX(-100%)" : undefined, background: "#FFF4CE", border: "1px solid #E5C365", borderRadius: 6, padding: 6, boxShadow: "0 4px 12px rgba(0,0,0,.2)", display: "flex", flexDirection: "column", gap: 4, zIndex: 2 }}>
                  <Textarea data-emph="shot-comment-text" autoFocus size="small" value={text} onChange={(_, d) => setText(d.value)} placeholder="What is this?" />
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}><Button size="small" onClick={() => setPending(null)}>Cancel</Button><Button data-emph="shot-comment-add" size="small" appearance="primary" disabled={!text.trim()} onClick={addComment}>Add</Button></div>
                </div>
              )}
            </div>
          </div>
          {marks.comments.length > 0 && <ol data-emph="shot-comments" style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>{marks.comments.map(c => <li key={c.id}>{c.text}</li>)}</ol>}
          {err && <div style={{ color: C.bad, fontSize: 12 }}>{err}</div>}
        </DialogContent>
        <DialogActions>
          <Button data-emph="shot-skip" disabled={busy} onClick={onSkip}>Skip</Button>
          <Button data-emph="shot-save" appearance="primary" disabled={busy || none} onClick={() => void save()}>{busy ? "Saving" : "Save on the picture"}</Button>
        </DialogActions>
      </DialogBody></DialogSurface>
    </Dialog>
  );
}
