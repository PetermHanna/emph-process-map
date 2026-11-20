// Conclusion and Close. The Conclusion is one list for the room (scope proposals, cards, fit-gap proposals): agreed, not
// agreed or parked; who was there; the read-back and the action items. Close writes only what was agreed, as set in this
// workshop (How Workshop, its name and date, who was present), with history and undo; ticks Microsoft's child tasks; and
// proposes the next workshop in Microsoft's order.
import * as React from "react";
import { Button, Checkbox, Field, Input, ToggleButton } from "@fluentui/react-components";
import { Copy16Regular, ArrowUndo16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { AddBox, Edit, PageProps, Pill } from "../kit";
import { RAID, RAID_STATUS, SESSION, labelOf } from "../../domain/codes";
import { minutesPerVisit } from "../../domain/session";
import { effectiveScope, itemsAt, childItems, How } from "../../domain/repository";
import { ConclusionItem, RunState, Verdict, ChildTask, agreeRest, conclusionCounts, closeWarnings, closeChanges, closeProblems, nextTemplate, HeldWorkshop, BoardCard, fitChecked, gapAreas, readTasks, kindOfValue, KINDS } from "../../domain/workshop";
import type { Workshop, ProcessItem } from "../../domain/types";
import { GUIDANCE } from "../guidance";

const VERDICTS: { v: Verdict; name: string }[] = [{ v: "agreed", name: "Agreed" }, { v: "not_agreed", name: "Not agreed" }, { v: "parked", name: "Parked" }];
export const peopleOf = (w: Workshop) => w.participants.split(/\n|,/).map(x => x.trim()).filter(Boolean);

export function Conclusion({ model, repo, apply, w, run, onRun, items, lines, closed }: PageProps & { w: Workshop; run: RunState; onRun: (fn: (r: RunState) => RunState) => void; items: ConclusionItem[]; lines: string[]; closed: boolean }) {
  const l = useLook();
  const c = conclusionCounts(items, run);
  const people = Array.from(new Set(peopleOf(w).concat(run.present)));
  const openPoints = model.raids.filter(r => r.workshopId === w.id && r.type === RAID.action);
  const setVerdict = (key: string, v: Verdict) => onRun(r => { const verdicts = { ...r.verdicts }; if (verdicts[key] === v) delete verdicts[key]; else verdicts[key] = v; return { ...r, verdicts }; });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-emph="conclusion">
      <div className={l.section} style={{ marginTop: 0 }}>For the room to agree <span className={l.muted} style={{ fontWeight: 400, fontSize: 12 }} data-emph="conclusion-counts">· {items.length} items: {c.agreed} agreed, {c.notAgreed} not agreed, {c.parked} parked, {c.open} open</span></div>
      {!items.length && <div className={l.muted}>Nothing proposed: no scope, card or fit-gap proposals in this workshop. Requirements and RAID items were saved as they were captured.</div>}
      {items.map(i => (
        <div key={i.key} className={l.row} data-emph="conclusion-item" data-key={i.key} style={{ borderBottom: "1px solid " + C.line, paddingBottom: 4 }}>
          <span style={{ flexGrow: 1 }}><Pill text={i.kind} tone={/struck|Gap/.test(i.kind) ? "warn" : "info"} /> {i.text}</span>
          {VERDICTS.map(x => <ToggleButton key={x.v} size="small" disabled={closed} checked={run.verdicts[i.key] === x.v} data-emph={"verdict-" + x.v} onClick={() => setVerdict(i.key, x.v)}>{x.name}</ToggleButton>)}
        </div>
      ))}
      {c.open > 0 && !closed && <div><Button size="small" data-emph="agree-rest" onClick={() => onRun(r => agreeRest(r, items))}>Agree the rest as proposed ({c.open})</Button></div>}
      <div className={l.section}>Present</div>
      <div className={l.row} data-emph="present">
        {people.map(p => <Checkbox key={p} label={p} disabled={closed} checked={run.present.includes(p)} onChange={(_, d) => onRun(r => ({ ...r, present: d.checked ? Array.from(new Set(r.present.concat(p))) : r.present.filter(x => x !== p) }))} />)}
        {!people.length && <span className={l.muted}>Add the participants in Prepare.</span>}
      </div>
      <div className={l.section}>Read back</div>
      <ol style={{ margin: 0, paddingLeft: 20 }}>{lines.map((x, i) => <li key={i}>{x}</li>)}</ol>
      <div><Button size="small" icon={<Copy16Regular />} onClick={() => navigator.clipboard?.writeText(lines.join("\n"))}>Copy</Button></div>
      <div className={l.section}>Action items <span className={l.muted} style={{ fontWeight: 400, fontSize: 12 }}>(RAID)</span></div>
      {openPoints.map(a => (
        <div key={a.id} className={l.row} data-emph="action-item">
          <Checkbox checked={a.status === RAID_STATUS.closed} disabled={closed} onChange={(_, d) => apply(m => repo.saveRaid(m, m.raids.find(x => x.id === a.id) || a, { status: d.checked ? RAID_STATUS.closed : RAID_STATUS.open }))} />
          <span style={{ flexGrow: 1, textDecoration: a.status === RAID_STATUS.closed ? "line-through" : undefined }} title={a.source || undefined}>{a.isQuestion && <Pill text="question" tone="info" />} {a.description}{a.source && <span className={l.muted} style={{ fontSize: 11, display: "block" }}>{a.source}</span>}</span>
          <Input size="small" placeholder="Owner" defaultValue={a.owner} disabled={closed} onBlur={e => { if (e.target.value !== a.owner) apply(m => repo.saveRaid(m, m.raids.find(x => x.id === a.id) || a, { owner: e.target.value })); }} />
          <Input size="small" type="date" defaultValue={a.targetDate || ""} disabled={closed} onBlur={e => { if ((e.target.value || null) !== a.targetDate) apply(m => repo.saveRaid(m, m.raids.find(x => x.id === a.id) || a, { targetDate: e.target.value || null })); }} />
        </div>
      ))}
      {!closed && <AddBox placeholder="New action item" onAdd={text => apply(m => repo.addRaid(m, { type: RAID.action, description: text, workshopId: w.id, itemId: w.itemId }))} />}
      <Field label="Minutes"><Edit multiline value={w.minutes} disabled={closed} onSave={v => apply(m => repo.saveWorkshop(m, m.workshops.find(x => x.id === w.id) || w, { minutes: v }))} /></Field>
      <div className={l.muted} style={{ fontSize: 12 }}>Time spent: {minutesPerVisit(w.session.visits, new Date().toISOString()).map(x => x.name + " " + x.minutes + " min").join(", ") || "none recorded"}</div>
    </div>
  );
}

/** What each workshop was, for the next workshop in Microsoft's order. */
export function heldOf(w: Workshop, items: ProcessItem[]): HeldWorkshop {
  const run = w.session.run;
  const kind = run?.kind || kindOfValue(w.kind);
  const e2e = items.find(x => x.id === w.itemId);
  return { kind, template: run?.template || "", unit: run?.unit || w.units || e2e?.code || "", closed: w.status === SESSION.closed, quick: run?.track === "quick", checked: run ? fitChecked(run) : false,
    gapAreas: run ? gapAreas(run, items).map(id => items.find(x => x.id === id)).filter(Boolean).map(a => ({ code: a!.code, name: a!.catalogName || a!.name })) : [] };
}

export function Close({ model, repo, apply, w, run, items, cards, closed, how, onPlanned }: PageProps & {
  w: Workshop; run: RunState; items: ConclusionItem[]; cards: BoardCard[]; closed: boolean; how: How; onPlanned: (id: string) => void;
}) {
  const l = useLook();
  const [problem, setProblem] = React.useState<string | null>(null);
  const tasks = readTasks(w.childTasks);
  const changes = closeChanges(run, cards, model.items, w.name);
  const problems = closeProblems(changes);
  const warnings = closeWarnings(items, run, tasks);
  const saveTasks = (t: ChildTask[]) => apply(m => repo.saveWorkshop(m, m.workshops.find(x => x.id === w.id) || w, { childTasks: JSON.stringify(t) }));
  const e2eInScope = itemsAt(model, 1).filter(e => effectiveScope(model, e)).map(e => e.code);
  const areasInScope = Object.fromEntries(itemsAt(model, 1).map(e => [e.code, childItems(model, e.id).filter(a => effectiveScope(model, a)).map(a => ({ code: a.code, name: a.catalogName || a.name }))]));
  const next = closed ? nextTemplate(GUIDANCE, heldOf(w, model.items), model.workshops.filter(x => x.id !== w.id).map(x => heldOf(x, model.items)), e2eInScope, areasInScope) : null;
  const planned = next ? model.workshops.find(x => x.id !== w.id && x.session.run?.template === next.template.id && x.status !== SESSION.closed) : undefined;
  const doClose = () => { setProblem(null); apply(m => repo.closeWorkshop(m, m.workshops.find(x => x.id === w.id) || w, changes, how, tasks)).catch(e => setProblem(String(e?.message || e))); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-emph="close">
      {tasks.length > 0 && <>
        <div className={l.section} style={{ marginTop: 0 }}>Microsoft's child tasks <span className={l.muted} style={{ fontWeight: 400, fontSize: 12 }}>(the workshop's output)</span></div>
        {tasks.map((t, i) => <Checkbox key={t.id} data-emph="child-task" label={t.id + " " + t.title} checked={t.done} onChange={(_, d) => saveTasks(tasks.map((x, k) => (k === i ? { ...x, done: !!d.checked } : x)))} />)}
      </>}
      {!closed && <>
        <div className={l.section}>Close writes</div>
        {changes.length ? <ul style={{ margin: 0, paddingLeft: 20 }} data-emph="close-changes">{changes.map(c => <li key={c.itemId}>{c.label}</li>)}</ul>
          : <div className={l.muted}>Nothing to write: no agreed scope, card or fit-gap that differs from today.</div>}
        <div className={l.muted} style={{ fontSize: 12 }}>Each change is recorded as set in a workshop: {w.name}, {w.heldOn || "no date"}, present: {how.present || "nobody marked"}.</div>
        {warnings.map(x => <div key={x} style={{ color: C.warn }} data-emph="close-warning">{x}</div>)}
        {problems.map(x => <div key={x} style={{ color: C.bad }}>{x}</div>)}
        {problem && <div style={{ color: C.bad }}>{problem}</div>}
        <div><Button appearance="primary" data-emph="workshop-close" disabled={problems.length > 0} onClick={doClose}>Close the workshop{changes.length ? " and write " + changes.length + " change" + (changes.length === 1 ? "" : "s") : ""}</Button></div>
      </>}
      {closed && <>
        <div className={l.section}>Written at Close <span className={l.muted} style={{ fontWeight: 400, fontSize: 12 }}>{run.closedOn ? new Date(run.closedOn).toLocaleString() : ""}</span></div>
        {(run.written || []).length ? <ul style={{ margin: 0, paddingLeft: 20 }} data-emph="close-written">{run.written!.map(x => <li key={x.itemId}>{x.label}</li>)}</ul> : <div className={l.muted}>Nothing was written.</div>}
        <div className={l.row}>
          <Button icon={<ArrowUndo16Regular />} data-emph="close-undo" onClick={() => { if (window.confirm("Undo what Close wrote and open the workshop again?")) apply(m => repo.undoClose(m, m.workshops.find(x => x.id === w.id) || w)); }}>
            {(run.written || []).length ? "Undo what Close wrote and reopen" : "Reopen the workshop"}</Button>
        </div>
        <div className={l.section}>Next workshop</div>
        {next ? (
          <div data-emph="next-workshop" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div><b>{next.template.title}</b> <Pill text={KINDS.find(k => k.kind === next.template.kind)!.label} tone="brand" /></div>
            <div className={l.muted} style={{ fontSize: 13 }}>{next.why}</div>
            {planned ? <div><Button size="small" onClick={() => onPlanned(planned.id)}>Open {planned.name}</Button></div>
              : <div><Button size="small" appearance="primary" data-emph="next-plan" onClick={() => apply(async m => { const e = m.items.find(x => x.level === 1 && x.code === next.template.unit.slice(0, 2)); const r = await repo.addWorkshop(m, e?.id ?? null, { template: next.template }); onPlanned(r.workshop.id); return r.model; })}>Plan this workshop</Button></div>}
          </div>
        ) : <div className={l.muted}>Microsoft's workshops of the end-to-end processes in scope are all held.</div>}
      </>}
    </div>
  );
}

export const kindLabel = (w: Workshop) => KINDS.find(k => k.kind === (w.session.run?.kind || kindOfValue(w.kind)))!.label + (w.session.run?.track === "quick" ? ", quick track" : "") + (w.msType != null ? " · " + labelOf("microsoftWorkshopType", w.msType) : "");
