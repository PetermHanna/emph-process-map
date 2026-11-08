// Guided discovery workshops: seven phases over an agenda of business processes.
import * as React from "react";
import { Button, Field, Input, Switch, Checkbox, Tooltip } from "@fluentui/react-components";
import { ChevronLeft20Regular, ChevronRight20Regular, Delete16Regular, Copy16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Pill, Pick, Choice, Edit, AddBox, Empty } from "../kit";
import type { Nav } from "../Shell";
import { SESSION, REVIEW_LABEL, DISPOSITION_LABEL, REVIEW } from "../../domain/codes";
import { PHASES, visit, wasVisited, minutesPerVisit, summaryLines } from "../../domain/session";
import { isActive } from "../../domain/rules";
import { areasOf } from "../../domain/repository";
import type { Workshop, BusinessProcess } from "../../domain/types";
import { DecisionRow } from "./Processes";
import { Capture, RequirementList } from "./Requirements";
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
        <Pick value={e2e} items={model.endToEnds} onChange={setE2e} placeholder="All end-to-end processes" width={260} />
        <Button appearance="primary" data-emph="workshop-new" onClick={() => apply(async m => { const r = await repo.addWorkshop(m, e2e); setOpenId(r.workshop.id); return r.model; })}>Start</Button>
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
  const closed = w.status === SESSION.closed;
  const save = (patch: Partial<Workshop>) => apply(m => repo.saveWorkshop(m, m.workshops.find(x => x.id === w.id) || w, patch));
  const agenda = w.session.processIds.map(id => model.processes.find(p => p.id === id)).filter(Boolean) as BusinessProcess[];
  const current = agenda.find(p => p.id === w.session.current) || null;
  const idx = current ? agenda.indexOf(current) : -1;
  const go = (p: BusinessProcess) => save({ session: visit(w.session, p.id, p.name, new Date().toISOString()) });
  const captured = model.requirements.filter(r => r.workshopId === w.id && isActive(r));
  const candidates = model.processes.filter(p => !w.endToEndId || areasOf(model, w.endToEndId).some(a => a.id === p.areaId));
  const lines = summaryLines(captured.map(r => ({ reqId: r.reqId, description: r.description, owner: r.owner, resolution: r.resolution, resolvedBy: r.resolvedBy })),
    agenda.map(p => ({ name: p.name, disposition: p.disposition, visited: wasVisited(w.session.visits, p.id) })), w.session.actions);

  return (
    <>
      <div className={l.row}>
        <Button appearance="subtle" icon={<ChevronLeft20Regular />} onClick={onBack}>All workshops</Button>
        <b style={{ fontSize: 16 }}>{w.name}</b>{closed && <Pill text="Closed" />}
      </div>
      <div className={l.row} data-emph="phases">
        {PHASES.map((ph, i) => (
          <button key={ph.name} onClick={() => save({ phase: i })} style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600,
            background: i === w.phase ? C.railActive : i < w.phase ? "#CCF3EF" : "#F1F5F9", color: i === w.phase ? "#fff" : i < w.phase ? "#0F766E" : C.muted }}>{i + 1}. {ph.name}</button>
        ))}
      </div>
      <div className={l.muted} style={{ fontSize: 13 }}>{PHASES[w.phase].discuss}. Produces: {PHASES[w.phase].produces.toLowerCase()}.</div>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>
        <div className={l.card} style={{ padding: 10 }}>
          <div className={l.section} style={{ marginTop: 0 }}>Agenda</div>
          {agenda.map((p, i) => (
            <div key={p.id} className={l.node + (p.id === w.session.current ? " " + l.nodeOn : "")} onClick={() => !closed && go(p)} style={{ opacity: p.inScope ? 1 : 0.55 }}>
              <span className={l.code} style={{ minWidth: 20 }}>{i + 1}</span><span style={{ flexGrow: 1 }}>{p.name}</span>{wasVisited(w.session.visits, p.id) && <span style={{ color: C.ok }}>✓</span>}
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
              <div style={{ columns: 2 }}>{candidates.map(p => (
                <Checkbox key={p.id} label={p.code + " " + p.name} checked={w.session.processIds.includes(p.id)}
                  onChange={(_, d) => save({ session: { ...w.session, processIds: d.checked ? w.session.processIds.concat(p.id) : w.session.processIds.filter(x => x !== p.id) } })} />
              ))}</div>
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
            {w.phase === 3 && current && <div><Button appearance="primary" onClick={() => setStudio(true)}>Open the process flow for {current.name}</Button></div>}
            {w.phase === 4 && current && <>
              {model.decisions.filter(d => d.processId === current.id).map(d => <DecisionRow key={d.id} d={d} model={model} repo={repo} apply={apply} />)}
              {!model.decisions.some(d => d.processId === current.id) && <div className={l.muted}>No configuration decisions on this business process.</div>}
            </>}
            {w.phase === 5 && <>
              <Capture model={model} repo={repo} apply={apply} processId={current?.id ?? null} workshopId={w.id} />
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
                  <span style={{ flexGrow: 1, textDecoration: a.done ? "line-through" : undefined }}>{a.text}</span>
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
      {studio && current && <FlowStudio model={model} repo={repo} apply={apply} process={current} onClose={() => setStudio(false)} />}
    </>
  );
}
