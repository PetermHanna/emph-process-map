// The catalog tree (levels 1 to 4) on the left, the selected process item on the right, with Microsoft's fields.
import * as React from "react";
import { Button, Field, Checkbox, Dropdown, Option, Input, Textarea, Tooltip } from "@fluentui/react-components";
import { ChevronDown16Regular, ChevronRight16Regular, Flowchart20Regular, Delete16Regular, Add16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Pill, Choice, ListChoice, FitGapPick, Edit, AddBox, Empty, ScopePick } from "../kit";
import type { Nav } from "../Shell";
import { ANSWER, ANSWER_LABEL, DECISION_STATE, FIT_GAP, FLOW_STATE, SCOPE, LEVEL_LABEL, labelOf } from "../../domain/codes";
import { itemFitGap, productsOf, levelUp, offAbove, isOff, fitFromScenarios, softwareOf, OWN_RULE } from "../../domain/rules";
import { ItemHistory } from "./History";
import { childItems, rolesOf, flowsOf, effectiveScope, itemsAt, itemLabel } from "../../domain/repository";
import type { ConfigDecision, Model, ProcessItem } from "../../domain/types";
import type { Repository } from "../../domain/repository";
import { FlowStudio } from "../flow/FlowStudio";
import { areaIcon, endToEndIcon, Tile } from "../icons";
import { RequirementList, Capture } from "./Requirements";

export function Processes({ model, repo, apply, nav }: PageProps & { nav: Nav }) {
  const l = useLook();
  const [sel, setSel] = React.useState<string | null>(nav.focus);
  const [open, setOpen] = React.useState<Set<string>>(() => {
    const s = new Set<string>();
    const f = model.items.find(x => x.id === nav.focus);
    for (let p = f && model.items.find(x => x.id === f.parentId); p; p = model.items.find(x => x.id === p!.parentId)) s.add(p.id);
    return s;
  });
  const toggle = (id: string) => setOpen(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  /** Select an item; from a panel link (expand) its branch opens too, from the tree the click toggles it instead. */
  const pick = (id: string, expand = true) => { setSel(id); if (expand) setOpen(o => new Set(o).add(id)); };
  const [filter, setFilter] = React.useState("");
  const f = filter.trim().toLowerCase();
  const match = (p: ProcessItem) => !f || p.name.toLowerCase().includes(f) || p.code.toLowerCase().includes(f);
  const chevron = (id: string) => (open.has(id) || f ? <ChevronDown16Regular /> : <ChevronRight16Regular />);
  const cur = model.items.find(x => x.id === sel);
  const dim = (it: ProcessItem) => ({ opacity: effectiveScope(model, it) ? 1 : 0.5 });

  return (
    <div className={l.split}>
      <div className={l.card} style={{ padding: 10 }}>
        <Input placeholder="Find a business process" value={filter} onChange={(_, d) => setFilter(d.value)} style={{ width: "100%", marginBottom: 8 }} />
        <div className={l.tree} data-emph="process-tree">
          {itemsAt(model, 1).map(e => (
            <React.Fragment key={e.id}>
              <div className={l.node + (sel === e.id ? " " + l.nodeOn : "")} onClick={() => { pick(e.id, false); toggle(e.id); }} style={{ fontWeight: 600, ...dim(e) }}>
                {chevron(e.id)}<Tile icon={endToEndIcon(e.code)} colour={effectiveScope(model, e) && e.accent ? e.accent : "#64748B"} size={20} filled={effectiveScope(model, e)} /><span className={l.code} style={{ minWidth: 24 }}>{e.code}</span><span style={{ flexGrow: 1 }}>{e.name}</span>{scopeTag(e)}
              </div>
              {(open.has(e.id) || f) && childItems(model, e.id).map(a => {
                const procs = childItems(model, a.id).filter(match);
                if (f && !procs.length) return null;
                return (
                  <React.Fragment key={a.id}>
                    <div className={l.node + (sel === a.id ? " " + l.nodeOn : "")} style={{ paddingLeft: 22, ...dim(a) }} onClick={() => { pick(a.id, false); toggle(a.id); }}>
                      {chevron(a.id)}<Tile icon={areaIcon(a.name, e.code)} colour={effectiveScope(model, a) && e.accent ? e.accent : "#64748B"} size={20} /><span className={l.code} style={{ minWidth: 40 }}>{a.code}</span><span style={{ flexGrow: 1 }}>{a.name}</span>{scopeTag(a)}
                    </div>
                    {(open.has(a.id) || f) && procs.map(p => (
                      <React.Fragment key={p.id}>
                        <div data-emph="process-node" className={l.node + (sel === p.id ? " " + l.nodeOn : "")} style={{ paddingLeft: 42, ...dim(p) }} onClick={() => { pick(p.id, false); toggle(p.id); }}>
                          <span className={l.code}>{p.code}</span><span style={{ flexGrow: 1 }}>{p.name}</span>
                          {scopeTag(p)}{fitDot(model, p)}
                        </div>
                        {open.has(p.id) && childItems(model, p.id).map(s => (
                          <div key={s.id} data-emph="scenario-node" className={l.node + (sel === s.id ? " " + l.nodeOn : "")} style={{ paddingLeft: 62, fontSize: 12, ...dim(s) }} onClick={() => pick(s.id, false)}>
                            <span className={l.code}>{s.code.split(".").pop()}</span><span style={{ flexGrow: 1 }}>{s.name}</span>
                            {s.scope === SCOPE.in ? <span title="20 - In scope" style={{ color: C.ok, fontSize: 10 }}>in</span> : scopeTag(s)}{fitDot(model, s)}
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className={l.muted} style={{ marginTop: 10, fontSize: 12 }} data-emph="own-e2e-rule">{OWN_RULE[1].note}</div>
      </div>
      <div>
        {!cur && <Empty title="Pick an item" text="Choose an end-to-end process, a process area, a business process or a scenario on the left." />}
        {cur && cur.level === 3 && <ProcessPanel key={cur.id} p={cur} model={model} repo={repo} apply={apply} onDeleted={() => setSel(null)} onPick={pick} />}
        {cur && cur.level !== 3 && <ItemPanel key={cur.id} it={cur} model={model} repo={repo} apply={apply} onPick={pick} onDeleted={() => setSel(null)} />}
      </div>
    </div>
  );
}

/** The item's fit-gap: its own, else read up from its scenarios in scope, else from its requirements. */
export const fitOf = (m: Model, p: ProcessItem) => p.fitGap ?? (p.level === 3 ? fitFromScenarios(m.items, p) : null) ?? itemFitGap(m.requirements, p.id).fitGap;
const fitDot = (m: Model, p: ProcessItem) => {
  const f = fitOf(m, p);
  return f === FIT_GAP.fit ? <span title="Fit" style={{ color: C.ok }}>●</span> : f === FIT_GAP.gap ? <span title="Gap" style={{ color: C.bad }}>●</span> : null;
};
/** A short tag in the tree for an item out of scope or not applicable. */
const scopeTag = (it: ProcessItem) => (isOff(it.scope) ? <span title={labelOf("scope", it.scope) + (it.scopeReason ? ": " + it.scopeReason : "")} style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap" }} data-emph="scope-tag">{it.scope === SCOPE.na ? "n/a" : "out"}</span> : null);

/** Scope with the values of the item's level and, when out or not applicable, its reason. */
function ScopeField({ it, model, repo, apply }: PageProps & { it: ProcessItem }) {
  const l = useLook();
  const above = offAbove(model.items, it);
  const greyed = !isOff(it.scope) && !effectiveScope(model, it);
  const hint = above ? "Greyed: " + itemLabel(above) + " is " + labelOf("scope", above.scope).replace(/^\d+ - /, "").toLowerCase() + "." : greyed ? "An item above it is not in scope yet, so it counts as out."
    : it.level === 3 ? "A business process takes fit/gap; its scope is only Not applicable." : undefined;
  return (
    <Field label="Scope" hint={hint} style={{ gridColumn: "span 2" }}>
      <span className={l.row} data-emph="scope-field"><ScopePick it={it} repo={repo} apply={apply} width={170} /></span>
    </Field>
  );
}
/** Microsoft's owners, Baseline complexity and Priority (levels 3 and 4). */
function OwnerFields({ it, save, placeholder }: { it: ProcessItem; save: (patch: Partial<ProcessItem>) => void; placeholder?: string }) {
  return (
    <>
      <Field label="Business process owner"><Edit value={it.owner} onSave={v => save({ owner: v })} placeholder={placeholder || "Name or role"} /></Field>
      <Field label="Workstream lead"><Edit value={it.workstreamLead} onSave={v => save({ workstreamLead: v })} /></Field>
      <Field label="Subject matter expert"><Edit value={it.sme} onSave={v => save({ sme: v })} /></Field>
      <Field label="Baseline complexity"><ListChoice list="baselineComplexity" value={it.complexity} onChange={v => save({ complexity: v })} /></Field>
      <Field label="Priority"><ListChoice list="priority" value={it.priority} onChange={v => save({ priority: v })} width={90} /></Field>
    </>
  );
}

/** Who set scope or fit-gap, how and when (Microsoft's Set how / by / on). */
const setLine = (it: ProcessItem) => it.setOn ? [labelOf("setHow", it.setHow), it.setBy, it.setOn, it.workshopName && "in " + it.workshopName].filter(Boolean).join(" · ") : "";

function ItemPanel({ it, model, repo, apply, onPick, onDeleted }: PageProps & { it: ProcessItem; onPick: (id: string) => void; onDeleted: () => void }) {
  const l = useLook();
  const save = (patch: Partial<ProcessItem>) => apply(m => repo.saveItem(m, m.items.find(x => x.id === it.id) || it, patch));
  const kids = childItems(model, it.id);
  const e2e = levelUp(model.items, it, 1);
  const products = productsOf(model.items, it);
  return (
    <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 12 }} data-emph="item-panel">
      <div className={l.row}>
        {it.level <= 2 && <Tile icon={it.level === 1 ? endToEndIcon(it.code) : areaIcon(it.name, e2e?.code || "")} colour={e2e?.accent || C.railActive} size={36} filled={it.level === 1} />}
        <Pill text={LEVEL_LABEL[it.level]} tone={it.level === 1 ? "brand" : "info"} /><span className={l.code}>{it.code}</span>
        {it.isOwn && <Pill text="Our own" tone="info" />}
        {!effectiveScope(model, it) && <Pill text="Not in scope" />}
        <span style={{ flexGrow: 1 }} />
        {it.isOwn && <Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete “" + it.name + "” and our own items below it?")) apply(async m => { const n = await repo.deleteOwnItem(m, it); onDeleted(); return n; }); }}>Delete</Button>}
      </div>
      <div className={l.fields}>
        <Field label="Name" hint={it.catalogName && it.catalogName !== it.name ? "Microsoft: " + it.catalogName : undefined}><Edit value={it.name} onSave={v => v.trim() && save({ name: v.trim() })} /></Field>
        <Field label="Process sequence ID"><Edit value={it.code} onSave={v => save({ code: v.trim() })} /></Field>
        <ScopeField it={it} model={model} repo={repo} apply={apply} />
        {it.level === 1 && <Field label="Accent colour"><Edit value={it.accent} onSave={v => save({ accent: v.trim() })} placeholder="#0D9488" /></Field>}
        {it.level === 4 && <Field label="Fit gap status"><FitGapPick fitGap={it.fitGap} gapApproach={it.gapApproach} onSave={(fitGap, gapApproach) => save({ fitGap, gapApproach })} /></Field>}
        {it.level === 4 && <Field label="Fit gap rationale"><Edit value={it.fitGapReason} onSave={v => save({ fitGapReason: v })} /></Field>}
        {it.level === 4 && <Field label="Products" hint="The software that runs this scenario"><Edit value={it.products} onSave={v => save({ products: v })} /></Field>}
        {it.level === 4 && (it.isOwn || softwareOf({ products: it.products }).includes("Other")) && <Field label="Software solutions" hint="When Products is Other: the software (SAP S/4HANA, DATEV)"><Edit value={it.softwareSolution} onSave={v => save({ softwareSolution: v })} /></Field>}
        {it.level === 4 && <OwnerFields it={it} save={save} />}
      </div>
      {setLine(it) && <div className={l.muted} style={{ fontSize: 12 }}>Set: {setLine(it)}</div>}
      {it.level < 4 && products.length > 0 && <div className={l.row} data-emph="item-products"><span className={l.muted} style={{ fontSize: 12 }}>Products, from the scenarios in scope:</span>{products.map(x => <Pill key={x} text={x} tone="brand" />)}</div>}
      <Field label="Description"><Edit multiline value={it.summary} onSave={v => save({ summary: v })} /></Field>
      <ItemHistory model={model} repo={repo} apply={apply} table="emph_processitem" rowId={it.id} />
      {it.level < 4 && <>
        <div className={l.section}>{LEVEL_LABEL[it.level + 1]}s ({kids.length})</div>
        <table className={l.table}>
          <thead><tr><th>ID</th><th>{LEVEL_LABEL[it.level + 1]}</th><th>Scope</th><th>Fit gap</th></tr></thead>
          <tbody>{kids.map(k => (
            <tr key={k.id} className={l.tr} onClick={() => onPick(k.id)} style={{ opacity: effectiveScope(model, k) ? 1 : 0.55 }}>
              <td className={l.code}>{k.code}</td><td>{k.name} {k.isOwn && <Pill text="Our own" tone="info" />}</td>
              <td onClick={ev => ev.stopPropagation()}><ScopePick it={k} repo={repo} apply={apply} reason={false} width={150} /></td>
              <td>{k.level >= 3 ? labelOf("fitGapStatus", fitOf(model, k)) : ""}</td>
            </tr>
          ))}</tbody>
        </table>
        {it.level < 3 && <OwnItem level={it.level + 1} onAdd={(name, reason) => apply(async m => { const r = await repo.addOwnItem(m, it.id, name, "", reason); onPick(r.item.id); return r.model; })} />}
      </>}
    </div>
  );
}

function ProcessPanel({ p, model, repo, apply, onDeleted, onPick }: PageProps & { p: ProcessItem; onDeleted: () => void; onPick: (id: string) => void }) {
  const l = useLook();
  const [studio, setStudio] = React.useState(false);
  const save = (patch: Partial<ProcessItem>) => apply(m => repo.saveItem(m, m.items.find(x => x.id === p.id) || p, patch));
  const roles = rolesOf(model, p.id);
  const { reference, ours } = flowsOf(model, p.id);
  const decisions = model.decisions.filter(d => d.itemId === p.id);
  const scenarios = childItems(model, p.id);
  const reqs = model.requirements.filter(r => r.itemId === p.id || scenarios.some(s => s.id === r.itemId));
  const fromReqs = itemFitGap(model.requirements, p.id);
  const fromScenarios = fitFromScenarios(model.items, p);
  const products = productsOf(model.items, p);
  const area = levelUp(model.items, p, 2);
  const systems = model.systems.filter(s => s.itemId === p.id || s.itemId === area?.id);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-emph="process-panel">
      <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className={l.row}>
          <span className={l.code}>{p.code}</span>
          <Pill text={p.isOwn ? "Our own" : "Microsoft catalog"} tone={p.isOwn ? "info" : "brand"} />
          {!effectiveScope(model, p) && <Pill text="Not in scope" />}
          {fromReqs.gaps > 0 && <Pill text={fromReqs.gaps + " gap" + (fromReqs.gaps === 1 ? "" : "s") + " in requirements"} tone="bad" />}
          <span style={{ flexGrow: 1 }} />
          {p.isOwn && <Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete “" + p.name + "” and its flows? Requirements stay, marked for review.")) apply(async m => { const n = await repo.deleteOwnItem(m, p); onDeleted(); return n; }); }}>Delete</Button>}
        </div>
        <Edit value={p.name} onSave={v => v.trim() && save({ name: v.trim() })} />
        {p.catalogName && p.catalogName !== p.name && <div className={l.muted} style={{ fontSize: 12, marginTop: -6 }}>Microsoft name: {p.catalogName} <Button size="small" appearance="transparent" onClick={() => save({ name: p.catalogName })}>Use Microsoft's name</Button></div>}
        <div className={l.fields}>
          <ScopeField it={p} model={model} repo={repo} apply={apply} />
          <Field label="Fit gap status" hint={p.fitGap == null && fromScenarios != null ? "Scenarios say: " + labelOf("fitGapStatus", fromScenarios) : p.fitGap == null && fromReqs.fitGap != null ? "Requirements say: " + labelOf("fitGapStatus", fromReqs.fitGap) : undefined}>
            <FitGapPick fitGap={p.fitGap} gapApproach={p.gapApproach} onSave={(fitGap, gapApproach) => save({ fitGap, gapApproach })} />
          </Field>
          <Field label="Fit gap rationale"><Edit value={p.fitGapReason} onSave={v => save({ fitGapReason: v })} /></Field>
          <OwnerFields it={p} save={save} placeholder={roles[0]?.name} />
        </div>
        {setLine(p) && <div className={l.muted} style={{ fontSize: 12 }} data-emph="set-line">Set: {setLine(p)}</div>}
        <ItemHistory model={model} repo={repo} apply={apply} table="emph_processitem" rowId={p.id} />
        <Field label="Roles involved">
          <div className={l.row}>
            {model.roles.map(r => <Checkbox key={r.id} label={r.name} checked={roles.some(x => x.id === r.id)} onChange={(_, d) => apply(m => repo.setItemRoles(m, p.id, d.checked ? roles.map(x => x.id).concat(r.id) : roles.filter(x => x.id !== r.id).map(x => x.id)))} />)}
            {!model.roles.length && <span className={l.muted}>Add roles under Settings.</span>}
          </div>
        </Field>
        <div className={l.row} data-emph="process-systems">
          <span className={l.muted} style={{ fontSize: 12 }}>Today:</span>
          {systems.length ? systems.map(s => <Pill key={s.id} text={s.name + (s.decision != null ? " · " + labelOf("systemDecision", s.decision) : "")} />) : <span className={l.muted} style={{ fontSize: 12 }}>no current system recorded (Systems page)</span>}
          <span className={l.muted} style={{ fontSize: 12, marginLeft: 12 }}>Target:</span>
          {products.length ? products.map(x => <Pill key={x} text={x} tone="brand" />) : <span className={l.muted} style={{ fontSize: 12 }}>no scenario in scope</span>}
        </div>
        <Field label="Description"><Edit multiline value={p.summary} onSave={v => save({ summary: v })} /></Field>
        <Field label="Comments"><Edit multiline value={p.comments} onSave={v => save({ comments: v })} /></Field>
      </div>

      <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 8 }} data-emph="scenarios">
        <div className={l.section} style={{ marginTop: 0 }}>Scenarios ({scenarios.filter(s => effectiveScope(model, s)).length} of {scenarios.length} in scope)</div>
        <div className={l.muted} style={{ fontSize: 12 }}>A scenario is the business process run in one piece of software: its scope says which software we use for it.</div>
        {scenarios.length > 0 && <table className={l.table}>
          <thead><tr><th>ID</th><th>Scenario</th><th>Software</th><th>Scope</th><th>Fit gap status</th></tr></thead>
          <tbody>{scenarios.map(s => {
            const saveS = (patch: Partial<ProcessItem>) => apply(m => repo.saveItem(m, m.items.find(x => x.id === s.id) || s, patch));
            return (
              <tr key={s.id} style={{ opacity: effectiveScope(model, s) ? 1 : 0.55 }} data-emph="scenario-row">
                <td className={l.code} onClick={() => onPick(s.id)} style={{ cursor: "pointer" }}>{s.code}</td>
                <td onClick={() => onPick(s.id)} style={{ cursor: "pointer" }}>{s.name} {s.isOwn && <Pill text="Our own" tone="info" />}</td>
                <td className={l.muted} style={{ fontSize: 12 }}>{softwareOf(s).join(", ")}</td>
                <td><ScopePick it={s} repo={repo} apply={apply} reason={false} width={150} /></td>
                <td><FitGapPick fitGap={s.fitGap} gapApproach={s.gapApproach} onSave={(fitGap, gapApproach) => saveS({ fitGap, gapApproach })} /></td>
              </tr>
            );
          })}</tbody>
        </table>}
        <OwnScenario onAdd={(name, software) => apply(async m => (await repo.addOwnItem(m, p.id, name, software)).model)} example={p.name} />
      </div>

      <div className={l.card} style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Flowchart20Regular style={{ color: C.railActive }} />
        <div style={{ flexGrow: 1 }}>
          <div style={{ fontWeight: 600 }}>Process flow</div>
          <div className={l.muted} style={{ fontSize: 12 }}>
            {ours ? "Our process: " + (ours.state === FLOW_STATE.confirmed ? "confirmed" : "draft") + (reference ? ", based on the Microsoft reference" : "") : reference ? "Microsoft reference available. Adapt it to record how you work." : "No reference flow. Draw our process from a blank start."}
          </div>
        </div>
        <Button appearance="primary" data-emph="open-flow" onClick={() => setStudio(true)}>{ours || reference ? "Open flow" : "Draw our process"}</Button>
      </div>
      {studio && <FlowStudio model={model} repo={repo} apply={apply} process={p} onClose={() => setStudio(false)} />}

      <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className={l.section} style={{ marginTop: 0 }}>Configuration decisions ({decisions.filter(d => d.answer.trim()).length} of {decisions.length} answered)</div>
        {decisions.map(d => <DecisionRow key={d.id} d={d} repo={repo} apply={apply} model={model} />)}
        <NewDecision onAdd={(q, t) => apply(m => repo.addDecision(m, p.id, q, t))} />
      </div>

      <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className={l.section} style={{ marginTop: 0 }}>Requirements ({reqs.length})</div>
        <Capture model={model} repo={repo} apply={apply} itemId={p.id} />
        {reqs.length > 0 && <RequirementList model={model} repo={repo} apply={apply} rows={reqs} hideItem />}
      </div>
    </div>
  );
}

/** Our own scenario: Microsoft names level 4 "<process> by using <software>"; Products Other, the software in Software solutions. */
/** Our own process area or business process, with the reason Microsoft asks for (its approval, or why the catalog doesn't cover it). */
function OwnItem({ level, onAdd }: { level: number; onAdd: (name: string, reason: string) => void }) {
  const l = useLook();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [reason, setReason] = React.useState("");
  const rule = OWN_RULE[level];
  const go = () => { if (!name.trim() || !reason.trim()) return; onAdd(name.trim(), reason.trim()); setName(""); setReason(""); setOpen(false); };
  if (!open) return <Button size="small" appearance="subtle" icon={<Add16Regular />} data-emph="own-item-open" onClick={() => setOpen(true)}>{"Our own " + LEVEL_LABEL[level].toLowerCase()}</Button>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, borderLeft: "3px solid " + C.warn, paddingLeft: 8 }} data-emph="own-item">
      <div style={{ fontSize: 12, color: C.warn }}>{rule.note}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Input style={{ flexGrow: 1, minWidth: 220 }} value={name} placeholder={"Our own " + LEVEL_LABEL[level].toLowerCase()} onChange={(_, d) => setName(d.value)} />
        <Input style={{ flexGrow: 1, minWidth: 220 }} value={reason} placeholder={rule.reason} onChange={(_, d) => setReason(d.value)} onKeyDown={e => { if (e.key === "Enter") go(); }} />
        <Button icon={<Add16Regular />} disabled={!name.trim() || !reason.trim()} onClick={go}>Add</Button>
        <Button appearance="subtle" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <span className={l.muted} style={{ fontSize: 11 }}>It gets a number after Microsoft's under this item, Catalog status 50 - Custom and Author Project.</span>
    </div>
  );
}

function OwnScenario({ onAdd, example }: { onAdd: (name: string, software: string) => void; example: string }) {
  const [name, setName] = React.useState("");
  const [software, setSoftware] = React.useState("");
  const go = () => { if (!name.trim()) return; onAdd(name.trim(), software.trim()); setName(""); setSoftware(""); };
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} data-emph="own-scenario">
      <Input style={{ flexGrow: 1, minWidth: 260 }} value={name} placeholder={"Our own scenario, e.g. " + example + " by using SAP S/4HANA"} onChange={(_, d) => setName(d.value)} onKeyDown={e => { if (e.key === "Enter") go(); }} />
      <Input style={{ width: 200 }} value={software} placeholder="Software solution" onChange={(_, d) => setSoftware(d.value)} onKeyDown={e => { if (e.key === "Enter") go(); }} />
      <Button icon={<Add16Regular />} disabled={!name.trim()} onClick={go}>Add</Button>
    </div>
  );
}

export function DecisionRow({ d, repo, apply }: { d: ConfigDecision; model: Model; repo: Repository; apply: PageProps["apply"] }) {
  const l = useLook();
  const save = (patch: Partial<ConfigDecision>) => apply(m => repo.saveDecision(m, d, patch));
  return (
    <div style={{ borderTop: "1px solid " + C.line, paddingTop: 10, display: "grid", gridTemplateColumns: "1fr minmax(200px, 300px) auto", gap: 10, alignItems: "start" }}>
      <div>
        <div className={l.row}><span className={l.code}>{d.code}</span><span style={{ fontWeight: 600 }}>{d.question}</span></div>
        {(d.guidance || d.menuPath || d.product) && <div className={l.muted} style={{ fontSize: 12, marginTop: 2 }}>{[d.product, d.menuPath, d.guidance].filter(Boolean).join(" · ")}</div>}
        {d.sourceLink && <a href={d.sourceLink} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{d.sourceLabel || "Microsoft Learn"}</a>}
      </div>
      <Answer d={d} onSave={answer => save({ answer, state: answer.trim() ? DECISION_STATE.decided : DECISION_STATE.open })} />
      <Tooltip content="Delete" relationship="label"><Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete " + d.code + "?")) apply(m => repo.deleteDecision(m, d)); }} /></Tooltip>
    </div>
  );
}

function Answer({ d, onSave }: { d: ConfigDecision; onSave: (v: string) => void }) {
  if (d.answerType === ANSWER.yesno || (d.answerType === ANSWER.choice && d.choices.length)) {
    const opts = d.answerType === ANSWER.yesno ? ["Yes", "No"] : d.choices;
    return <Dropdown value={d.answer} placeholder="Answer" selectedOptions={d.answer ? [d.answer] : []} onOptionSelect={(_, x) => onSave(x.optionValue || "")}><Option value="">Not answered</Option>{opts.map(o => <Option key={o} value={o}>{o}</Option>)}</Dropdown>;
  }
  if (d.answerType === ANSWER.multi && d.choices.length) {
    const cur = d.answer.split("\n").filter(Boolean);
    return <div>{d.choices.map(o => <Checkbox key={o} label={o} checked={cur.includes(o)} onChange={(_, x) => onSave((x.checked ? cur.concat(o) : cur.filter(c => c !== o)).join("\n"))} />)}</div>;
  }
  if (d.answerType === ANSWER.list || d.answerType === ANSWER.text) return <Edit multiline value={d.answer} onSave={onSave} placeholder="Answer" />;
  return <Edit value={d.answer} onSave={onSave} placeholder="Answer" />;
}

function NewDecision({ onAdd }: { onAdd: (q: string, type: number) => void }) {
  const [q, setQ] = React.useState("");
  const [t, setT] = React.useState<number>(ANSWER.text);
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <Textarea style={{ flexGrow: 1 }} rows={1} value={q} placeholder="New configuration decision: the question to answer" onChange={(_, d) => setQ(d.value)} />
      <Choice value={t} labels={ANSWER_LABEL} onChange={v => setT(v ?? ANSWER.text)} width={140} />
      <Button icon={<Add16Regular />} disabled={!q.trim()} onClick={() => { onAdd(q, t); setQ(""); }}>Add</Button>
    </div>
  );
}
