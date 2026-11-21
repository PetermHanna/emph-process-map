// One AI run in the browser: the documents read or converted, the Pictures PDF drawn on a canvas, the calls through
// Gateway.predict, the answers joined, checked and saved as suggestions. The rules are in domain/ai.ts; this file only
// gathers the inputs (canvas, files, activities) and keeps the order of the calls.
import type { Model, Workshop, Screenshot, Activity, AiRun } from "../domain/types";
import type { Repository } from "../domain/repository";
import { loadActivities } from "../domain/repository";
import {
  timeline, buildPicture, buildRequest, requestChars, parseChangeSet, mergeSets, guardChangeSet, proposalsOf, runLog, newRun, flowFor, suspectLine,
  RunDocument, TimelineLine, ChangeSet, GuardContext, Task, RequestParts,
} from "../domain/ai";
import { AiModel, promptOf, estimateRun, estimateText, PROMPT_CHARS, CallSize, AI_MODEL_LABEL } from "../domain/aiModels";
import { uploadWay, readTextUpload, extractedText, documentPdf, fileInput, blankInput, toBase64, fromBase64, pdfProblem, PdfPage, pageHeading, FileInput, Inflate } from "../domain/aiFiles";
import { readDrawings, shotText, Drawing } from "../domain/drawing";
import { linesOf } from "./pages/Transcript";
import { kindLabel } from "./pages/WorkshopClose";

const MAX_W = 1400, MAX_H = 1000;
const canvasJpeg = (c: HTMLCanvasElement) => fromBase64(c.toDataURL("image/jpeg", 0.85).split(",")[1] || "");
async function imageJpeg(src: string): Promise<{ jpeg: Uint8Array; width: number; height: number } | null> {
  const img = new Image();
  img.src = src;
  try { await img.decode(); } catch { return null; }
  const k = Math.min(1, MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return { jpeg: canvasJpeg(c), width: c.width, height: c.height };
}
/** A flow drawing on white: its strokes and its comments as yellow notes, the flow's name on top (Business Map analysePictures.ts). */
function drawingJpeg(d: Drawing, title: string): { jpeg: Uint8Array; width: number; height: number } {
  const xs: number[] = [], ys: number[] = [];
  d.strokes.forEach(s => s.pts.forEach(p => { xs.push(p[0]); ys.push(p[1]); }));
  d.comments.forEach(c => { xs.push(c.x, c.x + 260); ys.push(c.y, c.y + 60); });
  const x0 = Math.min(...xs, 0), y0 = Math.min(...ys, 0), x1 = Math.max(...xs, 400), y1 = Math.max(...ys, 300);
  const pad = 40, top = 50, k = Math.min(1, (MAX_W - 2 * pad) / (x1 - x0), (MAX_H - top - pad) / (y1 - y0));
  const c = document.createElement("canvas");
  c.width = Math.round((x1 - x0) * k + 2 * pad); c.height = Math.round((y1 - y0) * k + top + pad);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#222"; g.font = "bold 20px Segoe UI, Arial"; g.fillText(title, pad, 32);
  const X = (x: number) => pad + (x - x0) * k, Y = (y: number) => top + (y - y0) * k;
  for (const s of d.strokes) {
    g.strokeStyle = s.colour || "#C50F1F"; g.lineWidth = Math.max(2, (s.size || 4) * k); g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); s.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.stroke();
  }
  g.font = "16px Segoe UI, Arial";
  d.comments.forEach((cm, i) => {
    const x = X(cm.x), y = Y(cm.y), w = Math.min(320, 14 + g.measureText(cm.text).width);
    g.fillStyle = "#FFF4CE"; g.strokeStyle = "#C50F1F"; g.lineWidth = 2; g.fillRect(x, y, w, 30); g.strokeRect(x, y, w, 30);
    g.fillStyle = "#222"; g.fillText((i + 1) + ": " + cm.text, x + 7, y + 20, w - 14);
  });
  return { jpeg: canvasJpeg(c), width: c.width, height: c.height };
}
const browserInflate: Inflate = async raw => {
  const ds = new (globalThis as any).DecompressionStream("deflate-raw");
  return new Uint8Array(await new Response(new Blob([raw as any]).stream().pipeThrough(ds)).arrayBuffer());
};

/** An upload as the run takes it: read as text, sent as a file, or a picture converted to JPEG; or why it can't go. */
export async function readUpload(file: File): Promise<{ ok: true; doc: RunDocument } | { ok: false; why: string }> {
  const way = uploadWay(file.name, file.type, file.size);
  if (way.ok === false) return { ok: false, why: way.why };
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    if (way.way === "text") {
      const ex = await readTextUpload(file.name, way.kind, bytes, browserInflate);
      const text = extractedText(ex);
      if (!text.trim()) return { ok: false, why: "No text was found in it." };
      return { ok: true, doc: { name: file.name, text, note: "read as text" + (ex.pictures ? "; " + ex.pictures + (ex.pictures === 1 ? " picture" : " pictures") + " inside not read" : "") } };
    }
    if (way.way === "picture") {
      const url = URL.createObjectURL(file);
      try {
        const j = await imageJpeg(url);
        if (!j) return { ok: false, why: "The picture could not be read." };
        return { ok: true, doc: { name: file.name, file: { mimeType: "image/jpeg", base64: toBase64(j.jpeg), pages: 1 }, note: "converted to JPEG" } };
      } finally { URL.revokeObjectURL(url); }
    }
    if (way.mimeType === "application/pdf") { const p = pdfProblem(bytes); if (p) return { ok: false, why: p }; }
    return { ok: true, doc: { name: file.name, file: { mimeType: way.mimeType, base64: toBase64(bytes), pages: 1 }, note: way.mimeType === "application/pdf" ? "sent as PDF" : "sent as a picture" } };
  } catch (e: any) { return { ok: false, why: "It could not be read: " + (e?.message || e) }; }
}

/** What a run reads: the workshop's lines and pictures, the agenda's flows, the documents. */
export interface RunInputs {
  model: Model; workshop: Workshop | null; shots: Screenshot[]; documents: RunDocument[];
  activities: Record<string, Activity[]>; lines: TimelineLine[]; processIds: string[]; task: Task; drawings: { flowId: string; flowName: string; drawing: Drawing }[];
}
/** Loads the flows and builds the timeline; called once when the Analyse step opens and again before a run. */
export async function gather(repo: Repository, m: Model, w: Workshop | null, shots: Screenshot[], documents: RunDocument[]): Promise<RunInputs> {
  const processIds = w ? Array.from(new Set(w.session.processIds.concat(w.session.visits.map(v => v.key.split("#")[0])))).filter(id => m.items.some(x => x.id === id && x.level === 3)) : [];
  const drawn = w ? readDrawings(w.drawings) : {};
  const flowIds = new Set(processIds.map(id => flowFor(m, id)?.id).filter(Boolean) as string[]);
  Object.keys(drawn).forEach(id => flowIds.add(id));
  const activities: Record<string, Activity[]> = {};
  for (const id of Array.from(flowIds)) { try { activities[id] = await loadActivities(repo.g, id); } catch { activities[id] = []; } }
  const drawings = Object.entries(drawn).map(([flowId, drawing]) => ({ flowId, flowName: m.flows.find(f => f.id === flowId)?.name || "a flow", drawing }));
  const lines = w ? timeline({
    lines: linesOf(w.transcript), start: w.session.transcriptStart || w.session.visits[0]?.at || null, visits: w.session.visits,
    shots: shots.map(s => ({ id: s.id, subject: s.subject, createdOn: s.createdOn, text: shotText(s.note || s.subject) })),
    drawings: drawings.map(d => ({ ...d, stepName: (code: string) => (activities[d.flowId] || []).find(a => a.code === code)?.name })),
  }) : [];
  const task: Task = w ? { kind: "workshop", name: w.name, date: w.heldOn, kindName: kindLabel(w) } : { kind: "draft" };
  return { model: m, workshop: w, shots, documents, activities, lines, processIds, task, drawings };
}

/** The calls of a run: the first with the transcript, pictures and text documents (and the first file), then one per further file. */
export function plan(i: RunInputs): RequestParts[] {
  const picture = buildPicture({ model: i.model, focusId: i.workshop?.itemId || null, processIds: i.processIds, activities: i.activities, workshopId: i.workshop?.id || null });
  const files = i.documents.filter(d => d.file).length;
  const base = { model: i.model, picture, lines: i.lines, activities: i.activities, task: i.task, documents: i.documents };
  const out = [buildRequest({ ...base, fileIndex: files ? 0 : null })];
  for (let k = 1; k < files; k++) out.push(buildRequest({ ...base, fileIndex: k, earlier: [{ ref: "…", object: "", text: "the first call's items" }] }));
  return out;
}
export function estimateOf(calls: RequestParts[], docs: RunDocument[], model: AiModel) {
  const sizes: CallSize[] = calls.map((c, k) => ({ chars: PROMPT_CHARS.analyse + requestChars(c), pictures: c.pictures.length, pages: c.documentFile?.file?.pages || 0 }));
  return estimateRun(sizes, model, 1);
}
export const estimateLine = (calls: RequestParts[], docs: RunDocument[], model: AiModel) => AI_MODEL_LABEL[model] + ": " + estimateText(estimateOf(calls, docs, model));

async function picturesPdf(repo: Repository, i: RunInputs, req: RequestParts): Promise<FileInput> {
  const pages: PdfPage[] = [];
  for (const p of req.pictures) {
    const l = i.lines.find(x => x.id === p.line);
    if (!l) continue;
    let pic: { jpeg: Uint8Array; width: number; height: number } | null = null;
    if (l.kind === "screenshot" && l.shotId) { const src = await repo.screenshotImage(l.shotId).catch(() => ""); pic = src ? await imageJpeg(src) : null; }
    else if (l.flowId) { const d = i.drawings.find(x => x.flowId === l.flowId); pic = d ? drawingJpeg(d.drawing, "Drawing on " + d.flowName) : null; }
    if (pic) pages.push({ heading: pageHeading(pages.length + 1, l.id, l.kind), ...pic });
    if (pages.length >= 49) break;
  }
  return pages.length ? fileInput("application/pdf", toBase64(documentPdf(pages))) : blankInput();
}

export interface RunProgress { call: number; calls: number; text: string }
/**
 * Runs the calls, joins the answers ("same" items into the first call's), checks them with every source the run sent,
 * and saves the suggestions with the run's log. A failed call is in the log; the others still count.
 */
export async function runAnalysis(repo: Repository, apply: (fn: (m: Model) => Promise<Model>) => Promise<void>, i: RunInputs, modelChoice: AiModel, onProgress: (p: RunProgress) => void): Promise<AiRun> {
  const calls = plan(i);
  const prompt = promptOf(i.model.workspace.settings.aiPrompts, "analyse", modelChoice);
  const why = await repo.g.promptReady(prompt);
  if (why) throw new Error("The AI analysis can't run: " + why + ".");
  const run = newRun(), t0 = Date.now(), log: AiRun["calls"] = [];
  let set: ChangeSet | null = null;
  const sources = new Map<string, GuardContext["sources"][number]>();
  for (const [k, req] of calls.entries()) {
    const name = k === 0 ? "transcript, pictures and documents" : "document " + (req.documentFile?.name || k + 1);
    onProgress({ call: k + 1, calls: calls.length, text: k === 0 && req.pictures.length ? "Drawing the pictures, then calling the prompt" : "Calling the prompt (" + name + ")" });
    const earlier = k && set ? set.items.map(x => ({ ref: x.ref, object: x.object, text: x.fields.text || x.fields.name || x.target })) : undefined;
    const r0 = k && earlier ? buildRequest({ model: i.model, picture: req.guard.picture, lines: i.lines, activities: i.activities, task: i.task, documents: i.documents, fileIndex: k, earlier }) : req;
    const inputs: Record<string, any> = {
      Context: r0.Context, Transcript: r0.Transcript, Documents: r0.Documents,
      Pictures: k === 0 ? await picturesPdf(repo, i, r0) : blankInput(),
      Document: r0.documentFile?.file ? fileInput(r0.documentFile.file.mimeType, r0.documentFile.file.base64) : blankInput(),
    };
    const r = await repo.g.predict(prompt, inputs);
    if (r.ok === false) {
      const s = r.filtered ? suspectLine(i.lines) : null;
      log.push({ name, ok: false, error: r.filtered ? "Microsoft's content filter blocked it" + (s ? " (line " + s + " reads like an instruction)" : "") : r.message, seconds: null });
      continue;
    }
    let got: ChangeSet;
    try { got = parseChangeSet(r.output); } catch (e: any) { log.push({ name, ok: false, error: "the answer could not be read: " + (e?.message || e), seconds: r.seconds }); continue; }
    r0.guard.sources.forEach(s => { if (!sources.has(s.id) || s.lines) sources.set(s.id, s); });
    set = set ? mergeSets(set, got, "d" + k).set : got;
    log.push({ name, ok: true, error: "", seconds: r.seconds });
  }
  if (!set) throw new Error("The AI analysis did not run: " + log.map(c => c.error).join("; ") + ".");
  const ctx: GuardContext = { ...calls[0].guard, sources: Array.from(sources.values()) };
  const guarded = guardChangeSet(set, ctx);
  const mapped = proposalsOf(guarded, ctx, i.model, { run, workshopId: i.workshop?.id || null, lines: i.lines });
  const entry = runLog(guarded, ctx, mapped, { run, at: new Date().toISOString(), task: i.workshop ? "workshop" : "draft", workshopId: i.workshop?.id || null, model: AI_MODEL_LABEL[modelChoice],
    seconds: Math.round((Date.now() - t0) / 1000), estimate: estimateText(estimateOf(calls, i.documents, modelChoice)), calls: log });
  onProgress({ call: calls.length, calls: calls.length, text: "Saving " + mapped.proposals.length + " suggestions" });
  await apply(m => repo.saveRun(m, mapped.proposals, entry));
  return entry;
}
