// Guided discovery workshops: seven phases over an agenda of business processes.
import * as React from "react";
import { Button, Field, Input, Switch, Checkbox, Tooltip, ToggleButton, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Spinner } from "@fluentui/react-components";
import { ChevronLeft20Regular, ChevronRight20Regular, Delete16Regular, Copy16Regular, Screenshot20Regular, TextQuote20Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Pill, Pick, Choice, Edit, AddBox, Empty } from "../kit";
import type { Nav } from "../Shell";
import { SESSION, REVIEW_LABEL, DISPOSITION_LABEL, REVIEW, LICENCE_LABEL } from "../../domain/codes";
import { PHASES, visit, minutesPerVisit, summaryLines, sourceLine, parseTranscript, usedLines, processKeyOf, activityCodeOf } from "../../domain/session";
import { isActive } from "../../domain/rules";
import { areasOf, flowsOf, loadActivities } from "../../domain/repository";
import type { Workshop, BusinessProcess, Screenshot, Activity } from "../../domain/types";
import { DecisionRow } from "./Processes";
import { Capture, RequirementList, CaptureFrom } from "./Requirements";
import { TranscriptPanel, LineUse, Line, grabScreen } from "./Transcript";
import { FacilitatorAgenda, FlowWalk, LicenceDialog } from "./WorkshopParts";
import { FlowStudio } from "../flow/FlowStudio";

export function Workshops({ model, repo, apply }: PageProps & { nav: Nav }) {
  const l = useLook();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [e2e, setE2e] = React.useState<string | null>(null);
  const w = model.workshops.find(x => x.id === openId);
  if (w) return <Runner w={w} model={model} repo={repo} apply={apply} onBack={() => setOpenId(null)} />;
  return (
    <>
      <div className={l.card + " " + l.row}>
        <span>New workshop for</span>
        <Pick value={e2e} items={model.endToEnds.filter(x => x.inScope)} onChange={setE2e} placeholder="All in scope" width={260} />
        <Button appearance="primary" data-emph="workshop-new" disabled={!model.processes.some(p => p.inScope)} onClick={() => apply(async m => { const r = await repo.addWorkshop(m, e2e); setOpenId(r.workshop.id); return r.model; })}>Start</Button>
        {!model.processes.some(p => p.inScope) && <span className={l.muted}>Put business processes in scope on Our processes first.</span>}
      </div>
      {model.workshops.length === 0 ? <Empty title="No workshops yet" text="A workshop walks through business processes with the people who run them and records what you decide." /> : (
        <div className={l.card}>
          <table className={l.table}>
            <thead><tr><th>Workshop</th><th>Date</th><th>Facilitator</th><th>Phase</th><th>Status</th><th /></tr></thead>
            <tbody>{model.workshops.map(x => (
              <tr key={x.id} className={l.tr} onClick={() => setOpenId(x.id)}>
                <td>{x.name}</td><td>{x.heldOn || ""}</td><td>{x.facilitator}</td><td>{x.phase + 1}. {PHASES[x.phase].name}</td>
                <td><Pill text={x.status === SESSION.closed ? "Closed" : "Open"} tone={x.status === SESSION.closed ? "neutral" : "brand"} /></td>
                <td onClick={e => e.stopPropagation()}><Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete " + x.name + "? Requirements captured in it stay.")) apply(m => repo.deleteWorkshop(m, x)); }} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Runner({ w, model, repo, apply, onBack }: PageProps & { w: Workshop; onBack: () => void }) {
  const l = useLook();
  const [studio, setStudio] = React.useState(false);
  const [showTranscript, setShowTranscript] = React.useState(false);
  const [from, setFrom] = React.useState<(CaptureFrom & { i: number }) | null>(null); // a transcript line waiting in the capture box
  const [flowNote, setFlowNote] = React.useState<{ text: string; i: number } | null>(null);
  const [mark, setMark] = React.useState<{ i: number; as: string } | null>(null); // marks a line once the capture has landed
  const [shots, setShots] = React.useState<Screenshot[]>([]);
  const [shooting, setShooting] = React.useState(false);
  const [image, setImage] = React.useState<{ subject: string; src: string } | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [walkActs, setWalkActs] = React.useState<Activity[] | null>(null); // our process of the current business process
  const [licenceFor, setLicenceFor] = React.useState<Line | null>(null);
  const closed = w.status === SESSION.closed;
  const save = (patch: Partial<Workshop>) => apply(m => repo.saveWorkshop(m, m.workshops.find(x => x.id === w.id) || w, patch));
  /** Session changes made from the latest saved session, not the one this screen was drawn with. */
  const saveSession = (fn: (s: Workshop["session"]) => Workshop["session"]) => apply(m => { const cur = m.workshops.find(x => x.id === w.id) || w; return repo.saveWorkshop(m, cur, { session: fn(cur.session) }); });
  const agenda = w.session.processIds.map(id => model.processes.find(p => p.id === id)).filter(Boolean) as BusinessProcess[];
  // the current visit is a business process, or "process#activity" while walking its flow: the process is the part before "#"
  const current = agenda.find(p => p.id === processKeyOf(w.session.current)) || null;
  const idx = current ? agenda.indexOf(current) : -1;
  const onVisit = (key: string, name: string) => saveSession(s => visit(s, key, name, new Date().toISOString()));
  const go = (p: BusinessProcess) => onVisit(p.id, p.name);
  const visited = (p: BusinessProcess) => w.session.visits.some(v => processKeyOf(v.key) === p.id);
  const ours = current ? flowsOf(model, current.id).ours : undefined;
  const [walkTick, setWalkTick] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    if (!ours) { setWalkActs(null); return; }
    loadActivities(repo.g, ours.id).then(a => { if (live) setWalkActs(a); }).catch(() => live && setWalkActs([]));
    return () => { live = false; };
  }, [ours?.id, studio, walkTick]);
  const transcript = React.useMemo(() => parseTranscript(w.transcript), [w.transcript]);
  const used = usedLines(transcript, model.requirements, w.session.actions, w.session.captured || {}, model.comments.filter(c => c.workshopId === w.id));
  const captured = model.requirements.filter(r => r.workshopId === w.id && isActive(r));
  // only what has been picked: business processes in scope, plus any still on the agenda
  const areas = (w.endToEndId ? areasOf(model, w.endToEndId) : model.areas).slice().sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true })).map(a => ({ a, ps: model.processes.filter(p => p.areaId === a.id && (p.inScope || w.session.processIds.includes(p.id))) })).filter(x => x.ps.length);
  React.useEffect(() => { repo.screenshots(w).then(setShots).catch(() => setShots([])); }, [w.id]);
  React.useEffect(() => {
    if (!mark) return;
    const { i, as } = mark;
    saveSession(s => ({ ...s, captured: { ...(s.captured || {}), [String(i)]: as } }));
    setMark(null);
  }, [mark]);
  const useLine = (u: Line, use: LineUse) => {
    if (used.has(u.i)) return; // each line is used once
    // the business process the line was said on (else the current one), and the flow step when it fell in a step's visit
    const processId = processKeyOf(u.key) || current?.id || null, code = activityCodeOf(u.key);
    const act = code && processId === current?.id ? (walkActs || []).find(a => a.code === code) || null : null;
    if (use === "open") { saveSession(s => ({ ...s, actions: s.actions.concat({ text: u.text, owner: "", due: "", source: sourceLine(u) }) })); return; }
    if (use === "comment") { apply(m => repo.addComment(m, { processId, activityId: act?.id ?? null, activityCode: act ? code : "", workshopId: w.id, author: u.speaker, text: u.text, source: sourceLine(u) })); return; }
    if (use === "flow") { setFlowNote({ text: sourceLine(u), i: u.i }); setStudio(true); return; }
    if (use === "licence") { setLicenceFor(u); return; }
    setFrom({ key: u.i + ":" + Date.now(), i: u.i, text: u.text, who: u.speaker, verbatim: sourceLine(u), processId, activityId: act?.id ?? null, activityName: act?.name || "" });
    if (w.phase !== 5) save({ phase: 5 });
  };
  const screenshot = async () => {
    setProblem(null); setShooting(true);
    try {
      const jpeg = await grabScreen();
      if (jpeg) { const shot = await repo.addScreenshot(w, "Screenshot: " + (current ? current.name : w.name), jpeg); setShots(xs => [shot, ...xs]); }
    } catch (e: any) { setProblem("The screenshot didn't work: " + (e?.message || e)); }
    finally { setShooting(false); }
  };
  const lines = summaryLines(captured.map(r => ({ reqId: r.reqId, description: r.description, owner: r.owner, resolution: r.resolution, resolvedBy: r.resolvedBy })),
    agenda.map(p => ({ name: p.name, disposition: p.disposition, visited: visited(p) })), w.session.actions);

  return (
    <>
      <div className={l.row}>
        <Button appearance="subtle" icon={<ChevronLeft20Regular />} onClick={onBack}>All workshops</Button>
        <b style={{ fontSize: 16 }}>{w.name}</b>{closed && <Pill text="Closed" />}
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
            <Button key={x.id} size="small" appearance="subtle" onClick={async () => { try { setImage({ subject: x.subject, src: await repo.screenshotImage(x.id) }); } catch (e: any) { setProblem(String(e?.message || e)); } }}>
              {x.subject.replace(/^Screenshot: /, "")} {x.createdOn ? new Date(x.createdOn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </Button>
          ))}
        </div>
      )}
      <div className={l.row} data-emph="phases">
        {PHASES.map((ph, i) => (
          <button key={ph.name} onClick={() => save({ phase: i })} style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600,
            background: i === w.phase ? C.railActive : i < w.phase ? "#CCF3EF" : "#F1F5F9", color: i === w.phase ? "#fff" : i < w.phase ? "#0F766E" : C.muted }}>{i + 1}. {ph.name}</button>
        ))}
      </div>
      <div className={l.muted} style={{ fontSize: 13 }}>{PHASES[w.phase].discuss}. Produces: {PHASES[w.phase].produces.toLowerCase()}.</div>
      <div style={{ display: "grid", gridTemplateColumns: showTranscript ? "260px 1fr 400px" : "260px 1fr", gap: 16, alignItems: "start" }}>
        <div className={l.card} style={{ padding: 10 }}>
          <div className={l.section} style={{ marginTop: 0 }}>Agenda</div>
          {agenda.map((p, i) => (
            <div key={p.id} data-emph="agenda-item" className={l.node + (p.id === w.session.current ? " " + l.nodeOn : "")} onClick={() => !closed && go(p)} style={{ opacity: p.inScope ? 1 : 0.55 }}>
              <span className={l.code} style={{ minWidth: 20 }}>{i + 1}</span><span style={{ flexGrow: 1 }}>{p.name}</span>{visited(p) && <span style={{ color: C.ok }}>✓</span>}
            </div>
          ))}
          {!agenda.length && <div className={l.muted}>Add processes in phase 1.</div>}
          <div className={l.row} style={{ marginTop: 8 }}>
            <Button size="small" disabled={closed || idx <= 0} icon={<ChevronLeft20Regular />} onClick={() => go(agenda[idx - 1])}>Back</Button>
            <Button size="small" disabled={closed || idx >= agenda.length - 1} icon={<ChevronRight20Regular />} iconPosition="after" onClick={() => go(agenda[idx + 1])}>Next</Button>
          </div>
        </div>
        <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {closed && <div style={{ color: C.warn }}>This workshop is closed. Reopen it in phase 7 to change anything.</div>}
          <fieldset disabled={closed} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {w.phase === 0 && <>
              <div className={l.fields}>
                <Field label="Name"><Edit value={w.name} onSave={v => v.trim() && save({ name: v.trim() })} /></Field>
                <Field label="Date"><Input type="date" defaultValue={w.heldOn || ""} onBlur={e => save({ heldOn: e.target.value || null })} /></Field>
                <Field label="Facilitator"><Edit value={w.facilitator} onSave={v => save({ facilitator: v })} /></Field>
              </div>
              <Field label="Participants"><Edit multiline value={w.participants} onSave={v => save({ participants: v })} /></Field>
              <div className={l.section}>Business processes on the agenda</div>
              <div className={l.muted} style={{ fontSize: 12 }}>The business processes in scope{w.endToEndId ? " in this end-to-end process" : ""}. To add others, put them in scope on Our processes.</div>
              {!areas.length && <div className={l.muted}>Nothing in scope here yet.</div>}
              <div style={{ columns: 2 }} data-emph="agenda-pick">{areas.map(({ a, ps }) => (
                <div key={a.id} style={{ breakInside: "avoid", marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: C.muted }}><span className={l.code}>{a.code}</span> {a.name}</div>
                  {ps.map(p => (
                    <Checkbox key={p.id} label={p.code + " " + p.name + (p.inScope ? "" : " (out of scope)")} checked={w.session.processIds.includes(p.id)}
                      onChange={(_, d) => save({ session: { ...w.session, processIds: d.checked ? w.session.processIds.concat(p.id) : w.session.processIds.filter(x => x !== p.id) } })} />
                  ))}
                </div>
              ))}</div>
              {agenda.length > 0 && <FacilitatorAgenda w={w} model={model} repo={repo} agenda={agenda} />}
            </>}
            {w.phase === 1 && agenda.map(p => (
              <div key={p.id} className={l.row} style={{ justifyContent: "space-between", borderBottom: "1px solid " + C.line, paddingBottom: 6 }}>
                <span><span className={l.code}>{p.code}</span> {p.name}</span>
                <Switch label={p.inScope ? "In scope" : "Out of scope"} checked={p.inScope} onChange={(_, d) => apply(m => repo.saveProcess(m, p, { inScope: d.checked }))} />
              </div>
            ))}
            {w.phase >= 2 && w.phase <= 5 && !current && <div className={l.muted}>Pick a business process from the agenda.</div>}
            {w.phase === 2 && current && <div className={l.fields}>
              <Field label="Review"><Choice value={current.review} labels={REVIEW_LABEL} onChange={v => apply(m => repo.saveProcess(m, current, { review: v ?? REVIEW.open }))} /></Field>
              <Field label="Disposition"><Choice value={current.disposition} labels={DISPOSITION_LABEL} onChange={v => apply(m => repo.saveProcess(m, current, { disposition: v }))} /></Field>
              <Field label="Process owner"><Pick value={current.ownerRoleId} items={model.roles} onChange={v => apply(m => repo.saveProcess(m, current, { ownerRoleId: v }))} /></Field>
              <Field label="Application today"><Pick value={current.currentAppId} items={model.apps} onChange={v => apply(m => repo.saveProcess(m, current, { currentAppId: v }))} /></Field>
              <Field label="Target application"><Pick value={current.targetAppId} items={model.apps} onChange={v => apply(m => repo.saveProcess(m, current, { targetAppId: v }))} /></Field>
              <Field label="Users"><Edit value={current.users} onSave={v => apply(m => repo.saveProcess(m, current, { users: v }))} /></Field>
            </div>}
            {w.phase === 3 && current && <FlowWalk w={w} model={model} repo={repo} apply={apply} p={current} acts={walkActs} closed={closed} onVisit={onVisit} onAdapted={() => setWalkTick(t => t + 1)} onOpenStudio={() => setStudio(true)} />}
            {w.phase === 4 && current && <>
              {model.decisions.filter(d => d.processId === current.id).map(d => <DecisionRow key={d.id} d={d} model={model} repo={repo} apply={apply} />)}
              {!model.decisions.some(d => d.processId === current.id) && <div className={l.muted}>No configuration decisions on this business process.</div>}
            </>}
            {w.phase === 5 && <>
              <Capture model={model} repo={repo} apply={apply} processId={current?.id ?? null} workshopId={w.id} from={from} onDropFrom={() => setFrom(null)}
                onCaptured={r => { if (from) { setMark({ i: from.i, as: r.reqId || "requirement" }); setFrom(null); } }} />
              {captured.length > 0 && <RequirementList model={model} repo={repo} apply={apply} rows={captured.filter(r => !current || r.processId === current.id)} />}
            </>}
            {w.phase === 6 && <>
              <div className={l.section} style={{ marginTop: 0 }}>Read back</div>
              <ol style={{ margin: 0, paddingLeft: 20 }}>{lines.map((x, i) => <li key={i}>{x}</li>)}</ol>
              <div><Button size="small" icon={<Copy16Regular />} onClick={() => navigator.clipboard?.writeText(lines.join("\n"))}>Copy</Button></div>
              <div className={l.section}>Action items</div>
              {w.session.actions.map((a, i) => (
                <div key={i} className={l.row}>
                  <Checkbox checked={!!a.done} onChange={(_, d) => save({ session: { ...w.session, actions: w.session.actions.map((x, k) => (k === i ? { ...x, done: !!d.checked } : x)) } })} />
                  <span style={{ flexGrow: 1, textDecoration: a.done ? "line-through" : undefined }} title={a.source || undefined}>{a.text}{a.source && <span className={l.muted} style={{ fontSize: 11, display: "block" }}>{a.source}</span>}</span>
                  <Input size="small" placeholder="Owner" defaultValue={a.owner} onBlur={e => save({ session: { ...w.session, actions: w.session.actions.map((x, k) => (k === i ? { ...x, owner: e.target.value } : x)) } })} />
                  <Input size="small" type="date" defaultValue={a.due} onBlur={e => save({ session: { ...w.session, actions: w.session.actions.map((x, k) => (k === i ? { ...x, due: e.target.value } : x)) } })} />
                </div>
              ))}
              <AddBox placeholder="New action item" onAdd={text => save({ session: { ...w.session, actions: w.session.actions.concat({ text, owner: "", due: "" }) } })} />
              <Field label="Minutes"><Edit multiline value={w.minutes} onSave={v => save({ minutes: v })} /></Field>
              <div className={l.muted} style={{ fontSize: 12 }}>Time spent: {minutesPerVisit(w.session.visits, new Date().toISOString()).map(x => x.name + " " + x.minutes + " min").join(", ") || "none recorded"}</div>
            </>}
          </fieldset>
          {w.phase === 6 && <div><Tooltip content={closed ? "Allow changes again" : "Lock the workshop"} relationship="description">
            <Button appearance={closed ? "secondary" : "primary"} data-emph="workshop-close" onClick={() => save({ status: closed ? SESSION.open : SESSION.closed })}>{closed ? "Reopen the workshop" : "Close the workshop"}</Button>
          </Tooltip></div>}
        </div>
      </div>
        {showTranscript && <TranscriptPanel w={w} agenda={agenda} current={current} closed={closed} save={save} saveSession={saveSession} used={used} onUse={useLine} />}
      {studio && current && <FlowStudio model={model} repo={repo} apply={apply} process={current} onClose={() => { setStudio(false); setFlowNote(null); }}
        note={flowNote ? { text: flowNote.text, onUsed: (_code, name) => { setMark({ i: flowNote.i, as: "Flow change: " + name }); setFlowNote(null); } } : null} />}
      {licenceFor && <LicenceDialog model={model} quote={sourceLine(licenceFor)} onClose={() => setLicenceFor(null)} onSave={(role, type, people) => {
        const u = licenceFor; setLicenceFor(null);
        apply(m => { const r = m.roles.find(x => x.id === role.id) || role; return repo.saveRole(m, r, { licenceType: type, licenceUsers: people, licenceNote: (r.licenceNote ? r.licenceNote + "\n" : "") + sourceLine(u) }); });
        setMark({ i: u.i, as: "Licence: " + role.name + ", " + LICENCE_LABEL[type] });
      }} />}
      {image && (
        <Dialog open onOpenChange={(_, d) => { if (!d.open) setImage(null); }}>
          <DialogSurface style={{ maxWidth: "90vw" }}><DialogBody>
            <DialogTitle>{image.subject}</DialogTitle>
            <DialogContent><img src={image.src} alt={image.subject} style={{ maxWidth: "100%", maxHeight: "70vh", display: "block" }} /></DialogContent>
            <DialogActions><Button appearance="primary" onClick={() => setImage(null)}>Close</Button></DialogActions>
          </DialogBody></DialogSurface>
        </Dialog>
      )}
    </>
  );
}
