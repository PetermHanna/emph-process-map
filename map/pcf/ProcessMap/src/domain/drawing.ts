// Drawing on a screenshot and on a flow (Business Map N5 and N1), as rules with no UI, so they can be tested alone.
// A screenshot's lines and numbered comments are burnt into the picture, so everyone sees them, and kept as JSON in the
// note's text, so the workshop record can list them. A flow drawing is kept per workshop and flow on the workshop row
// (emph_drawings, JSON by flow id); points are in the flow's own coordinates, so a drawing reopens on the same steps.
// A line or comment belongs to the step whose box its centre falls in, else the nearest box within NEAR, else to "around the flow".

/** how far (flow units) from a step's box a line still counts as on it */
export const NEAR = 60;
export const COLOURS = ["#C50F1F", "#0F6CBD", "#107C10"];
/** The workshop's drawings column holds at most this many characters (install.js). */
export const MAX_DRAWINGS_TEXT = 1048576;

/** [x, y] */
export type Pt = [number, number];
export interface Stroke { id: string; pts: Pt[]; colour: string; size: number; step: string | null; by?: string; on?: string }
export interface DrawComment { id: string; x: number; y: number; text: string; step: string | null; by?: string; on?: string }
export interface Box { code: string; x: number; y: number; w: number; h: number }
export interface Drawing { strokes: Stroke[]; comments: DrawComment[] }
/** All of a workshop's flow drawings, by flow id. */
export type Drawings = Record<string, Drawing>;

export const emptyDrawing = (): Drawing => ({ strokes: [], comments: [] });
const r1 = (n: number) => Math.round(n * 10) / 10;
let seq = 0;
const newId = () => Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

/** Drops points closer than `tol` to the last kept one (keeps the first and last) and rounds to 0.1. */
export function simplify(pts: Pt[], tol = 1.5): Pt[] {
  const out: Pt[] = [];
  pts.forEach((p, i) => {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
    const last = out[out.length - 1];
    if (!last || i === pts.length - 1 || Math.hypot(p[0] - last[0], p[1] - last[1]) >= tol) out.push([r1(p[0]), r1(p[1])]);
  });
  return out;
}

/** The centre of a line's bounding box. */
export function centreOf(pts: Pt[]): { x: number; y: number } | null {
  if (!pts.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

/** The step at a point: the box it falls in (the smallest, if boxes overlap), else the nearest within `near`, else null. */
export function stepAt(x: number, y: number, boxes: Box[], near = NEAR): string | null {
  const inside = boxes.filter(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h).sort((a, b) => a.w * a.h - b.w * b.h);
  if (inside.length) return inside[0].code;
  let best: string | null = null, d = Infinity;
  boxes.forEach(b => {
    const dx = Math.max(b.x - x, 0, x - (b.x + b.w)), dy = Math.max(b.y - y, 0, y - (b.y + b.h)), e = Math.hypot(dx, dy);
    if (e <= near && e < d) { d = e; best = b.code; }
  });
  return best;
}
export const stepOfStroke = (pts: Pt[], boxes: Box[], near = NEAR) => { const c = centreOf(pts); return c ? stepAt(c.x, c.y, boxes, near) : null; };

/** A finished line: simplified and tied to its step. Null when it is only a dot of fewer than two points. */
export function makeStroke(raw: Pt[], colour: string, size: number, boxes: Box[], by?: string): Stroke | null {
  const pts = simplify(raw);
  if (pts.length < 2) return null;
  return { id: newId(), pts, colour, size, step: stepOfStroke(pts, boxes), by, on: new Date().toISOString() };
}
export function makeComment(x: number, y: number, text: string, boxes: Box[], by?: string): DrawComment | null {
  const t = String(text || "").trim().slice(0, 2000);
  if (!t || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { id: newId(), x: r1(x), y: r1(y), text: t, step: stepAt(x, y, boxes), by, on: new Date().toISOString() };
}
/** Takes back the newest line or comment. */
export function undoLast(d: Drawing): Drawing {
  const ls = d.strokes[d.strokes.length - 1], lc = d.comments[d.comments.length - 1];
  if (!ls && !lc) return d;
  if (!lc || (ls && (ls.on || "") >= (lc.on || ""))) return { ...d, strokes: d.strokes.slice(0, -1) };
  return { ...d, comments: d.comments.slice(0, -1) };
}
/** Steps tied again after the flow changed (a step moved or left): every line and comment by its place now. */
export function retie(d: Drawing, boxes: Box[]): Drawing {
  return { strokes: d.strokes.map(s => ({ ...s, step: stepOfStroke(s.pts, boxes) })), comments: d.comments.map(c => ({ ...c, step: stepAt(c.x, c.y, boxes) })) };
}
/** An SVG path through the points (a polyline). */
export const pathOf = (pts: Pt[]) => pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");

const wellFormed = (d: any): Drawing => ({
  strokes: Array.isArray(d?.strokes) ? d.strokes.filter((s: any) => s && typeof s.id === "string" && Array.isArray(s.pts))
    .map((s: any) => ({ ...s, pts: s.pts.filter((p: any) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p: any) => [p[0], p[1]]), step: s.step ?? null })) : [],
  comments: Array.isArray(d?.comments) ? d.comments.filter((c: any) => c && typeof c.id === "string" && typeof c.text === "string" && Number.isFinite(c.x) && Number.isFinite(c.y)).map((c: any) => ({ ...c, step: c.step ?? null })) : [],
});
/** A workshop's drawings from its column, keeping only well-formed entries. */
export function readDrawings(raw: string | null | undefined): Drawings {
  try {
    const j = JSON.parse(raw || "{}");
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, wellFormed(v)]).filter(([, v]) => (v as Drawing).strokes.length || (v as Drawing).comments.length)) as Drawings;
  } catch { return {}; }
}
/** The column's text with one flow's drawing set (an empty drawing removes it); throws when it is too big, so nothing is cut off silently. */
export function writeDrawing(raw: string | null | undefined, flowId: string, d: Drawing): string {
  const all = readDrawings(raw);
  if (d.strokes.length || d.comments.length) all[flowId] = d; else delete all[flowId];
  const text = JSON.stringify(all);
  if (text.length > MAX_DRAWINGS_TEXT) throw new Error("This drawing is too big to save. Remove some lines first.");
  return text;
}

/** Plain lines for the workshop record and the read-back: what was drawn or written on which step. */
export function drawingLines(d: Drawing, stepName: (code: string) => string | undefined): string[] {
  const where = (s: string | null) => (s && stepName(s)) || "around the flow";
  const counts = new Map<string, number>();
  d.strokes.forEach(s => { const k = where(s.step); counts.set(k, (counts.get(k) || 0) + 1); });
  return Array.from(counts, ([w, n]) => n + (n === 1 ? " line drawn on " : " lines drawn on ") + w).concat(d.comments.map(c => "Comment on " + where(c.step) + ": " + c.text));
}

// ---------- marks on a screenshot ----------
/** Lines and comments drawn on a screenshot, in the picture's pixels. */
export interface ShotMarks { strokes: Stroke[]; comments: DrawComment[] }
const MARKS = "\n--- marks ---\n";
/** The screenshot note's text with its marks after a fixed line; the text before it stays readable in Dataverse. Lines keep only who and when (they are in the picture). */
export const noteWithMarks = (note: string, marks: ShotMarks) => (String(note || "").split(MARKS)[0] || "") + MARKS
  + JSON.stringify({ strokes: marks.strokes.map(s => ({ id: s.id, on: s.on, by: s.by })), comments: marks.comments.map(c => ({ id: c.id, x: c.x, y: c.y, text: c.text, step: null, by: c.by, on: c.on })) });
/** The marks kept in a screenshot's note. */
export function marksOf(note: string | null | undefined): { lines: { on?: string; by?: string }[]; comments: DrawComment[] } {
  const part = String(note || "").split(MARKS)[1];
  if (!part) return { lines: [], comments: [] };
  try { const j = JSON.parse(part); return { lines: Array.isArray(j.strokes) ? j.strokes : [], comments: wellFormed({ comments: j.comments }).comments }; } catch { return { lines: [], comments: [] }; }
}
/** A screenshot's note and marks as text: what the record (and later the AI analysis) reads beside the picture. */
export function shotText(note: string | null | undefined): string {
  const m = marksOf(note);
  const head = (String(note || "").split(MARKS)[0] || "").trim();
  const out = head ? [head] : [];
  if (m.lines.length) out.push(m.lines.length + (m.lines.length === 1 ? " line" : " lines") + " drawn on the picture");
  m.comments.forEach((c, i) => out.push((i + 1) + ". " + c.text));
  return out.join("\n");
}
