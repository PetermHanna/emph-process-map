// Workshops like Microsoft's: kinds and templates (Microsoft's workshop guides, map/schema/workshops.json), one session
// order (Prepare, Run the agenda, Analyse, Conclusion, Close), the scenario board, the storyline review with fit per step,
// the quick track, the next workshop in Microsoft's order, Microsoft's child tasks, and what Close writes.
// Pure code (no Dataverse, no UI) so it can be tested alone. The run is kept in the workshop's session JSON (`run`).
import { SCOPE, FIT_GAP, GAP_UNSPECIFIED, option, labelOf, MsValue } from "./codes";

// ---------- Microsoft's templates, as converted by map/schema/import-workshops.mjs ----------
export type TemplateKind = "board" | "storyline" | "deepdive";
/** EMPH's own discovery workshop (the business processes in scope, one by one) or one of Microsoft's three. */
export type WorkshopKindName = "discovery" | TemplateKind;
export interface MsQuestion { group: string; text: string; statement?: boolean; source: string }
export interface MsCard { area: string; group: string; text: string }
export interface MsTemplate {
  id: string; kind: TemplateKind; unit: string; unitNotInCatalog?: boolean; title: string; description: string; source: string;
  assumptions: string[]; objectives: string[]; agenda: string[]; stakeholders: { role: string; why: string }[]; questions: MsQuestion[];
  /** a board: its areas in the guide's order and names (the guide's codes may differ from the catalog's), cards and bands */
  areas?: { code: string; name: string }[]; cards?: MsCard[]; bands?: string[];
}
export interface Guidance { source: { name: string; repository: string; licence: string; files: string[]; importedOn: string }; templates: MsTemplate[] }

export const KINDS: { kind: WorkshopKindName; label: string; ours: string; what: string }[] = [
  { kind: "board", label: "Scenario board discovery", ours: "Scenario board", what: "Walk the board of one end-to-end process: areas, their scenarios, compliance and policies. Set the scope; keep or strike scenarios; mark the main path." },
  { kind: "storyline", label: "Storyline design review", ours: "Storyline review", what: "Show the main path in Dynamics 365 and check fit to standard step by step." },
  { kind: "deepdive", label: "Deep-dive design", ours: "Deep dive", what: "The detailed questions of one process area: rules, data, integrations." },
  { kind: "discovery", label: "Discovery (EMPH)", ours: "Discovery", what: "The business processes in scope one by one: owner, systems, flow, configuration, fit-gap." },
];
/** The workshop kind column (emph_kind, EMPH's list) for a kind. */
export const kindValue = (k: WorkshopKindName) => option("workshopKind", KINDS.find(x => x.kind === k)!.ours);
export const kindOfValue = (v: number | null | undefined): WorkshopKindName => KINDS.find(x => x.ours === labelOf("workshopKind", v))?.kind || "discovery";
/** Microsoft's workshop type per kind (Business Map's msTemplate.ts WORKSHOP_TYPE_OF_KIND); a discovery workshop has none. */
export const WORKSHOP_TYPE_OF_KIND: Record<TemplateKind, MsValue<"microsoftWorkshopType">> = { board: "Storyboard", storyline: "Storyline design review", deepdive: "Detailed design" };
/** Success by Design phase per kind (SbD Delivery Plan OCT 2026: board and storyline in Strategize, deep-dives in Implement - Design). */
export const SBD_PHASE_OF_KIND: Record<TemplateKind, MsValue<"sbdPhase">> = { board: "10 - Strategize", storyline: "10 - Strategize", deepdive: "32 - Implement - Design" };
/** Microsoft's child tasks of a workshop item (SbD Delivery Plan OCT 2026, e.g. 80.01.001-.003, 80.02.001-.004): the output checklist. */
export const WORKSHOP_CHILD_TASKS: Record<TemplateKind, { id: string; title: string }[]> = {
  board: [{ id: "001", title: "Create {area} user stories" }, { id: "002", title: "Configure {area} solution" }, { id: "003", title: "Design high-level solution architecture" }],
  storyline: [{ id: "001", title: "Document {area} gaps and RAID" }, { id: "002", title: "Refine user stories" }, { id: "003", title: "Plan detailed design workshops" }, { id: "004", title: "{area} design document" }],
  deepdive: [],
};
export interface ChildTask { id: string; title: string; done: boolean }
/**
 * The child tasks of a workshop: Microsoft's IDs under the template (80.01.001), {area} the end-to-end process's name in
 * lower case ("order to cash"), never the workshop's title (Business Map 3.44.2 bug 7: "Create quick track: ... user stories").
 */
export function childTasksOf(kind: WorkshopKindName, templateId: string, e2eName: string): ChildTask[] {
  if (kind === "discovery") return [];
  const area = e2eName.trim().toLowerCase();
  return WORKSHOP_CHILD_TASKS[kind].map(t => ({ id: (templateId ? templateId + "." : "") + t.id, title: t.title.replace("{area}", area).replace(/^\w/, c => c.toUpperCase()), done: false }));
}
export function readTasks(raw: string | null | undefined): ChildTask[] {
  try { const j = JSON.parse(raw || "[]"); return Array.isArray(j) ? j.filter(t => t && typeof t.id === "string" && typeof t.title === "string").map(t => ({ id: t.id, title: t.title, done: !!t.done })) : []; } catch { return []; }
}

const inUnit = (code: string, unit: string) => !unit || code === unit || code.startsWith(unit + ".");
/** The templates of a kind for an end-to-end process (by code), in Microsoft's ID order. */
export const templatesFor = (g: Guidance, kind: TemplateKind, e2eCode: string) =>
  g.templates.filter(t => t.kind === kind && inUnit(t.unit, e2eCode)).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
export const templateById = (g: Guidance, id: string | undefined) => (id ? g.templates.find(t => t.id === id) || null : null);
/** Microsoft's questions (not the lines to discuss) of a template, each with its source. */
export const questionsOf = (t: MsTemplate | null) => (t ? t.questions.filter(q => !q.statement) : []);
export const questionCount = (g: Guidance) => g.templates.reduce((n, t) => n + questionsOf(t).length, 0);

// ---------- one session order ----------
export const STEPS: { name: string; discuss: string; produces: string }[] = [
  { name: "Prepare", discuss: "Who comes, the template and its assumptions, the agenda", produces: "the workshop as it will run" },
  { name: "Run the agenda", discuss: "Each agenda line opens its tool: the board, the storyline review, the key questions, or a business process (scope, walk-through, flow, configuration, fit-gap)", produces: "scope and fit marks, answers, requirements, comments and RAID items" },
  { name: "Analyse", discuss: "What the workshop recorded: transcript lines used, screenshots, marks. The AI analysis comes later", produces: "the record of the workshop" },
  { name: "Conclusion", discuss: "One list for the room: agreed, not agreed or parked; read back; who was there", produces: "the agreed conclusion" },
  { name: "Close", discuss: "Write what was agreed, tick Microsoft's child tasks, plan the next workshop", produces: "a closed workshop and the next one" },
];
/** EMPH's seven phases before slice 3 (0 Prepare, 1 Scope, 2 Walk-through, 3 Process flow, 4 Configuration, 5 Fit-gap, 6 Summary) as a step. */
export const stepOfPhase = (phase: number) => (phase <= 0 ? 0 : phase <= 5 ? 1 : 3);
/** The five middle phases are now the tools of a business process line in Run the agenda. */
export type ProcessTab = "scope" | "walk" | "flow" | "config" | "fitgap";
export const PROCESS_TABS: { tab: ProcessTab; name: string; phase: number }[] = [
  { tab: "scope", name: "Scope", phase: 1 }, { tab: "walk", name: "Walk-through", phase: 2 }, { tab: "flow", name: "Process flow", phase: 3 },
  { tab: "config", name: "Configuration", phase: 4 }, { tab: "fitgap", name: "Fit-gap", phase: 5 },
];
export const tabOfPhase = (phase: number): ProcessTab => PROCESS_TABS.find(t => t.phase === phase)?.tab || "walk";

export type ToolName = "notes" | "questions" | "board" | "story" | "process";
export const TOOLS: { tool: ToolName; name: string }[] = [
  { tool: "notes", name: "Objectives and notes" }, { tool: "questions", name: "Key questions" }, { tool: "board", name: "Scenario board" },
  { tool: "story", name: "Storyline review" }, { tool: "process", name: "Business process" },
];
/** The tool a Microsoft agenda line opens unless the facilitator picks another. */
export function defaultTool(text: string, kind: WorkshopKindName): ToolName {
  const t = text.toLowerCase();
  if (/introduction|objectives|wrap-up|wrap up|next steps|closing/.test(t)) return "notes";
  if (kind === "board" && (/overview|scenario|board|discussion/.test(t) || /^\s*\d{2}\.\d{2}\b/.test(t))) return "board";
  if (/demonstrat|storyline|walkthrough|walk-through|fit-to-standard|fit to standard|fit-gap|fit gap/.test(t)) return "story";
  return "questions";
}
/** One line of the agenda: a Microsoft line (its tool), our own line, or a business process (tool "process", itemId). */
export interface AgendaLine { key: string; text: string; tool: ToolName; itemId?: string }

// ---------- the run (session JSON `run`) ----------
export type CardState = "keep" | "strike";
/** A card's mark; `links`: the process items (level 3, or a level 4 scenario) the card stands for, when the facilitator set them. */
export interface CardMark { state?: CardState; main?: boolean; note?: string; links?: string[] }
/** A scope decision of an end-to-end process or an area (Microsoft's Scope values) with a reason, proposed in the room. */
export interface ScopeMark { scope: number; reason?: string }
export type StepFitValue = "fits" | "differs" | "not_needed" | "not_in_standard";
export const STEP_FITS: { fit: StepFitValue; name: string; gap: boolean }[] = [
  { fit: "fits", name: "Fits", gap: false }, { fit: "differs", name: "Differs", gap: true },
  { fit: "not_needed", name: "Not needed", gap: false }, { fit: "not_in_standard", name: "Not in standard", gap: true },
];
/** Fit of one flow step: key "itemId#code". */
export interface StepFit { fit: StepFitValue; reason?: string; name: string }
/** A business process's fit gap status (and approach for a gap) proposed in the room. */
export interface ProcessFit { fitGap: number; approach?: number | null; reason?: string }
export type Verdict = "agreed" | "not_agreed" | "parked";
/** What Close wrote to one process item: the values before, so it can be undone. */
export interface Written { itemId: string; label: string; before: { scope: number | null; scopeReason: string; fitGap: number | null; gapApproach: number | null; fitGapReason: string } }
export interface RunState {
  kind: WorkshopKindName; template: string; unit: string;
  agenda: AgendaLine[]; agendaKey?: string; done: string[];
  /** the quick track: on, and Microsoft's lines it took out (they come back) */ track?: "quick"; hidden?: AgendaLine[];
  marks: Record<string, CardMark>; scope: Record<string, ScopeMark>; stepFit: Record<string, StepFit>; processFit: Record<string, ProcessFit>;
  mainPath: string[]; answers: Record<string, string>; verdicts: Record<string, Verdict>; present: string[];
  /** the tab of a business process line (scope, walk, flow, config, fitgap) */ tab?: ProcessTab;
  /** Close: what was written (undo puts the before values back), and when */ written?: Written[]; closedOn?: string;
}
export const emptyRun = (kind: WorkshopKindName = "discovery", template = "", unit = ""): RunState =>
  ({ kind, template, unit, agenda: [], done: [], marks: {}, scope: {}, stepFit: {}, processFit: {}, mainPath: [], answers: {}, verdicts: {}, present: [] });

const obj = (v: any) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const strs = (v: any) => (Array.isArray(v) ? v.filter((x: any) => typeof x === "string") : []);
const KIND_NAMES = ["discovery", "board", "storyline", "deepdive"];
const TOOL_NAMES = TOOLS.map(t => t.tool) as string[];
const lineOf = (x: any): AgendaLine | null => (x && typeof x.key === "string" && typeof x.text === "string" ? { key: x.key, text: x.text, tool: TOOL_NAMES.includes(x.tool) ? x.tool : "notes", ...(typeof x.itemId === "string" ? { itemId: x.itemId } : {}) } : null);
export function readRun(j: any): RunState | undefined {
  if (!j || typeof j !== "object") return undefined;
  const r = emptyRun(KIND_NAMES.includes(j.kind) ? j.kind : "discovery", typeof j.template === "string" ? j.template : "", typeof j.unit === "string" ? j.unit : "");
  return {
    ...r,
    agenda: (Array.isArray(j.agenda) ? j.agenda : []).map(lineOf).filter(Boolean) as AgendaLine[],
    ...(typeof j.agendaKey === "string" ? { agendaKey: j.agendaKey } : {}), done: strs(j.done),
    ...(j.track === "quick" ? { track: "quick" as const, hidden: (Array.isArray(j.hidden) ? j.hidden : []).map(lineOf).filter(Boolean) as AgendaLine[] } : {}),
    marks: Object.fromEntries(Object.entries(obj(j.marks)).filter(([, v]: [string, any]) => v && typeof v === "object").map(([k, v]: [string, any]) => [k, {
      ...(v.state === "keep" || v.state === "strike" ? { state: v.state } : {}), ...(v.main ? { main: true } : {}), ...(typeof v.note === "string" && v.note ? { note: v.note } : {}),
      ...(Array.isArray(v.links) ? { links: strs(v.links) } : {}) }])),
    scope: Object.fromEntries(Object.entries(obj(j.scope)).filter(([, v]: [string, any]) => v && Number.isFinite(v.scope)).map(([k, v]: [string, any]) => [k, { scope: v.scope, ...(typeof v.reason === "string" && v.reason.trim() ? { reason: v.reason.trim() } : {}) }])),
    stepFit: Object.fromEntries(Object.entries(obj(j.stepFit)).filter(([, v]: [string, any]) => v && STEP_FITS.some(f => f.fit === v.fit)).map(([k, v]: [string, any]) => [k, { fit: v.fit, name: String(v.name || ""), ...(typeof v.reason === "string" && v.reason ? { reason: v.reason } : {}) }])),
    processFit: Object.fromEntries(Object.entries(obj(j.processFit)).filter(([, v]: [string, any]) => v && Number.isFinite(v.fitGap)).map(([k, v]: [string, any]) => [k, { fitGap: v.fitGap, ...(Number.isFinite(v.approach) ? { approach: v.approach } : {}), ...(typeof v.reason === "string" && v.reason ? { reason: v.reason } : {}) }])),
    mainPath: strs(j.mainPath), answers: Object.fromEntries(Object.entries(obj(j.answers)).filter(([, v]) => typeof v === "string")) as Record<string, string>,
    verdicts: Object.fromEntries(Object.entries(obj(j.verdicts)).filter(([, v]) => v === "agreed" || v === "not_agreed" || v === "parked")) as Record<string, Verdict>,
    present: strs(j.present),
    ...(PROCESS_TABS.some(t => t.tab === j.tab) ? { tab: j.tab } : {}),
    ...(Array.isArray(j.written) ? { written: j.written.filter((x: any) => x && typeof x.itemId === "string" && x.before) } : {}),
    ...(typeof j.closedOn === "string" ? { closedOn: j.closedOn } : {}),
  };
}

let seq = 0;
export const lineKey = (prefix = "o") => prefix + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);
/** The agenda of a new workshop: Microsoft's lines with their tools, or one line per business process (discovery). */
export function newAgenda(kind: WorkshopKindName, t: MsTemplate | null, processes: { id: string; code: string; name: string }[]): AgendaLine[] {
  if (kind === "discovery" || !t) return processes.map(p => ({ key: "p:" + p.id, text: (p.code ? p.code + " " : "") + p.name, tool: "process" as const, itemId: p.id }));
  return t.agenda.map((text, i) => ({ key: t.id + ":agenda:" + (i + 1), text, tool: defaultTool(text, kind) }));
}
/** A discovery workshop keeps its agenda in line with the business processes picked in Prepare (session.processIds). */
export function syncProcessLines(run: RunState, processes: { id: string; code: string; name: string }[]): RunState {
  const own = run.agenda.filter(a => a.tool !== "process" || !a.itemId);
  const lines = processes.map(p => run.agenda.find(a => a.itemId === p.id) || { key: "p:" + p.id, text: (p.code ? p.code + " " : "") + p.name, tool: "process" as const, itemId: p.id });
  return { ...run, agenda: lines.concat(own) };
}
export const addLine = (run: RunState, text: string, tool: ToolName = "notes"): RunState => (text.trim() ? { ...run, agenda: run.agenda.concat({ key: lineKey(), text: text.trim(), tool }) } : run);
export const removeLine = (run: RunState, key: string): RunState => ({ ...run, agenda: run.agenda.filter(a => a.key !== key), done: run.done.filter(k => k !== key), ...(run.agendaKey === key ? { agendaKey: undefined } : {}) });
export const setTool = (run: RunState, key: string, tool: ToolName): RunState => ({ ...run, agenda: run.agenda.map(a => (a.key === key ? { ...a, tool } : a)) });
export function moveLine(run: RunState, key: string, delta: number): RunState {
  const list = run.agenda.slice(), i = list.findIndex(a => a.key === key), j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return run;
  [list[i], list[j]] = [list[j], list[i]];
  return { ...run, agenda: list };
}

// ---------- agenda: Previous and Next, at the top and the bottom ----------
export const currentLine = (run: RunState) => run.agenda.find(a => a.key === run.agendaKey) || run.agenda[0] || null;
export function agendaNeighbour(run: RunState, delta: 1 | -1): AgendaLine | null {
  const cur = currentLine(run);
  if (!cur) return null;
  return run.agenda[run.agenda.indexOf(cur) + delta] || null;
}
/** Next ticks the line it leaves; Next on the last line ticks it and says `end` (the screen goes on to Analyse). Previous on the first line changes nothing. */
export function moveAgenda(run: RunState, delta: 1 | -1): { run: RunState; end: boolean } {
  const cur = currentLine(run), to = agendaNeighbour(run, delta);
  const base = delta === 1 && cur ? { ...run, done: Array.from(new Set(run.done.concat(cur.key))) } : run;
  return to ? { run: { ...base, agendaKey: to.key }, end: false } : { run: base, end: delta === 1 && !!cur };
}
export const goLine = (run: RunState, key: string): RunState => (run.agenda.some(a => a.key === key) ? { ...run, agendaKey: key } : run);

// ---------- the scenario board ----------
export type BoardView = "full" | "overview";
/**
 * What a board line shows. "Overview of the X process": the areas in Microsoft's order with their scope, no cards. Any
 * other board line, the key scenarios included, shows the whole board with its cards (Peter for Business Map 3.44.4:
 * keep the board together); a line naming an area ("20.10 Establish a knowledge base") outlines that area.
 */
export function boardViewOf(text: string): { view: BoardView; area?: string } {
  const a = /^\s*(\d{2}\.\d{2})\b/.exec(text);
  if (a) return { view: "full", area: a[1] };
  return { view: /overview/i.test(text) ? "overview" : "full" };
}
export interface AreaItem { id: string; code: string; name: string; catalogName?: string; scope: number | null }
export interface ProcessRef { id: string; code: string; name: string; catalogName?: string; parentId: string | null; level: number; scope: number | null }
export interface BoardCard { key: string; group: string; text: string; /** the items it stands for without a mark: guessed (a guide card) or itself (a catalog card) */ links: string[]; catalog: boolean }
export interface BoardColumn { code: string; name: string; area: AreaItem | null; groups: { group: string; cards: BoardCard[] }[] }
const words = (s: string) => s.toLowerCase().replace(/&/g, " and ").split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));
const STOP = new Set(["and", "the", "for", "with", "from", "into", "management", "manage", "process", "processes", "business"]);
const stem = (w: string) => w.slice(0, Math.min(5, w.length));
const sameName = (a: string, b: string) => { const x = words(a).join(" "), y = words(b).join(" "); return !!x && x === y; };
/**
 * The catalog area of a board area: by name first (Microsoft's board codes differ from the catalog's in places, e.g.
 * board 50.55 = catalog 50.20; Business Map 3.44.2 bugs 1 and 8), then by code, then by most shared words.
 */
export function matchArea(code: string, name: string, areas: AreaItem[]): AreaItem | null {
  const byName = areas.find(a => sameName(a.catalogName || a.name, name) || sameName(a.name, name));
  if (byName) return byName;
  const byCode = areas.find(a => a.code === code);
  if (byCode) return byCode;
  const w = words(name).map(stem);
  let best: AreaItem | null = null, score = 1;
  for (const a of areas) { const s = words(a.catalogName || a.name).map(stem).filter(x => w.includes(x)).length; if (s > score) { score = s; best = a; } }
  return best;
}
/** The business process (level 3) of an area a guide card most likely stands for: the most shared words, at least one. */
export function guessLinks(text: string, processes: ProcessRef[]): string[] {
  const w = words(text).map(stem);
  let best: ProcessRef | null = null, score = 0;
  for (const p of processes) { const s = words(p.catalogName || p.name).map(stem).filter(x => w.includes(x)).length; if (s > score) { score = s; best = p; } }
  return best ? [best.id] : [];
}
/**
 * The board as columns, one per area. From Microsoft's guide when there is a board template (its areas, groups and cards);
 * else from the catalog: each area's business processes as groups and their level 4 scenarios as cards.
 */
export function boardColumns(t: MsTemplate | null, areas: AreaItem[], items: ProcessRef[]): BoardColumn[] {
  const l3 = (areaId: string) => items.filter(x => x.level === 3 && x.parentId === areaId).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  if (t && t.kind === "board" && t.areas?.length) {
    return t.areas.map(ba => {
      const area = matchArea(ba.code, ba.name, areas);
      const ps = area ? l3(area.id) : [];
      const groups: BoardColumn["groups"] = [];
      (t.cards || []).forEach((c, i) => {
        if (c.area !== ba.code) return;
        let g = groups.find(x => x.group === c.group);
        if (!g) { g = { group: c.group, cards: [] }; groups.push(g); }
        g.cards.push({ key: t.id + ":card:" + (i + 1), group: c.group, text: c.text, links: guessLinks(c.text, ps), catalog: false });
      });
      return { code: ba.code, name: ba.name, area, groups };
    });
  }
  return areas.slice().sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })).map(a => ({
    code: a.code, name: a.name, area: a,
    groups: l3(a.id).map(p => ({ group: p.code + " " + p.name, cards: items.filter(s => s.level === 4 && s.parentId === p.id).sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }))
      .map(s => ({ key: "item:" + s.id, group: p.name, text: s.name, links: [s.id], catalog: true })) })).filter(g => g.cards.length),
  }));
}
export const linksOf = (run: RunState, c: BoardCard) => run.marks[c.key]?.links ?? c.links;
export function setMark(run: RunState, key: string, m: CardMark): RunState {
  const marks = { ...run.marks }, verdicts = { ...run.verdicts };
  const clean: CardMark = { ...(m.state ? { state: m.state } : {}), ...(m.main ? { main: true } : {}), ...(m.note ? { note: m.note } : {}), ...(m.links ? { links: m.links } : {}) };
  if ((marks[key]?.state || "") !== (clean.state || "") || !!marks[key]?.main !== !!clean.main) delete verdicts["card:" + key];
  if (Object.keys(clean).length) marks[key] = clean; else delete marks[key];
  return { ...run, marks, verdicts };
}
/** Sets or clears (null) the scope proposal of an end-to-end process or area; a change drops its verdict. */
export function setScopeMark(run: RunState, itemId: string, mark: ScopeMark | null): RunState {
  const scope = { ...run.scope }, verdicts = { ...run.verdicts };
  const old = scope[itemId];
  if (mark) scope[itemId] = { scope: mark.scope, ...(mark.reason?.trim() ? { reason: mark.reason.trim() } : {}) }; else delete scope[itemId];
  if (!mark || !old || old.scope !== mark.scope || (old.reason || "") !== (mark.reason?.trim() || "")) delete verdicts["scope:" + itemId];
  return { ...run, scope, verdicts };
}
/** The scope that shows for an item: the room's proposal, else today's. */
export const scopeShown = (run: RunState, it: { id: string; scope: number | null }) => run.scope[it.id]?.scope ?? it.scope;
/** Out of scope or Not applicable: the board greys the area (or the whole board) and folds its cards. */
export const scopeOff = (s: number | null | undefined) => s === SCOPE.out || s === SCOPE.na;
export function boardCounts(cols: BoardColumn[], run: RunState) {
  const cards = cols.flatMap(c => c.groups.flatMap(g => g.cards));
  const m = run.marks;
  return { cards: cards.length, kept: cards.filter(c => m[c.key]?.state === "keep").length, struck: cards.filter(c => m[c.key]?.state === "strike").length, main: cards.filter(c => m[c.key]?.main).length };
}

// ---------- the storyline review ----------
export const stepKey = (itemId: string, code: string) => itemId + "#" + code;
export function setStepFit(run: RunState, key: string, f: StepFit | null): RunState {
  const stepFit = { ...run.stepFit };
  if (f) stepFit[key] = { fit: f.fit, name: f.name, ...(f.reason?.trim() ? { reason: f.reason.trim() } : {}) }; else delete stepFit[key];
  return { ...run, stepFit };
}
/** Sets or clears a business process's fit-gap proposal; a gap keeps its approach (10 - Unspecified until chosen). A change drops its verdict. */
export function setProcessFit(run: RunState, itemId: string, f: ProcessFit | null): RunState {
  const processFit = { ...run.processFit }, verdicts = { ...run.verdicts };
  if (f) processFit[itemId] = { fitGap: f.fitGap, ...(f.fitGap === FIT_GAP.gap ? { approach: f.approach ?? GAP_UNSPECIFIED } : {}), ...(f.reason?.trim() ? { reason: f.reason.trim() } : {}) }; else delete processFit[itemId];
  delete verdicts["pfit:" + itemId];
  return { ...run, processFit, verdicts };
}
/** A business process's fit read from its steps: any step that differs or isn't in the standard makes a Gap, all steps marked and none a gap a Fit, else nothing. */
export function fitFromSteps(run: RunState, itemId: string, stepCodes: string[]): number | null {
  const marked = stepCodes.map(c => run.stepFit[stepKey(itemId, c)]).filter(Boolean);
  if (marked.some(f => STEP_FITS.find(x => x.fit === f.fit)!.gap)) return FIT_GAP.gap;
  return stepCodes.length && marked.length === stepCodes.length ? FIT_GAP.fit : null;
}
export const toggleMainPath = (run: RunState, itemId: string): RunState => ({ ...run, mainPath: run.mainPath.includes(itemId) ? run.mainPath.filter(x => x !== itemId) : run.mainPath.concat(itemId) });
/**
 * The business processes the storyline review walks: level 3 under the end-to-end process, not Not applicable, whose area
 * is in scope as the room has it now (Business Map 3.44.2 bug 3: no processes of out-of-scope areas). Main path first.
 */
export function storyProcesses<T extends ProcessRef>(run: RunState, items: T[], e2eId: string): T[] {
  const areas = items.filter(a => a.level === 2 && a.parentId === e2eId && scopeShown(run, a) === SCOPE.in);
  const ps = items.filter(p => p.level === 3 && areas.some(a => a.id === p.parentId) && !scopeOff(scopeShown(run, p)));
  return ps.sort((a, b) => Number(run.mainPath.includes(b.id)) - Number(run.mainPath.includes(a.id)) || a.code.localeCompare(b.code, undefined, { numeric: true }));
}
/** A demo link: a URL or a note for a business process (code) or one of its flow steps (code#step), kept in the workspace settings. */
export interface DemoLink { code: string; step?: string; url: string; note?: string }
/** The demo link of a step, else of its business process. */
export const demoLinkOf = (links: DemoLink[], code: string, step?: string) => (step ? links.find(l => l.code === code && l.step === step) : null) || links.find(l => l.code === code && !l.step) || null;

// ---------- the quick track ----------
/**
 * One session per end-to-end process: the board, the storyline review and the fit-to-standard together. Microsoft has no
 * workshop of that name; each step is from Microsoft's guidance (Dynamics 365 implementation guide, "About workshops" and
 * "Fit-to-standard and fit-gap analysis"): a smaller group prepares scope and main path as a proposal; the room starts with
 * the core scenarios; the board is followed by the process shown in Dynamics 365, fit or gap per process; deep-dives only
 * for the areas with gaps. Made from a scenario board workshop; Microsoft's own lines are put aside and come back.
 */
export const QUICK_AGENDA: { text: string; tool: ToolName }[] = [
  { text: "Introduction and objectives", tool: "notes" },
  { text: "Overview: confirm the proposed scope (the room changes only what is wrong)", tool: "board" },
  { text: "Key scenarios: confirm the main path, core scenarios first", tool: "board" },
  { text: "Fit-to-standard: show the main path in Dynamics 365, fit or gap per process", tool: "story" },
  { text: "Wrap-up: gaps that need a deep-dive, and next steps", tool: "notes" },
];
export const isQuickLine = (key: string) => key.startsWith("qt-");
export function toQuickTrack(run: RunState): RunState {
  if (run.track === "quick" || run.kind !== "board") return run;
  const lines = QUICK_AGENDA.map((x, i) => ({ key: "qt-" + (i + 1), text: x.text, tool: x.tool }));
  return { ...run, track: "quick", hidden: run.agenda, agenda: lines, agendaKey: lines[0].key, done: [] };
}
export function fromQuickTrack(run: RunState): RunState {
  if (run.track !== "quick") return run;
  const { track, hidden, ...rest } = run;
  return { ...rest, agenda: hidden || [], agendaKey: undefined, done: run.done.filter(k => !isQuickLine(k)) };
}
/** The proposal made before the workshop: today's decided scope of the end-to-end process and its areas, where nothing is marked yet. */
export function proposeScope(run: RunState, today: { id: string; scope: number | null }[]): { run: RunState; proposed: number } {
  let r = run, n = 0;
  for (const t of today) if (!run.scope[t.id] && t.scope != null && t.scope !== SCOPE.unspecified) { r = setScopeMark(r, t.id, { scope: t.scope, reason: "Proposed before the workshop" }); n++; }
  return { run: r, proposed: n };
}
/** Whether the fit-to-standard recorded anything (a step's fit or a process's fit-gap): nothing checked is "not checked", never "no gap". */
export const fitChecked = (run: RunState) => Object.keys(run.stepFit).length > 0 || Object.keys(run.processFit).length > 0;
/** The areas (item ids) where the fit-to-standard found a gap: a process proposed as Gap, or a step that differs or isn't in the standard. */
export function gapAreas(run: RunState, items: ProcessRef[]): string[] {
  const gapItems = Object.entries(run.processFit).filter(([, f]) => f.fitGap === FIT_GAP.gap).map(([id]) => id)
    .concat(Object.entries(run.stepFit).filter(([, f]) => STEP_FITS.find(x => x.fit === f.fit)!.gap).map(([k]) => k.split("#")[0]));
  const area = (id: string) => { const p = items.find(x => x.id === id); return p ? (p.level === 2 ? p.id : p.parentId) : null; };
  return Array.from(new Set(gapItems.map(area).filter(Boolean) as string[]));
}

// ---------- the next workshop in Microsoft's order ----------
export interface HeldWorkshop { kind: WorkshopKindName; template: string; unit: string; closed: boolean; quick?: boolean; checked?: boolean; gapAreas?: { code: string; name: string }[] }
export interface NextProposal { template: MsTemplate; why: string }
/** A deep-dive belongs to an area by its code, or by the area's name in its title (the guides' codes differ from the catalog's in places). */
const deepFor = (t: MsTemplate, a: { code: string; name: string }) => t.unit === a.code || t.title.toLowerCase().includes(a.name.toLowerCase());
/**
 * Microsoft's order per end-to-end process: scenario board, storyline design review, the deep-dives of its areas in scope.
 * A quick track that fit-checked something stands for the board and the storyline review, and then only the gap areas get
 * a deep-dive; a quick track that checked nothing stands for the board only (Business Map 3.44.2 bug 2). When an end-to-end
 * process is done, the next one in scope follows. `areasInScope`: per end-to-end code, its areas in scope.
 */
export function nextTemplate(g: Guidance, current: HeldWorkshop, held: HeldWorkshop[], e2eInScope: string[], areasInScope: Record<string, { code: string; name: string }[]>): NextProposal | null {
  const all = held.concat({ ...current, closed: true });
  const isDone = (t: MsTemplate) => all.some(h => h.closed && h.template === t.id);
  const forE2e = (e: string): NextProposal | null => {
    const quick = all.filter(h => h.quick && h.closed && h.unit.slice(0, 2) === e);
    const checked = quick.filter(h => h.checked);
    const board = templatesFor(g, "board", e)[0];
    if (board && !isDone(board) && !quick.length) return { template: board, why: "Microsoft's order starts with the scenario board of " + e + "." };
    const story = templatesFor(g, "storyline", e)[0];
    if (story && !isDone(story) && !checked.length) return { template: story, why: quick.length ? "The quick track of " + e + " fit-checked nothing, so the storyline design review still follows." : "After the scenario board comes the storyline design review of " + e + "." };
    const areas = areasInScope[e] || [];
    const gaps = checked.flatMap(h => h.gapAreas || []);
    const want = checked.length ? areas.filter(a => gaps.some(x => x.code === a.code)) : areas;
    for (const a of want) {
      const deep = templatesFor(g, "deepdive", e).find(t => !isDone(t) && deepFor(t, a));
      if (deep) return { template: deep, why: checked.length ? "Quick track: a deep-dive only where the fit-to-standard found a gap (" + a.code + " " + a.name + ")." : "After the storyline review come the deep-dives of the areas in scope, in order (" + a.code + " " + a.name + ")." };
    }
    return null;
  };
  const e = current.unit.slice(0, 2);
  if (e) { const n = forE2e(e); if (n) return n; }
  for (const x of e2eInScope.filter(c => c !== e).sort()) {
    const n = forE2e(x);
    if (n) return { template: n.template, why: (e ? "Microsoft's workshops of " + e + " are held. " : "") + "Next end-to-end process in scope: " + x + ". " + n.why };
  }
  return null;
}

// ---------- the conclusion ----------
export interface ConclusionItem { key: string; kind: string; text: string }
export interface ItemNames { name: (id: string) => string; scopeLabel: (v: number) => string; fitLabel: (f: ProcessFit) => string }
/** The items the room agrees, which Close writes: scope proposals, cards struck, kept or on the main path, fit-gap proposals. */
export function conclusionItems(run: RunState, cards: BoardCard[], n: ItemNames): ConclusionItem[] {
  const out: ConclusionItem[] = [];
  for (const [id, s] of Object.entries(run.scope)) out.push({ key: "scope:" + id, kind: "Scope: " + n.scopeLabel(s.scope), text: n.name(id) + (s.reason ? ": " + s.reason : "") });
  for (const c of cards) {
    const m = run.marks[c.key];
    if (!m || (!m.state && !m.main)) continue;
    const links = linksOf(run, c).map(n.name).filter(Boolean);
    out.push({ key: "card:" + c.key, kind: m.state === "strike" ? "Scenario struck" : m.main ? "Main path" : "Scenario kept", text: (c.group ? c.group + ": " : "") + c.text + (m.state === "strike" ? (links.length ? " → out: " + links.join(", ") : " (stands for no process: nothing changes)") : "") });
  }
  for (const [id, f] of Object.entries(run.processFit)) out.push({ key: "pfit:" + id, kind: "Fit gap: " + n.fitLabel(f), text: n.name(id) + (f.reason ? ": " + f.reason : "") });
  return out;
}
export const agreeRest = (run: RunState, items: ConclusionItem[]): RunState => ({ ...run, verdicts: { ...Object.fromEntries(items.map(i => [i.key, "agreed" as Verdict])), ...run.verdicts } });
export function conclusionCounts(items: ConclusionItem[], run: RunState) {
  const v = run.verdicts, k = (x: Verdict) => items.filter(i => v[i.key] === x).length;
  return { agreed: k("agreed"), notAgreed: k("not_agreed"), parked: k("parked"), open: items.filter(i => !v[i.key]).length };
}
export function closeWarnings(items: ConclusionItem[], run: RunState, tasks: ChildTask[]): string[] {
  const c = conclusionCounts(items, run), out: string[] = [];
  if (c.open) out.push(c.open + " conclusion " + (c.open === 1 ? "item has" : "items have") + " no verdict: Close writes only what is agreed.");
  if (!run.present.length) out.push("Nobody is marked as present.");
  if (run.track === "quick" && !fitChecked(run)) out.push("The quick track fit-checked nothing: the storyline review and the deep-dives still follow.");
  const open = tasks.filter(t => !t.done).length;
  if (open) out.push(open + " of Microsoft's child tasks " + (open === 1 ? "is" : "are") + " not ticked.");
  return out;
}

// ---------- what Close writes ----------
export interface ItemNow { id: string; level: number; code: string; name: string; scope: number | null; scopeReason: string; fitGap: number | null; gapApproach: number | null; fitGapReason: string }
export interface Change { itemId: string; label: string; patch: Partial<Pick<ItemNow, "scope" | "scopeReason" | "fitGap" | "gapApproach" | "fitGapReason">> }
/**
 * The changes Close makes, only for what the room agreed: scope of end-to-end processes and areas; a struck card takes the
 * items it stands for out (a business process 40 - Not applicable, the only Scope a level 3 takes besides Unspecified;
 * a scenario 30 - Out of scope); fit-gap of business processes. Items already so are left out. Pure, so it can be tested.
 */
export function closeChanges(run: RunState, cards: BoardCard[], items: ItemNow[], workshop: string): Change[] {
  const v = run.verdicts, out: Change[] = [], byId = new Map(items.map(x => [x.id, x]));
  const label = (it: ItemNow, what: string) => (it.code ? it.code + " " : "") + it.name + ": " + what;
  for (const [id, s] of Object.entries(run.scope)) {
    const it = byId.get(id);
    if (!it || v["scope:" + id] !== "agreed" || it.level > 2) continue;
    if (it.scope === s.scope && (it.scopeReason || "") === (s.reason || "")) continue;
    out.push({ itemId: id, label: label(it, labelOf("scope", s.scope)), patch: { scope: s.scope, scopeReason: s.reason || "" } });
  }
  for (const c of cards) {
    if (run.marks[c.key]?.state !== "strike" || v["card:" + c.key] !== "agreed") continue;
    for (const id of linksOf(run, c)) {
      const it = byId.get(id);
      if (!it || it.level < 3 || out.some(x => x.itemId === id)) continue;
      const scope = it.level === 3 ? SCOPE.na : SCOPE.out;
      if (it.scope === scope) continue;
      out.push({ itemId: id, label: label(it, labelOf("scope", scope) + " (card struck: " + c.text + ")"), patch: { scope, scopeReason: "Struck on the scenario board in " + workshop + ": " + c.text } });
    }
  }
  for (const [id, f] of Object.entries(run.processFit)) {
    const it = byId.get(id);
    if (!it || v["pfit:" + id] !== "agreed" || it.level < 3) continue;
    const approach = f.fitGap === FIT_GAP.gap ? f.approach ?? GAP_UNSPECIFIED : null;
    if (it.fitGap === f.fitGap && it.gapApproach === approach) continue;
    const prev = out.find(x => x.itemId === id);
    const patch = { fitGap: f.fitGap, gapApproach: approach, fitGapReason: f.reason || it.fitGapReason };
    if (prev) { prev.patch = { ...prev.patch, ...patch }; prev.label += "; " + labelOf("fitGapStatus", f.fitGap); }
    else out.push({ itemId: id, label: label(it, labelOf("fitGapStatus", f.fitGap) + (approach != null ? " (" + labelOf("gapSolutionApproach", approach) + ")" : "")), patch });
  }
  return out;
}
/** A gap waits for its approach: Close refuses an agreed Gap with 10 - Unspecified (Microsoft: a Gap needs a gap solution approach). */
export const closeProblems = (changes: Change[]) => changes.filter(c => c.patch.fitGap === FIT_GAP.gap && (c.patch.gapApproach == null || c.patch.gapApproach === GAP_UNSPECIFIED)).map(c => c.label + ": pick a gap solution approach first.");
export const beforeOf = (it: ItemNow): Written["before"] => ({ scope: it.scope, scopeReason: it.scopeReason, fitGap: it.fitGap, gapApproach: it.gapApproach, fitGapReason: it.fitGapReason });
