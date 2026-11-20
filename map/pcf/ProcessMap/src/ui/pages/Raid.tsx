// The RAID log: Microsoft's Risk, Assumption, Issue, Decision, Action item and Change request, each with its own fields.
// Open questions are Action items marked as a question. A Change request is offered once a sign-off is approved.
import * as React from "react";
import { Button, Checkbox, Field, Input, Switch, Tooltip } from "@fluentui/react-components";
import { Delete16Regular, ChevronDown16Regular, ChevronRight16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Pill, Choice, ListChoice, Pick, Edit, Empty } from "../kit";
import type { Nav } from "../Shell";
import { RAID, SIGNOFF, labels, labelOf } from "../../domain/codes";
import { RAID_FIELDS, raidFilter, raidOpen, raidStatuses } from "../../domain/rules";
import { itemLabel, effectiveScope } from "../../domain/repository";
import type { Model, Raid as RaidItem } from "../../domain/types";

const TYPE_LABEL = labels("raidType");
const STATUS: Record<number, string> = { 1: "Open", 2: "Closed", 3: "All" };
const STATUS_KEY: Record<number, "open" | "closed" | "all"> = { 1: "open", 2: "closed", 3: "all" };
const tone = (t: number) => (t === RAID.risk || t === RAID.issue ? "bad" : t === RAID.decision ? "ok" : t === RAID.change ? "warn" : "info") as "bad" | "ok" | "warn" | "info";
/** Items to link a RAID item to: levels 1 to 3 in scope, scenarios in scope, and the one it is on now. */
const itemChoices = (m: Model, current: string | null) => m.items.filter(x => effectiveScope(m, x) || x.id === current).map(x => ({ id: x.id, name: itemLabel(x) }));
export const approvedSignOff = (m: Model) => m.signOffs.find(s => s.state === SIGNOFF.approved) || null;

export function Raid({ model, repo, apply, nav }: PageProps & { nav: Nav }) {
  const l = useLook();
  const [type, setType] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<number>(1);
  const [questions, setQuestions] = React.useState(false);
  const [open, setOpen] = React.useState<string | null>(nav.focus);
  const approved = approvedSignOff(model);
  const list = raidFilter(model.raids, type, STATUS_KEY[status]).filter(x => !questions || (x.type === RAID.action && x.isQuestion));
  const count = (t: number) => model.raids.filter(x => x.type === t && raidOpen(x.status)).length;
  return (
    <>
      <div className={l.grid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }} data-emph="raid-counts">
        {Object.keys(TYPE_LABEL).map(Number).map(t => (
          <button key={t} className={l.card + " " + l.cardClick} onClick={() => setType(type === t ? null : t)} style={{ textAlign: "left", outline: type === t ? "2px solid " + C.railActive : undefined }}>
            <div className={l.stat}>{count(t)}</div><div className={l.statLabel}>{TYPE_LABEL[t]}{count(t) === 1 ? "" : "s"} open</div>
          </button>
        ))}
      </div>
      <AddRaid model={model} repo={repo} apply={apply} approved={!!approved} />
      <div className={l.card + " " + l.row} data-emph="raid-filter">
        <Choice value={type} labels={TYPE_LABEL} placeholder="All types" onChange={setType} width={170} />
        <Choice value={status} labels={STATUS} onChange={v => setStatus(v ?? 1)} width={120} />
        <Switch label="Open questions only" checked={questions} onChange={(_, d) => setQuestions(d.checked)} />
        <span className={l.muted} style={{ fontSize: 12 }}>{list.length} shown of {model.raids.length}</span>
      </div>
      {!list.length ? <Empty title="Nothing here" text="Add a risk, assumption, issue, decision or action item above. Workshop open points land here as action items." /> : (
        <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 0, padding: 0 }} data-emph="raid-list">
          {list.map(x => <Row key={x.id} x={x} model={model} repo={repo} apply={apply} nav={nav} open={open === x.id} onToggle={() => setOpen(open === x.id ? null : x.id)} />)}
        </div>
      )}
    </>
  );
}

function AddRaid({ model, repo, apply, approved }: PageProps & { approved: boolean }) {
  const l = useLook();
  const [type, setType] = React.useState<number>(RAID.risk);
  const [text, setText] = React.useState("");
  const [itemId, setItemId] = React.useState<string | null>(null);
  const [question, setQuestion] = React.useState(false);
  const types = Object.fromEntries(Object.entries(TYPE_LABEL).filter(([k]) => approved || Number(k) !== RAID.change)) as Record<number, string>;
  const add = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    apply(m => repo.addRaid(m, { type, description: t, itemId, isQuestion: type === RAID.action && question, ...(type === RAID.change ? { signOffId: approvedSignOff(m)?.id || null, requestor: repo.user } : {}) }));
  };
  return (
    <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 8 }} data-emph="raid-add">
      <div className={l.row}>
        <Choice value={type} labels={types} onChange={v => setType(v ?? RAID.risk)} width={160} />
        <Input style={{ flexGrow: 1, minWidth: 260 }} value={text} placeholder={type === RAID.action && question ? "The open question" : "What is it?"} onChange={(_, d) => setText(d.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} data-emph="raid-add-text" />
        <Pick value={itemId} items={itemChoices(model, itemId)} onChange={setItemId} placeholder="No process item" width={220} />
        {type === RAID.action && <Checkbox label="Open question" checked={question} onChange={(_, d) => setQuestion(!!d.checked)} />}
        <Button appearance="primary" disabled={!text.trim()} onClick={add} data-emph="raid-add-go">Add</Button>
      </div>
      {!approved && <span className={l.muted} style={{ fontSize: 12 }}>Change requests are offered once a sign-off is approved: then a change to what it froze becomes a change request (Sign-off, Compare with today).</span>}
    </div>
  );
}

function Row({ x, model, repo, apply, nav, open, onToggle }: PageProps & { x: RaidItem; nav: Nav; open: boolean; onToggle: () => void }) {
  const l = useLook();
  const save = (patch: Partial<RaidItem>) => apply(m => repo.saveRaid(m, m.raids.find(y => y.id === x.id) || x, patch));
  const item = model.items.find(i => i.id === x.itemId);
  const statuses = Object.fromEntries(raidStatuses(x.type).map(v => [v, labelOf("raidStatus", v)])) as Record<number, string>;
  const late = raidOpen(x.status) && !!x.targetDate && x.targetDate < new Date().toISOString().slice(0, 10);
  return (
    <div data-emph="raid-item" data-type={labelOf("raidType", x.type)} style={{ borderBottom: "1px solid " + C.line, padding: "10px 16px", opacity: raidOpen(x.status) ? 1 : 0.6 }}>
      <div className={l.row}>
        <button onClick={onToggle} aria-label={open ? "Fold" : "Open"} style={{ border: 0, background: "transparent", cursor: "pointer", lineHeight: 0 }} data-emph="raid-open">{open ? <ChevronDown16Regular /> : <ChevronRight16Regular />}</button>
        <Pill text={labelOf("raidType", x.type)} tone={tone(x.type)} />
        {x.isQuestion && <Pill text="Open question" tone="info" />}
        {x.priority != null && <Pill text={"Priority " + labelOf("priority", x.priority)} />}
        <span style={{ flexGrow: 1, minWidth: 200, fontWeight: 600 }}>{x.name}</span>
        {item && <button onClick={() => nav.go("processes", item.id)} style={{ border: 0, background: "transparent", color: "#0F766E", cursor: "pointer", fontSize: 12 }}>{itemLabel(item)}</button>}
        <span style={{ fontSize: 12, color: late ? C.bad : C.muted }}>{x.owner || "no owner"}{x.targetDate ? " · " + x.targetDate : ""}</span>
        <Choice value={x.status} labels={statuses} onChange={v => v != null && save({ status: v })} width={130} />
      </div>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 0 4px 26px" }} data-emph="raid-editor">
          <Field label="Description"><Edit multiline value={x.description} onSave={v => v.trim() && save({ description: v })} /></Field>
          <div className={l.fields}>
            <Field label="Type"><ListChoice list="raidType" value={x.type} onChange={v => v != null && save({ type: v })} /></Field>
            <Field label="Owner"><Edit value={x.owner} onSave={v => save({ owner: v })} /></Field>
            <Field label="Target date"><Input type="date" defaultValue={x.targetDate || ""} onBlur={e => { if ((e.target.value || null) !== x.targetDate) save({ targetDate: e.target.value || null }); }} /></Field>
            <Field label="Priority"><ListChoice list="priority" value={x.priority} onChange={v => save({ priority: v })} width={90} /></Field>
            <Field label="Process item"><Pick value={x.itemId} items={itemChoices(model, x.itemId)} onChange={v => save({ itemId: v })} /></Field>
            {x.type === RAID.action && <Field label="Open question"><Switch checked={x.isQuestion} onChange={(_, d) => save({ isQuestion: d.checked })} /></Field>}
            {(RAID_FIELDS[x.type] || []).filter(f => f.kind !== "note").map(f => (
              <Field key={f.key} label={f.label}>
                {f.kind === "choice" && f.list ? <ListChoice list={f.list} value={x[f.key] as number | null} onChange={v => save({ [f.key]: v } as Partial<RaidItem>)} width={180} />
                  : f.kind === "number" ? <Input type="number" min={0} max={100} key={"n" + x[f.key]} defaultValue={x[f.key] != null ? String(x[f.key]) : ""}
                    onBlur={e => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== x[f.key]) save({ [f.key]: v } as Partial<RaidItem>); }} />
                  : <Edit value={String(x[f.key] ?? "")} onSave={v => save({ [f.key]: v } as Partial<RaidItem>)} />}
              </Field>
            ))}
          </div>
          {(RAID_FIELDS[x.type] || []).filter(f => f.kind === "note").map(f => (
            <Field key={f.key} label={f.label}><Edit multiline value={String(x[f.key] ?? "")} onSave={v => save({ [f.key]: v } as Partial<RaidItem>)} /></Field>
          ))}
          {x.source && <div className={l.muted} style={{ fontSize: 12 }}>Heard: “{x.source}”</div>}
          {x.type === RAID.change && x.signOffId && <div className={l.muted} style={{ fontSize: 12 }}>Changes {model.signOffs.find(s => s.id === x.signOffId)?.name || "an approved sign-off"}</div>}
          <div><Tooltip content="Delete" relationship="label"><Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete this " + labelOf("raidType", x.type).toLowerCase() + "? This can't be undone.")) apply(m => repo.deleteRaid(m, x)); }}>Delete</Button></Tooltip></div>
        </div>
      )}
    </div>
  );
}
