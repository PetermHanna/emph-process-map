// Workshops like Microsoft's: EMPH's discovery workshop or one made from Microsoft's templates (scenario board, storyline
// design review, deep-dive), all in one session order: Prepare, Run the agenda, Analyse, Conclusion, Close.
import * as React from "react";
import { Button, Field, Input, Switch, Checkbox, Tooltip, ToggleButton, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Spinner } from "@fluentui/react-components";
import { ChevronLeft20Regular, ChevronRight20Regular, Delete16Regular, Screenshot20Regular, TextQuote20Regular, ArrowUp16Regular, ArrowDown16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Pill, Pick, Choice, ListChoice, FitGapPick, Edit, AddBox, Empty, ScopePick } from "../kit";
import type { Nav } from "../Shell";
import { SESSION, LICENCE_LABEL, HOW, RAID, RAID_STATUS, SYSTEM, FIT_GAP, APPROVAL, labelOf, option } from "../../domain/codes";
import { visit, readBackItems, transcriptDecisions, sourceLine, usedLines, processKeyOf, activityCodeOf, reviewOf, undoRule, withReview, isFacilitator, reviewCounts, ReviewType, PrepSection } from "../../domain/session";
import { isActive, levelUp, isOff } from "../../domain/rules";
import { childItems, effectiveScope, flowsOf, itemsAt, loadActivities, How } from "../../domain/repository";
import {
  STEPS, TOOLS, PROCESS_TABS, KINDS, RunState, AgendaLine, ToolName, ProcessTab, WorkshopKindName, emptyRun, newAgenda, syncProcessLines, addLine, removeLine, setTool, moveLine,
  currentLine, moveAgenda, goLine, agendaNeighbour, templateById, templatesFor, questionsOf, boardColumns, conclusionItems, toQuickTrack, fromQuickTrack, proposeScope, kindOfValue, MsTemplate,
} from "../../domain/workshop";
import type { Workshop, ProcessItem, Screenshot, Activity, Model, CurrentSystem } from "../../domain/types";
import { DecisionRow } from "./Processes";
import { Capture, RequirementList, CaptureFrom } from "./Requirements";
import { TranscriptPanel, LineUse, Line, LineState, grabScreen, linesOf } from "./Transcript";
import { ShotAnnotate, burnIn } from "./ShotAnnotate";
import { MeetingRequest } from "./WorkshopMeeting";
import { noteWithMarks, marksOf, shotText, readDrawings } from "../../domain/drawing";
import { FacilitatorAgenda, FlowWalk, LicenceDialog } from "./WorkshopParts";
import { BoardTool } from "./WorkshopBoard";
import { StoryTool } from "./WorkshopStory";
import { Conclusion, Close, kindLabel, peopleOf } from "./WorkshopClose";
import { FlowStudio } from "../flow/FlowStudio";
import { GUIDANCE } from "../guidance";
import { AiAnalyse } from "./AiAnalyse";
import { AiQuestions } from "./AiQuestions";

const anyInScope = (m: Model) => itemsAt(m, 3).some(p => effectiveScope(m, p));
/** Systems used today for a business process: on the process itself or on its area. */
const systemsFor = (m: Model, p: ProcessItem): CurrentSystem[] => { const a = levelUp(m.items, p, 2); return m.systems.filter(s => s.itemId === p.id || (a && s.itemId === a.id)); };
const KIND_LABELS = Object.fromEntries(KINDS.map((k, i) => [i, k.label])) as Record<number, string>;
const TOOL_LABELS = Object.fromEntries(TOOLS.map((t, i) => [i, t.name])) as Record<number, string>;
/** The run of a workshop; a discovery workshop saved before slice 3 gets one from its business processes. */
const runOf = (w: Workshop, m: Model): RunState => w.session.run
  || { ...emptyRun("discovery"), agenda: newAgenda("discovery", null, w.session.processIds.map(id => m.items.find(x => x.id === id)).filter(Boolean) as ProcessItem[]) };

export function Workshops({ model, repo, apply }: PageProps & { nav: Nav }) {
  const l = useLook();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [e2e, setE2e] = React.useState<string | null>(null);
  const [kindIx, setKindIx] = React.useState<number>(KINDS.findIndex(k => k.kind === "discovery"));
  const [tplId, setTplId] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState(false);
  const kind = KINDS[kindIx].kind;
  const e2eItem = model.items.find(x => x.id === e2e) || null;
  const tpls = kind !== "discovery" && e2eItem ? templatesFor(GUIDANCE, kind, e2eItem.code) : [];
  const tpl = tpls.find(t => t.id === tplId) || tpls[0] || null;
  React.useEffect(() => setTplId(null), [kindIx, e2e]);
  const w = model.workshops.find(x => x.id === openId);
  if (w) return <Runner w={w} model={model} repo={repo} apply={apply} onBack={() => setOpenId(null)} onOpen={setOpenId} />;
  const canStart = kind === "discovery" ? anyInScope(model) : !!e2eItem;
  const start = () => { setProblem(null); apply(async m => { const r = await repo.addWorkshop(m, e2e, { kind, template: tpl }); setOpenId(r.workshop.id); return r.model; }).catch(e => setProblem(String(e?.message || e))); };
  return (
    <>
      <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className={l.row}>
          <span>New</span>
          <span data-emph="workshop-kind"><Choice value={kindIx} labels={KIND_LABELS} onChange={v => setKindIx(v ?? 0)} width={220} /></span>
          <span>for</span>
          <Pick value={e2e} items={itemsAt(model, 1).filter(x => kind === "board" || effectiveScope(model, x)).map(x => ({ ...x, name: x.code + " " + x.name + (kind === "board" && !effectiveScope(model, x) ? " (not in scope yet)" : "") }))} onChange={setE2e} placeholder={kind === "discovery" ? "All in scope" : "Pick an end-to-end process"} width={260} />
          {tpls.length > 1 && <span data-emph="workshop-template"><Pick value={tpl?.id || null} items={tpls.map(t => ({ id: t.id, name: t.id + " " + t.title }))} onChange={setTplId} width={320} /></span>}
          <Button appearance="primary" data-emph="workshop-new" disabled={!canStart} onClick={start}>Start</Button>
        </div>
        <div className={l.muted} style={{ fontSize: 12 }}>
          {KINDS[kindIx].what}{kind !== "discovery" && e2eItem && (tpl ? " Microsoft's template: " + tpl.id + " " + tpl.title + "." : " Microsoft has no template of this kind for " + e2eItem.name + ": Microsoft's usual agenda instead.")}
          {kind === "discovery" && !anyInScope(model) && " Put business processes in scope on Our processes first."}
        </div>
        {problem && <div style={{ color: C.bad }}>{problem}</div>}
      </div>
      {model.workshops.length === 0 ? <Empty title="No workshops yet" text="A workshop walks through the processes with the people who run them and records what you decide, in Microsoft's order: scenario board, storyline review, deep-dives." /> : (
        <div className={l.card}>
          <table className={l.table}>
            <thead><tr><th>Workshop</th><th>Kind</th><th>Date</th><th>Facilitator</th><th>Step</th><th>Status</th><th /></tr></thead>
            <tbody>{model.workshops.map(x => (
              <tr key={x.id} className={l.tr} onClick={() => setOpenId(x.id)}>
                <td>{x.name}</td><td style={{ fontSize: 12 }}>{kindLabel(x)}</td><td>{x.heldOn || ""}</td><td>{x.facilitator}</td><td>{x.phase + 1}. {STEPS[x.phase].name}</td>
                <td><Pill text={x.status === SESSION.closed ? "Closed" : "Open"} tone={x.status === SESSION.closed ? "neutral" : "brand"} /></td>
                <td onClick={e => e.stopPropagation()}><Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete " + x.name + "? Requirements captured in it stay.")) apply(m => repo.deleteWorkshop(m, x)); }} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className={l.card} data-emph="ai-draft-card">
        <div className={l.row} style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 13 }}><b>Draft from documents</b> <span className={l.muted}>· processes, fit-gap, flows, requirements and open questions from the organisation's own documents, with or without a workshop. An AI suggests; you decide.</span></span>
          <Button size="small" data-emph="ai-draft-toggle" onClick={() => setDraft(d => !d)}>{draft ? "Hide" : "Open"}</Button>
        </div>
        {draft && <AiAnalyse model={model} repo={repo} apply={apply} w={null} shots={[]} />}
      </div>
      <div className={l.muted} style={{ fontSize: 11 }}>Microsoft's workshop templates: {GUIDANCE.templates.length} templates from <a href={GUIDANCE.source.repository} target="_blank" rel="noreferrer">microsoft/dynamics365patternspractices</a> ({GUIDANCE.source.importedOn}), CC BY 4.0 / CC BY-SA 4.0.</div>
    </>
  );
}

function Runner({ w, model, repo, apply, onBack, onOpen }: PageProps & { w: Workshop; onBack: () => void; onOpen: (id: string) => void }) {
  const l = useLook();
  const [studio, setStudio] = React.useState(false);
  const [showTranscript, setShowTranscript] = React.useState(false);
  const [from, setFrom] = React.useState<(CaptureFrom & { line: string; as: ReviewType }) | null>(null);
  const [flowNote, setFlowNote] = React.useState<{ text: string; line: string } | null>(null);
  /** a line kept: its quoted line, what it became, and its review type */
  const [mark, setMark] = React.useState<{ line: string; as: string; type: ReviewType } | null>(null);
  const [shot, setShot] = React.useState<{ jpeg: string; subject: string } | null>(null);
  const [shots, setShots] = React.useState<Screenshot[]>([]);
  const [shooting, setShooting] = React.useState(false);
  const [image, setImage] = React.useState<{ subject: string; src: string; note?: string } | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [walkActs, setWalkActs] = React.useState<Activity[] | null>(null);
  const [licenceFor, setLicenceFor] = React.useState<Line | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const closed = w.status === SESSION.closed;
  const fresh = (m: Model) => m.workshops.find(x => x.id === w.id) || w;
  const save = (patch: Partial<Workshop>) => apply(m => repo.saveWorkshop(m, fresh(m), patch));
  /** Session changes made from the latest saved session, not the one this screen was drawn with. */
  const saveSession = (fn: (s: Workshop["session"]) => Workshop["session"]) => apply(m => { const cur = fresh(m); return repo.saveWorkshop(m, cur, { session: fn(cur.session) }); });
  const saveRun = (fn: (r: RunState) => RunState) => apply(m => { const cur = fresh(m); return repo.saveWorkshop(m, cur, { session: { ...cur.session, run: fn(runOf(cur, m)) } }); });
  const run = runOf(w, model);
  const kind: WorkshopKindName = run.kind || kindOfValue(w.kind);
  const tpl = templateById(GUIDANCE, run.template);
  const e2e = model.items.find(x => x.id === w.itemId && x.level === 1) || null;
  const step = w.phase;
  const people = (run.present.length ? run.present : peopleOf(w)).join(", ");
  const how: How = { how: HOW.workshop, workshop: w.name, present: people, on: w.heldOn };
  const processes = w.session.processIds.map(id => model.items.find(p => p.id === id)).filter(Boolean) as ProcessItem[];
  const openPoints = model.raids.filter(r => r.workshopId === w.id && r.type === RAID.action);
  const current = model.items.find(p => p.id === processKeyOf(w.session.current)) || null;
  const line = currentLine(run);
  const lineItem = line?.itemId ? model.items.find(x => x.id === line.itemId) || null : null;
  /** The business process in focus: the process line's, else the one last visited (board, storyline). */
  const proc = lineItem || (current && current.level === 3 ? current : null);
  const onVisit = (key: string, name: string) => saveSession(s => visit(s, key, name, new Date().toISOString()));
  // the board: Microsoft's for this end-to-end process (also in a storyline review or the quick track), else the catalog's
  const boardTpl = tpl?.kind === "board" ? tpl : e2e ? templatesFor(GUIDANCE, "board", e2e.code)[0] || null : null;
  const areas = e2e ? childItems(model, e2e.id) : [];
  const cols = React.useMemo(() => (e2e ? boardColumns(boardTpl, areas, model.items) : []), [boardTpl?.id, e2e?.id, model.items]);
  const cards = cols.flatMap(c => c.groups.flatMap(g => g.cards));
  const ours = proc ? flowsOf(model, proc.id).ours : undefined;
  const [walkTick, setWalkTick] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    if (!ours) { setWalkActs(null); return; }
    loadActivities(repo.g, ours.id).then(a => { if (live) setWalkActs(a); }).catch(() => live && setWalkActs([]));
    return () => { live = false; };
  }, [ours?.id, studio, walkTick]);
  const transcript = React.useMemo(() => linesOf(w.transcript), [w.transcript]);
  const used = usedLines(transcript, model.requirements, openPoints, w.session.captured || {}, model.comments.filter(c => c.workshopId === w.id));
  // each line's review: kept on the session by its quoted line; a line used before reviews were kept counts as accepted
  const reqOfLine = (line: string) => model.requirements.find(r => r.workshopId === w.id && r.sourceText === line);
  const states = new Map<number, LineState>(transcript.map((u, i) => {
    const line = sourceLine(u), entry = w.session.review?.[line];
    const r = reviewOf(u.text, entry, used.get(i) || "", isFacilitator(u.speaker, w.facilitator));
    const req = reqOfLine(line);
    return [i, { r, undo: undoRule(r, { closed, signedOff: !!req && req.approval === APPROVAL.approved }), text: entry?.text }];
  }));
  const review = reviewCounts(Array.from(states.values()).map(x => x.r));
  const keep = (line: string, as: string, type: ReviewType, text?: string) => saveSession(s => withReview({ ...s, captured: { ...(s.captured || {}), [line]: as } }, line, { status: "accepted", type, ...(text ? { text } : {}) }));
  const actions = {
    reject: (u: Line) => saveSession(s => withReview(s, sourceLine(u), { ...(s.review?.[sourceLine(u)] || {}), status: "rejected" })),
    undo: (u: Line) => apply(async m => {
      const line = sourceLine(u), st = states.get(u.i);
      let model = m;
      if (st?.r.status === "accepted") {
        const req = model.requirements.find(r => r.workshopId === w.id && r.sourceText === line), com = model.comments.find(c => c.workshopId === w.id && c.source === line), op = model.raids.find(r => r.workshopId === w.id && r.source === line);
        if ((st.r.type === "req" || st.r.type === "rule") && req) model = await repo.deleteRequirement(model, req);
        else if (st.r.type === "comment" && com) model = await repo.deleteComment(model, com);
        else if (st.r.type === "open" && op) model = await repo.deleteRaid(model, op);
      }
      const cur = fresh(model), captured = { ...(cur.session.captured || {}) };
      delete captured[line];
      return repo.saveWorkshop(model, cur, { session: withReview({ ...cur.session, captured }, line, null) });
    }),
  };
  const captured = model.requirements.filter(r => r.workshopId === w.id && isActive(r));
  React.useEffect(() => { repo.screenshots(w).then(setShots).catch(() => setShots([])); }, [w.id]);
  React.useEffect(() => {
    if (!mark) return;
    keep(mark.line, mark.as, mark.type);
    setMark(null);
  }, [mark]);
  /** Accept a line as one type, with its words as they are or as edited. The quoted line stays the source. */
  const useLine = (u: Line, use: LineUse, words = u.text) => {
    if (used.has(u.i) || states.get(u.i)?.r.status === "accepted") return;
    const line = sourceLine(u), edited = words !== u.text ? words : undefined;
    const processId = processKeyOf(u.key) || proc?.id || current?.id || null, code = activityCodeOf(u.key);
    const act = code && processId === proc?.id ? (walkActs || []).find(a => a.code === code) || null : null;
    if (use === "open") { apply(m => repo.addRaid(m, { type: RAID.action, description: words, source: line, workshopId: w.id, itemId: processId, isQuestion: /\?\s*$/.test(words) })).then(() => keep(line, "Open point", "open", edited)); return; }
    if (use === "comment") { apply(m => repo.addComment(m, { itemId: processId, activityId: act?.id ?? null, activityCode: act ? code : "", workshopId: w.id, author: u.speaker, text: words, source: line })).then(() => keep(line, "Comment", "comment", edited)); return; }
    if (use === "flow") { setFlowNote({ text: edited ? (u.at != null ? line.slice(0, line.indexOf("]") + 2) : "") + (u.speaker ? u.speaker + ": " : "") + words : line, line }); setStudio(true); return; }
    if (use === "licence") { setLicenceFor(u); return; }
    setFrom({ key: u.i + ":" + Date.now(), line, as: use === "rule" ? "rule" : "req", text: words, who: u.speaker, sourceText: line, itemId: processId, activityId: act?.id ?? null, activityName: act?.name || "",
      type: use === "rule" ? option("requirementType", "Business rule") : null });
    if (step !== 1) save({ phase: 1 });
  };
  const screenshot = async () => {
    setProblem(null); setShooting(true);
    try {
      const jpeg = await grabScreen();
      const about = proc ? proc.name : line ? line.text : w.name;
      if (jpeg) setShot({ jpeg, subject: "Screenshot: " + w.name + " · " + about }); // marked up (or skipped) before it is kept
    } catch (e: any) { setProblem("The screenshot didn't work: " + (e?.message || e)); }
    finally { setShooting(false); }
  };
  const visitedItems = Array.from(new Set(w.session.visits.map(v => processKeyOf(v.key)))).map(id => model.items.find(x => x.id === id)).filter(Boolean) as ProcessItem[];
  const readBack = readBackItems(captured.map(r => ({ id: r.id, reqId: r.reqId, description: r.description, owner: r.owner, mapping: r.mapping, approvedBy: r.approvedBy, said: r.raisedBy, where: model.items.find(x => x.id === r.itemId)?.name || "" })),
    visitedItems.filter(p => p.level === 3).map(p => ({ id: p.id, name: p.name, visited: true, decisions: [p.fitGap != null ? labelOf("fitGapStatus", p.fitGap) + (p.gapApproach != null ? " (" + labelOf("gapSolutionApproach", p.gapApproach) + ")" : "") : "",
      ...systemsFor(model, p).filter(s => s.decision != null).map(s => s.name + ": " + labelOf("systemDecision", s.decision))].filter(Boolean) })),
    openPoints.map(r => ({ text: r.description, owner: r.owner, due: r.targetDate || "", done: r.status === RAID_STATUS.closed, source: r.source })), transcriptDecisions(w.session.captured));
  const openList = openPoints.map(r => ({ text: r.description, owner: r.owner, due: r.targetDate || "", done: r.status === RAID_STATUS.closed, source: r.source }));
  const name = (id: string) => { const x = model.items.find(i => i.id === id); return x ? (x.code ? x.code + " " : "") + x.name : id; };
  const conclusion = conclusionItems(run, cards, { name, scopeLabel: v => labelOf("scope", v), fitLabel: f => labelOf("fitGapStatus", f.fitGap) + (f.approach != null && f.fitGap === FIT_GAP.gap ? " (" + labelOf("gapSolutionApproach", f.approach) + ")" : "") });
  /** Next / Previous: Next ticks the line it leaves; Next on the last line goes on to Analyse. A process line is a visit (the transcript lands there). */
  const move = (delta: 1 | -1) => apply(m => {
    const cur = fresh(m), r0 = runOf(cur, m), r = moveAgenda(r0, delta);
    let session: Workshop["session"] = { ...cur.session, run: r.run };
    const to = currentLine(r.run);
    if (!r.end && to?.itemId && to.key !== r0.agendaKey) session = visit(session, to.itemId, to.text, new Date().toISOString());
    return repo.saveWorkshop(m, cur, { session, ...(r.end ? { phase: 2 } : {}) });
  });
  const go = (a: AgendaLine) => apply(m => {
    const cur = fresh(m);
    let session: Workshop["session"] = { ...cur.session, run: goLine(runOf(cur, m), a.key) };
    if (a.itemId) session = visit(session, a.itemId, a.text, new Date().toISOString());
    return repo.saveWorkshop(m, cur, { session });
  });
  const navButtons = (where: string) => {
    const prev = agendaNeighbour(run, -1), next = agendaNeighbour(run, 1);
    return (
      <div className={l.row} data-emph={"agenda-nav-" + where} style={{ justifyContent: "space-between" }}>
        <Button size="small" disabled={closed || !prev} icon={<ChevronLeft20Regular />} data-emph="agenda-prev" onClick={() => move(-1)}>Previous</Button>
        <Button size="small" appearance="primary" disabled={closed || !line} icon={<ChevronRight20Regular />} iconPosition="after" data-emph="agenda-next" onClick={() => move(1)}>{next ? "Next" : "Next: Analyse"}</Button>
      </div>
    );
  };

  return (
    <>
      <div className={l.row}>
        <Button appearance="subtle" icon={<ChevronLeft20Regular />} onClick={onBack}>All workshops</Button>
        <b style={{ fontSize: 16 }}>{w.name}</b>{closed && <Pill text="Closed" />}<Pill text={kindLabel(w)} tone="info" />
        <span style={{ flexGrow: 1 }} />
        <ToggleButton icon={<TextQuote20Regular />} checked={showTranscript} onClick={() => setShowTranscript(x => !x)} data-emph="transcript-toggle">Transcript{w.transcript ? "" : " (none yet)"}</ToggleButton>
        <Tooltip content="Pick a screen, window or tab; one picture is kept as a note on this workshop" relationship="description">
          <Button icon={shooting ? <Spinner size="tiny" /> : <Screenshot20Regular />} disabled={closed || shooting || !navigator.mediaDevices?.getDisplayMedia} onClick={screenshot} data-emph="screenshot">Screenshot</Button>
        </Tooltip>
      </div>
      {problem && <div style={{ color: C.bad }}>{problem}</div>}
      {shots.length > 0 && (
        <div className={l.row} style={{ fontSize: 12 }} data-emph="screenshots">
          <span className={l.muted}>Screenshots:</span>
          {shots.slice(0, 6).map(x => (
            <Button key={x.id} size="small" appearance="subtle" onClick={async () => { try { setImage({ subject: x.subject, src: await repo.screenshotImage(x.id), note: x.note }); } catch (e: any) { setProblem(String(e?.message || e)); } }}>
              {x.subject.replace(/^Screenshot: /, "").replace(w.name + " · ", "")} {x.createdOn ? new Date(x.createdOn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}{x.note && marksOf(x.note).comments.length ? " (" + marksOf(x.note).comments.length + " comments)" : ""}
            </Button>
          ))}
        </div>
      )}
      <div className={l.row} data-emph="phases">
        {STEPS.map((ph, i) => (
          <button key={ph.name} onClick={() => save({ phase: i })} style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600,
            background: i === step ? C.railActive : i < step ? "#CCF3EF" : "#F1F5F9", color: i === step ? "#fff" : i < step ? "#0F766E" : C.muted }}>{i + 1}. {ph.name}</button>
        ))}
      </div>
      <div className={l.muted} style={{ fontSize: 13 }}>{STEPS[step].discuss}. Produces: {STEPS[step].produces}.</div>
      <div style={{ display: "grid", gridTemplateColumns: (step === 1 ? "260px 1fr" : "1fr") + (showTranscript ? " 400px" : ""), gap: 16, alignItems: "start" }}>
        {step === 1 && (
          <div className={l.card} style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }} data-emph="agenda">
            {navButtons("top")}
            <div className={l.section} style={{ margin: 0 }}>Agenda{run.track === "quick" ? " (quick track)" : ""}</div>
            {run.agenda.map((a, i) => (
              <div key={a.key} data-emph="agenda-item" data-key={a.key} className={l.node + (a.key === line?.key ? " " + l.nodeOn : "")} onClick={() => !closed && go(a)}
                style={{ opacity: a.itemId && !effectiveScope(model, model.items.find(x => x.id === a.itemId) || ({} as ProcessItem)) ? 0.55 : 1 }}>
                <span className={l.code} style={{ minWidth: 20 }}>{i + 1}</span><span style={{ flexGrow: 1 }}>{a.text}</span>{run.done.includes(a.key) && <span style={{ color: C.ok }}>✓</span>}
              </div>
            ))}
            {!run.agenda.length && <div className={l.muted}>Add agenda lines in Prepare.</div>}
            {navButtons("bottom")}
          </div>
        )}
        <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {closed && step !== 4 && <div style={{ color: C.warn }}>This workshop is closed. Reopen it in Close to change anything.</div>}
          <fieldset disabled={closed && step !== 4} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {step === 0 && <Prepare model={model} repo={repo} apply={apply} w={w} run={run} tpl={tpl} e2e={e2e} processes={processes} save={save} saveRun={saveRun} note={note} setNote={setNote} />}
            {step === 0 && kind !== "discovery" && run.agenda.length > 0 && (
              <div className={l.row} data-emph="prepare-meeting">
                <MeetingRequest w={w} organisation={model.workspace.organisation} what={[tpl ? tpl.title : e2e ? e2e.name : w.name]} lines={run.agenda.map(a => ({ text: a.text }))}
                  sections={[{ title: tpl ? tpl.title : w.name, who: tpl ? tpl.stakeholders.map(s => s.role) : [], systems: e2e ? model.systems.filter(s => childItems(model, e2e.id).some(a => a.id === s.itemId)).map(s => s.name) : [], target: [],
                    questions: questionsOf(tpl).map(q => q.text).slice(0, 25), flow: "" } as PrepSection]} />
                <span className={l.muted} style={{ fontSize: 12 }}>A Teams meeting with this agenda, and a prep pack to attach.</span>
              </div>
            )}
            {step === 1 && line && <>
              <div className={l.row} style={{ justifyContent: "space-between" }}>
                <b data-emph="line-title">{line.text}</b>
                {!line.itemId && <span data-emph="line-tool"><Choice value={TOOLS.findIndex(t => t.tool === line.tool)} labels={TOOL_LABELS} width={190} onChange={v => v != null && saveRun(r => setTool(r, line.key, TOOLS[v].tool))} /></span>}
              </div>
              {line.tool === "process" && lineItem && <ProcessTool p={lineItem} model={model} repo={repo} apply={apply} how={how} w={w} tab={run.tab || "walk"} setTab={t => saveRun(r => ({ ...r, tab: t }))}
                walkActs={walkActs} closed={closed} onVisit={onVisit} onAdapted={() => setWalkTick(t => t + 1)} onOpenStudio={() => setStudio(true)} captured={captured} />}
              {line.tool === "board" && <BoardTool model={model} e2e={e2e} cols={cols} tpl={boardTpl} run={run} onRun={saveRun} line={line.text} closed={closed} />}
              {line.tool === "story" && <StoryTool model={model} repo={repo} apply={apply} e2e={e2e} run={run} onRun={saveRun} closed={closed} onVisit={onVisit} current={w.session.current} />}
              {line.tool === "questions" && <Questions tpl={tpl} run={run} onRun={saveRun} closed={closed} onOpen={(text, source) => apply(m => repo.addRaid(m, { type: RAID.action, description: text, source, workshopId: w.id, itemId: proc?.id ?? w.itemId, isQuestion: true }))} />}
              {line.tool === "notes" && <Notes tpl={tpl} w={w} save={save} />}
            </>}
            {step === 1 && (
              <div data-emph="capture-area">
                <Capture model={model} repo={repo} apply={apply} itemId={proc?.id ?? null} workshopId={w.id} from={from} onDropFrom={() => setFrom(null)}
                  onCaptured={r => { if (from) { setMark({ line: from.line, as: r.reqId || "requirement", type: from.as }); setFrom(null); } }} />
              </div>
            )}
            {step === 2 && <Analyse w={w} run={run} model={model} shots={shots} transcriptLines={transcript.length} used={review.accepted} todo={review.todo} rejected={review.rejected} captured={captured.length} openPoints={openPoints.length} />}
            {step === 2 && <AiAnalyse model={model} repo={repo} apply={apply} w={w} shots={shots} />}
            {step === 3 && <Conclusion model={model} repo={repo} apply={apply} w={w} run={run} onRun={saveRun} items={conclusion} readBack={readBack} onSession={saveSession} closed={closed} />}
            {step === 4 && <Close model={model} repo={repo} apply={apply} w={w} run={run} items={conclusion} cards={cards} closed={closed} how={how} onPlanned={onOpen} readBack={readBack} openList={openList} transcriptTodo={review.todo} />}
          </fieldset>
        </div>
        {showTranscript && <TranscriptPanel w={w} agenda={visitedItems} current={current} closed={closed} save={save} saveSession={saveSession} used={used} onUse={useLine} states={states} actions={actions} />}
      </div>
      {studio && proc && <FlowStudio model={model} repo={repo} apply={apply} process={proc} onClose={() => { setStudio(false); setFlowNote(null); }}
        drawing={closed ? null : { workshopName: w.name, raw: w.drawings, save: raw => save({ drawings: raw }) }}
        note={flowNote ? { text: flowNote.text, onUsed: (_code, nm) => { setMark({ line: flowNote.line, as: "Flow change: " + nm, type: "flow" }); setFlowNote(null); } } : null} />}
      {licenceFor && <LicenceDialog model={model} quote={sourceLine(licenceFor)} onClose={() => setLicenceFor(null)} onSave={(role, type, ppl) => {
        const u = licenceFor; setLicenceFor(null);
        apply(m => { const r = m.roles.find(x => x.id === role.id) || role; return repo.saveRole(m, r, { licenceType: type, headcount: ppl ?? r.headcount, licenceNote: (r.licenceNote ? r.licenceNote + "\n" : "") + sourceLine(u) }); });
        setMark({ line: sourceLine(u), as: "Licence: " + role.name + ", " + LICENCE_LABEL[type], type: "licence" });
      }} />}
      {shot && <ShotAnnotate src={"data:image/jpeg;base64," + shot.jpeg} title={shot.subject.replace(/^Screenshot: /, "Mark up: ")} by={repo.user}
        onSkip={() => { const s = shot; setShot(null); repo.addScreenshot(w, s.subject, s.jpeg).then(x => setShots(xs => [x, ...xs])).catch(e => setProblem(String(e?.message || e))); }}
        onSave={async marks => { const jpeg = await burnIn("data:image/jpeg;base64," + shot.jpeg, marks); const x = await repo.addScreenshot(w, shot.subject, jpeg, noteWithMarks(shot.subject, marks)); setShots(xs => [x, ...xs]); setShot(null); }} />}
      {image && (
        <Dialog open onOpenChange={(_, d) => { if (!d.open) setImage(null); }}>
          <DialogSurface style={{ maxWidth: "90vw" }}><DialogBody>
            <DialogTitle>{image.subject}</DialogTitle>
            <DialogContent><img src={image.src} alt={image.subject} style={{ maxWidth: "100%", maxHeight: "70vh", display: "block" }} />{image.note && marksOf(image.note).comments.length > 0 && <div data-emph="shot-text" style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>{shotText(image.note).split("\n").slice(1).join("\n")}</div>}</DialogContent>
            <DialogActions><Button appearance="primary" onClick={() => setImage(null)}>Close</Button></DialogActions>
          </DialogBody></DialogSurface>
        </Dialog>
      )}
    </>
  );
}

/** Prepare: who and when, Microsoft's template (type, phase, assumptions, roles, objectives), the quick track, the agenda. */
function Prepare({ model, repo, apply, w, run, tpl, e2e, processes, save, saveRun, note, setNote }: PageProps & {
  w: Workshop; run: RunState; tpl: MsTemplate | null; e2e: ProcessItem | null; processes: ProcessItem[]; save: (p: Partial<Workshop>) => Promise<void>; saveRun: (fn: (r: RunState) => RunState) => Promise<void>;
  note: string | null; setNote: (s: string | null) => void;
}) {
  const l = useLook();
  const kind = run.kind;
  // every area of the workshop's end-to-end process (or of those in scope), so the room can bring an area in or take it out here
  const units = w.itemId ? [w.itemId] : itemsAt(model, 1).filter(x => effectiveScope(model, x)).map(x => x.id);
  const areas = units.flatMap(id => childItems(model, id)).sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }))
    .map(a => ({ a, ps: childItems(model, a.id).filter(p => effectiveScope(model, p) || w.session.processIds.includes(p.id)), all: childItems(model, a.id).length }));
  const pickProcess = (p: ProcessItem, on: boolean) => apply(m => {
    const cur = m.workshops.find(x => x.id === w.id) || w;
    const ids = on ? cur.session.processIds.concat(p.id) : cur.session.processIds.filter(x => x !== p.id);
    const r = syncProcessLines(runOf(cur, m), ids.map(id => m.items.find(x => x.id === id)).filter(Boolean) as ProcessItem[]);
    return repo.saveWorkshop(m, cur, { session: { ...cur.session, processIds: ids, run: r } });
  });
  const quick = run.track === "quick";
  const propose = () => {
    if (!e2e) return;
    const today = [e2e, ...childItems(model, e2e.id)];
    const p = proposeScope(run, today);
    setNote(p.proposed ? p.proposed + " scope decision" + (p.proposed === 1 ? "" : "s") + " of today proposed for the room to confirm." : "Nothing to propose: today's scope is not decided for any area, or already proposed. The room decides.");
    if (p.proposed) saveRun(() => p.run);
  };
  return (
    <>
      <div className={l.fields}>
        <Field label="Name"><Edit value={w.name} onSave={v => v.trim() && save({ name: v.trim() })} /></Field>
        <Field label="Date"><Input type="date" defaultValue={w.heldOn || ""} onBlur={e => save({ heldOn: e.target.value || null })} /></Field>
        <Field label="Facilitator"><Edit value={w.facilitator} onSave={v => save({ facilitator: v })} /></Field>
      </div>
      <Field label="Participants (one per line or comma separated)"><Edit multiline value={w.participants} onSave={v => save({ participants: v })} /></Field>
      <div className={l.fields} data-emph="workshop-ms">
        <Field label="Microsoft workshop type"><ListChoice list="microsoftWorkshopType" value={w.msType} onChange={v => save({ msType: v })} width={220} /></Field>
        <Field label="Success by Design phase"><ListChoice list="sbdPhase" value={w.sbdPhase} onChange={v => save({ sbdPhase: v })} width={220} /></Field>
        <Field label="Unit"><span>{w.units || (e2e ? e2e.code : "All in scope")}</span></Field>
      </div>
      {tpl && (
        <div data-emph="template" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={l.section} style={{ margin: 0 }}>Microsoft's template <span className={l.code}>{tpl.id}</span> {tpl.title}</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{tpl.description}</div>
          <div className={l.muted} style={{ fontSize: 11 }}>Source: {tpl.source} ({GUIDANCE.source.repository}, CC BY 4.0 / CC BY-SA 4.0). {questionsOf(tpl).length} key questions.</div>
          {tpl.assumptions.length > 0 && <><b style={{ fontSize: 13 }}>Assumptions</b><ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>{tpl.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></>}
          {tpl.stakeholders.length > 0 && <><b style={{ fontSize: 13 }}>Roles to invite</b><ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }} data-emph="template-roles">{tpl.stakeholders.map((s, i) => <li key={i}>{s.role}{s.why ? <span className={l.muted}>: {s.why}</span> : null}</li>)}</ul></>}
          {tpl.objectives.length > 0 && <><b style={{ fontSize: 13 }}>Objectives</b><ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>{tpl.objectives.map((a, i) => <li key={i}>{a}</li>)}</ul></>}
        </div>
      )}
      {kind === "board" && (
        <div data-emph="quick" style={{ display: "flex", flexDirection: "column", gap: 4, borderLeft: "3px solid " + C.railActive, paddingLeft: 10 }}>
          <Switch label="Quick track: board, storyline review and fit-to-standard in one session" checked={quick} data-emph="quick-track" onChange={(_, d) => saveRun(r => (d.checked ? toQuickTrack(r) : fromQuickTrack(r)))} />
          <div className={l.muted} style={{ fontSize: 12 }}>Ours, not a Microsoft workshop: every step follows Microsoft's guidance (implementation guide, "About workshops" and "Fit-to-standard and fit-gap analysis"). A smaller group prepares the scope as a proposal; the room confirms it, starts with the core scenarios, sees the main path in Dynamics 365 and marks fit or gap; only the areas with gaps get a deep-dive. Switching it off brings Microsoft's agenda back.</div>
          {quick && <div className={l.row}><Button size="small" data-emph="quick-propose" onClick={propose}>Propose the scope from today</Button>{note && <span style={{ fontSize: 12 }} data-emph="quick-note">{note}</span>}</div>}
        </div>
      )}
      {kind === "discovery" && <>
        <div className={l.section}>Business processes on the agenda</div>
        <div className={l.muted} style={{ fontSize: 12 }}>Every process area {w.itemId ? "of this end-to-end process" : "of the end-to-end processes in scope"}, with its scope. Put an area in scope to list its business processes; take one out to drop them.</div>
        {!areas.length && <div className={l.muted}>No process areas here.</div>}
        <div style={{ columns: 2 }} data-emph="agenda-pick">{areas.map(({ a, ps, all }) => (
          <div key={a.id} style={{ breakInside: "avoid", marginBottom: 8 }} data-emph="agenda-area" data-code={a.code}>
            <div style={{ fontWeight: 600, fontSize: 12, color: C.muted, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><span className={l.code}>{a.code}</span> {a.name}
              <ScopePick it={a} repo={repo} apply={apply} width={150} reason={false} />
              {!ps.length && <span style={{ fontWeight: 400 }}>{all} business processes</span>}</div>
            {ps.map(p => <Checkbox key={p.id} label={p.code + " " + p.name + (effectiveScope(model, p) ? "" : " (out of scope)")} checked={w.session.processIds.includes(p.id)} onChange={(_, d) => pickProcess(p, !!d.checked)} />)}
          </div>
        ))}</div>
      </>}
      <div className={l.section}>Agenda</div>
      <div data-emph="agenda-edit" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {run.agenda.map((a, i) => (
          <div key={a.key} className={l.row} style={{ borderBottom: "1px solid " + C.line, paddingBottom: 3 }}>
            <span className={l.code} style={{ minWidth: 20 }}>{i + 1}</span><span style={{ flexGrow: 1 }}>{a.text}</span>
            {a.itemId ? <span className={l.muted} style={{ fontSize: 12 }}>Business process</span>
              : <Choice value={TOOLS.findIndex(t => t.tool === a.tool)} labels={TOOL_LABELS} width={180} onChange={v => v != null && saveRun(r => setTool(r, a.key, TOOLS[v].tool))} />}
            <Button size="small" appearance="subtle" icon={<ArrowUp16Regular />} aria-label="Up" disabled={i === 0} onClick={() => saveRun(r => moveLine(r, a.key, -1))} />
            <Button size="small" appearance="subtle" icon={<ArrowDown16Regular />} aria-label="Down" disabled={i === run.agenda.length - 1} onClick={() => saveRun(r => moveLine(r, a.key, 1))} />
            {!a.itemId && <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label="Remove" onClick={() => saveRun(r => removeLine(r, a.key))} />}
          </div>
        ))}
        <AddBox placeholder="An agenda line of our own" onAdd={text => saveRun(r => addLine(r, text))} />
      </div>
      {kind === "discovery" && processes.length > 0 && <FacilitatorAgenda w={w} model={model} repo={repo} agenda={processes} />}
      <AiQuestions model={model} repo={repo} apply={apply} w={w} tpl={tpl}
        processes={processes.length ? processes : itemsAt(model, 3).filter(x => effectiveScope(model, x) && (!w.itemId || levelUp(model.items, x, 1)?.id === w.itemId))} />
      <div><Button appearance="primary" data-emph="prepare-start" disabled={!run.agenda.length} onClick={() => save({ phase: 1 })}>Run the agenda</Button></div>
    </>
  );
}

/** A business process line: the five phases of EMPH's discovery workshop as tabs. */
function ProcessTool({ p, model, repo, apply, how, w, tab, setTab, walkActs, closed, onVisit, onAdapted, onOpenStudio, captured }: PageProps & {
  p: ProcessItem; how: How; w: Workshop; tab: ProcessTab; setTab: (t: ProcessTab) => void; walkActs: Activity[] | null; closed: boolean;
  onVisit: (key: string, name: string) => void; onAdapted: () => void; onOpenStudio: () => void; captured: { itemId: string | null }[];
}) {
  const l = useLook();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className={l.row} data-emph="tool-tabs">
        {PROCESS_TABS.map(t => <ToggleButton key={t.tab} size="small" checked={tab === t.tab} data-emph="tool-tab" data-tab={t.tab} onClick={() => setTab(t.tab)}>{t.name}</ToggleButton>)}
      </div>
      {tab === "scope" && (
        <div className={l.row} style={{ justifyContent: "space-between" }}>
          <span><span className={l.code}>{p.code}</span> {p.name}</span>
          <Switch label={!isOff(p.scope) ? "We run it" : labelOf("scope", p.scope)} checked={!isOff(p.scope)} onChange={(_, d) => apply(m => repo.setScope(m, m.items.find(x => x.id === p.id) || p, d.checked, how))} />
        </div>
      )}
      {tab === "walk" && <WalkThrough p={p} model={model} repo={repo} apply={apply} how={how} />}
      {tab === "flow" && <FlowWalk w={w} model={model} repo={repo} apply={apply} p={p} acts={walkActs} closed={closed} onVisit={onVisit} onAdapted={onAdapted} onOpenStudio={onOpenStudio} />}
      {tab === "config" && <>
        {model.decisions.filter(d => d.itemId === p.id).map(d => <DecisionRow key={d.id} d={d} model={model} repo={repo} apply={apply} />)}
        {!model.decisions.some(d => d.itemId === p.id) && <div className={l.muted}>No configuration decisions on this business process.</div>}
      </>}
      {tab === "fitgap" && <>
        <Field label="Fit gap status"><FitGapPick fitGap={p.fitGap} gapApproach={p.gapApproach} onSave={(fitGap, gapApproach) => apply(m => repo.saveItem(m, m.items.find(x => x.id === p.id) || p, { fitGap, gapApproach }, how))} /></Field>
        {captured.some(r => r.itemId === p.id) && <RequirementList model={model} repo={repo} apply={apply} rows={model.requirements.filter(r => r.workshopId === w.id && isActive(r) && r.itemId === p.id)} />}
      </>}
    </div>
  );
}

/** Microsoft's key questions of the template, by topic, each with its source; an answer per question, or an open question for later. */
function Questions({ tpl, run, onRun, closed, onOpen }: { tpl: MsTemplate | null; run: RunState; onRun: (fn: (r: RunState) => RunState) => void; closed: boolean; onOpen: (text: string, source: string) => void }) {
  const l = useLook();
  const qs = tpl ? tpl.questions.map((q, i) => ({ ...q, key: tpl.id + ":q:" + (i + 1) })) : [];
  if (!qs.length) return <div className={l.muted}>Microsoft's template has no key questions here. Capture what is said below.</div>;
  const groups = Array.from(new Set(qs.map(q => q.group)));
  return (
    <div data-emph="questions" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {groups.map(g => (
        <div key={g} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <b style={{ fontSize: 13 }}>{g}</b>
          {qs.filter(q => q.group === g).map(q => (
            <div key={q.key} data-emph="question" style={{ display: "flex", flexDirection: "column", gap: 2, borderLeft: "2px solid " + C.line, paddingLeft: 8 }}>
              <span style={{ fontSize: 13 }} title={q.source}>{q.text}{q.statement && <span className={l.muted}> (to discuss)</span>}</span>
              <div className={l.row}>
                <span style={{ flexGrow: 1 }}><Edit value={run.answers[q.key] || ""} placeholder="Answer" disabled={closed} onSave={v => onRun(r => { const answers = { ...r.answers }; if (v.trim()) answers[q.key] = v.trim(); else delete answers[q.key]; return { ...r, answers }; })} /></span>
                <Button size="small" disabled={closed} data-emph="question-open" onClick={() => onOpen(q.text, q.source)}>Open question</Button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Notes({ tpl, w, save }: { tpl: MsTemplate | null; w: Workshop; save: (p: Partial<Workshop>) => Promise<void> }) {
  const l = useLook();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-emph="notes">
      {tpl?.objectives.length ? <><b style={{ fontSize: 13 }}>Objectives</b><ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>{tpl.objectives.map((a, i) => <li key={i}>{a}</li>)}</ul></> : <div className={l.muted}>Introduce the workshop, or wrap up.</div>}
      <Field label="Minutes"><Edit multiline value={w.minutes} onSave={v => save({ minutes: v })} /></Field>
    </div>
  );
}

/** Analyse: what the workshop recorded, one place to look before the conclusion. The AI analysis comes in a later version. */
function Analyse({ w, run, model, shots, transcriptLines, used, todo, rejected, captured, openPoints }: { w: Workshop; run: RunState; model: Model; shots: Screenshot[]; transcriptLines: number; used: number; todo: number; rejected: number; captured: number; openPoints: number }) {
  const l = useLook();
  const marks = Object.values(run.marks);
  const comments = model.comments.filter(c => c.workshopId === w.id).length;
  const rows: [string, string | number][] = [
    ["Transcript lines", transcriptLines ? transcriptLines + " (" + used + " used, " + rejected + " not relevant, " + todo + " to review)" : "none pasted"],
    ["Screenshots", shots.length + (shots.some(s => s.note) ? " (" + shots.filter(s => marksOf(s.note).comments.length || marksOf(s.note).lines.length).length + " marked up)" : "")],
    ["Flow drawings", Object.values(readDrawings(w.drawings)).reduce((n, d) => n + d.strokes.length, 0) + " lines, " + Object.values(readDrawings(w.drawings)).reduce((n, d) => n + d.comments.length, 0) + " comments on " + Object.keys(readDrawings(w.drawings)).length + " flows"], ["Requirements captured", captured], ["Comments", comments], ["Action items and open questions", openPoints],
    ["Scope proposals", Object.keys(run.scope).length], ["Board cards kept / struck / main path", marks.filter(m => m.state === "keep").length + " / " + marks.filter(m => m.state === "strike").length + " / " + marks.filter(m => m.main).length],
    ["Steps fit-checked", Object.keys(run.stepFit).length], ["Fit-gap proposals", Object.keys(run.processFit).length], ["Questions answered", Object.keys(run.answers).length], ["Agenda lines walked", run.done.length + " of " + run.agenda.length],
  ];
  return (
    <div data-emph="analyse" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <table className={l.table}><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
      <div className={l.muted} style={{ fontSize: 12 }}>The record above changes nothing. The AI analysis below only suggests: what you accept is written, with How "AI accepted". Go on to the Conclusion when the record is complete.</div>
    </div>
  );
}

/** Walk-through: owner, fit or gap, and what happens to the systems used today. Changes are recorded as set in this workshop. */
function WalkThrough({ p, model, repo, apply, how }: PageProps & { p: ProcessItem; how: How }) {
  const l = useLook();
  const save = (patch: Partial<ProcessItem>) => apply(m => repo.saveItem(m, m.items.find(x => x.id === p.id) || p, patch, how));
  const systems = systemsFor(model, p);
  const area = levelUp(model.items, p, 2);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-emph="walk-through">
      <div className={l.fields}>
        <Field label="Business process owner"><Edit value={p.owner} onSave={v => save({ owner: v })} /></Field>
        <Field label="Fit gap status"><FitGapPick fitGap={p.fitGap} gapApproach={p.gapApproach} onSave={(fitGap, gapApproach) => save({ fitGap, gapApproach })} /></Field>
        <Field label="Fit gap rationale"><Edit value={p.fitGapReason} onSave={v => save({ fitGapReason: v })} /></Field>
      </div>
      <div className={l.section} style={{ margin: 0 }}>Systems used today</div>
      {systems.map(s => (
        <div key={s.id} className={l.row} data-emph="walk-system">
          <span style={{ minWidth: 180 }}>{s.name}</span>
          <ListChoice list="systemDecision" value={s.decision} onChange={v => apply(m => repo.saveSystem(m, m.systems.find(x => x.id === s.id) || s, { decision: v }))} width={130} />
        </div>
      ))}
      {area && <AddBox placeholder={"A system used today in " + area.name} onAdd={name => apply(m => repo.saveSystem(m, { id: "", itemId: area.id, name, vendor: "", decision: SYSTEM.keep, retireOn: null, users: "", hosting: "", note: "" }, {}))} />}
    </div>
  );
}
