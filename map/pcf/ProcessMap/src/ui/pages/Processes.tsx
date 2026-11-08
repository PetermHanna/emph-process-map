// The catalog hierarchy on the left, the selected item on the right.
import * as React from "react";
import { Button, Switch, Field, Checkbox, Dropdown, Option, Input, Textarea, Tooltip } from "@fluentui/react-components";
import { ChevronDown16Regular, ChevronRight16Regular, Flowchart20Regular, Delete16Regular, Add16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Pill, Choice, Pick, Edit, AddBox, Empty } from "../kit";
import type { Nav } from "../Shell";
import { ORIGIN, ORIGIN_LABEL, REVIEW, REVIEW_LABEL, DISPOSITION_LABEL, ANSWER, ANSWER_LABEL, DECISION_STATE, COVERAGE, COVERAGE_LABEL, FLOW_STATE } from "../../domain/codes";
import { processCoverage } from "../../domain/rules";
import { areasOf, processesOf, rolesOf, flowsOf, effectiveScope } from "../../domain/repository";
import type { BusinessProcess, ConfigDecision, EndToEnd, ProcessArea, Model } from "../../domain/types";
import type { Repository } from "../../domain/repository";
import { FlowStudio } from "../flow/FlowStudio";
import { RequirementList, Capture } from "./Requirements";

type Sel = { kind: "e2e" | "area" | "process"; id: string } | null;

export function Processes({ model, repo, apply, nav }: PageProps & { nav: Nav }) {
  const l = useLook();
  const [sel, setSel] = React.useState<Sel>(() => (nav.focus ? { kind: model.processes.some(p => p.id === nav.focus) ? "process" : "e2e", id: nav.focus } : null));
  const [open, setOpen] = React.useState<Set<string>>(() => {
    const s = new Set<string>();
    if (nav.focus) { s.add(nav.focus); const p = model.processes.find(x => x.id === nav.focus); const a = p && model.areas.find(x => x.id === p.areaId); if (a) { s.add(a.id); s.add(a.endToEndId); } }
    return s;
  });
  const toggle = (id: string) => setOpen(o => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  /** Select an item; from a panel link (expand) its branch opens too, from the tree the click toggles it instead. */
  const pick = (kind: "e2e" | "area" | "process", id: string, expand = true) => { setSel({ kind, id }); if (expand && kind !== "process") setOpen(o => new Set(o).add(id)); };
  const [filter, setFilter] = React.useState("");
  const f = filter.trim().toLowerCase();
  const match = (p: BusinessProcess) => !f || p.name.toLowerCase().includes(f) || p.code.toLowerCase().includes(f);

  const addE2E = (name: string) => apply(m => repo.saveEndToEnd(m, { id: "", code: "", name, summary: "", rank: Math.max(0, ...m.endToEnds.map(x => x.rank)) + 10, inScope: true, accent: "#0D9488" }, {}));
  const chevron = (id: string) => (open.has(id) || f ? <ChevronDown16Regular /> : <ChevronRight16Regular />);

  return (
    <div className={l.split}>
      <div className={l.card} style={{ padding: 10 }}>
        <Input placeholder="Find a business process" value={filter} onChange={(_, d) => setFilter(d.value)} style={{ width: "100%", marginBottom: 8 }} />
        <div className={l.tree} data-emph="process-tree">
          {model.endToEnds.map(e => (
            <React.Fragment key={e.id}>
              <div className={l.node + (sel?.id === e.id ? " " + l.nodeOn : "")} onClick={() => { pick("e2e", e.id, false); toggle(e.id); }} style={{ fontWeight: 600, opacity: e.inScope ? 1 : 0.5 }}>
                {chevron(e.id)}<span style={{ width: 8, height: 8, borderRadius: 4, background: e.accent || C.railActive }} /><span className={l.code} style={{ minWidth: 24 }}>{e.code}</span>{e.name}
              </div>
              {(open.has(e.id) || f) && areasOf(model, e.id).map(a => {
                const procs = processesOf(model, a.id).filter(match);
                if (f && !procs.length) return null;
                return (
                  <React.Fragment key={a.id}>
                    <div className={l.node + (sel?.id === a.id ? " " + l.nodeOn : "")} style={{ paddingLeft: 22, opacity: a.inScope ? 1 : 0.5 }} onClick={() => { pick("area", a.id, false); toggle(a.id); }}>
                      {chevron(a.id)}<span className={l.code} style={{ minWidth: 40 }}>{a.code}</span>{a.name}
                    </div>
                    {(open.has(a.id) || f) && procs.map(p => (
                      <div key={p.id} data-emph="process-node" className={l.node + (sel?.id === p.id ? " " + l.nodeOn : "")} style={{ paddingLeft: 42, opacity: effectiveScope(model, p) ? 1 : 0.5 }} onClick={() => pick("process", p.id)}>
                        <span className={l.code}>{p.code}</span><span style={{ flexGrow: 1 }}>{p.name}</span>
                        {p.review === REVIEW.confirmed && <span title="Confirmed" style={{ color: C.ok }}>●</span>}
                      </div>
                    ))}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div style={{ marginTop: 10 }}><AddBox placeholder="New end-to-end process" onAdd={addE2E} /></div>
      </div>
      <div>
        {!sel && <Empty title="Pick an item" text="Choose an end-to-end process, a process area or a business process on the left." />}
        {sel?.kind === "e2e" && model.endToEnds.find(x => x.id === sel.id) && <EndToEndPanel e={model.endToEnds.find(x => x.id === sel.id)!} model={model} repo={repo} apply={apply} onPick={pick} />}
        {sel?.kind === "area" && model.areas.find(x => x.id === sel.id) && <AreaPanel a={model.areas.find(x => x.id === sel.id)!} model={model} repo={repo} apply={apply} onPick={pick} />}
        {sel?.kind === "process" && model.processes.find(x => x.id === sel.id) && <ProcessPanel key={sel.id} p={model.processes.find(x => x.id === sel.id)!} model={model} repo={repo} apply={apply} onDeleted={() => setSel(null)} />}
      </div>
    </div>
  );
}

function EndToEndPanel({ e, model, repo, apply, onPick }: PageProps & { e: EndToEnd; onPick: (k: "area", id: string) => void }) {
  const l = useLook();
  const save = (patch: Partial<EndToEnd>) => apply(m => repo.saveEndToEnd(m, e, patch));
  const areas = areasOf(model, e.id);
  return (
    <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className={l.row}><Pill text="End-to-end process" tone="brand" /><span className={l.code}>{e.code}</span></div>
      <div className={l.fields}>
        <Field label="Name"><Edit value={e.name} onSave={v => v.trim() && save({ name: v.trim() })} /></Field>
        <Field label="Catalog ID"><Edit value={e.code} onSave={v => save({ code: v.trim() })} /></Field>
        <Field label="Accent colour"><Edit value={e.accent} onSave={v => save({ accent: v.trim() })} placeholder="#0D9488" /></Field>
        <Field label="In scope"><Switch checked={e.inScope} onChange={(_, d) => save({ inScope: d.checked })} /></Field>
      </div>
      <Field label="Summary"><Edit multiline value={e.summary} onSave={v => save({ summary: v })} /></Field>
      <div className={l.section}>Process areas ({areas.length})</div>
      {areas.map(a => <div key={a.id} className={l.node} onClick={() => onPick("area", a.id)}><span className={l.code}>{a.code}</span>{a.name} <span className={l.muted}>· {processesOf(model, a.id).length} business processes</span></div>)}
      <AddBox placeholder="New process area" onAdd={name => apply(m => repo.saveArea(m, { id: "", endToEndId: e.id, code: "", name, summary: "", rank: Math.max(0, ...areas.map(x => x.rank)) + 10, inScope: true }, {}))} />
    </div>
  );
}

function AreaPanel({ a, model, repo, apply, onPick }: PageProps & { a: ProcessArea; onPick: (k: "process", id: string) => void }) {
  const l = useLook();
  const save = (patch: Partial<ProcessArea>) => apply(m => repo.saveArea(m, a, patch));
  const procs = processesOf(model, a.id);
  return (
    <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className={l.row}><Pill text="Process area" tone="info" /><span className={l.code}>{a.code}</span></div>
      <div className={l.fields}>
        <Field label="Name"><Edit value={a.name} onSave={v => v.trim() && save({ name: v.trim() })} /></Field>
        <Field label="Catalog ID"><Edit value={a.code} onSave={v => save({ code: v.trim() })} /></Field>
        <Field label="In scope"><Switch checked={a.inScope} onChange={(_, d) => save({ inScope: d.checked })} /></Field>
      </div>
      <Field label="Summary"><Edit multiline value={a.summary} onSave={v => save({ summary: v })} /></Field>
      <div className={l.section}>Business processes ({procs.length})</div>
      <table className={l.table}>
        <thead><tr><th>ID</th><th>Business process</th><th>In scope</th><th>Review</th><th>Disposition</th></tr></thead>
        <tbody>{procs.map(p => (
          <tr key={p.id} className={l.tr} onClick={() => onPick("process", p.id)}>
            <td className={l.code}>{p.code}</td><td>{p.name} {p.origin === ORIGIN.own && <Pill text="Our own" tone="info" />}</td>
            <td onClick={ev => ev.stopPropagation()}><Switch checked={p.inScope} onChange={(_, d) => apply(m => repo.saveProcess(m, p, { inScope: d.checked }))} /></td>
            <td><Pill text={REVIEW_LABEL[p.review] || ""} tone={p.review === REVIEW.confirmed ? "ok" : "neutral"} /></td>
            <td>{p.disposition != null ? DISPOSITION_LABEL[p.disposition] : ""}</td>
          </tr>
        ))}</tbody>
      </table>
      <AddBox placeholder="Our own business process in this area" onAdd={name => apply(async m => { const r = await repo.addOwnProcess(m, a.id, name); onPick("process", r.process.id); return r.model; })} />
    </div>
  );
}

function ProcessPanel({ p, model, repo, apply, onDeleted }: PageProps & { p: BusinessProcess; onDeleted: () => void }) {
  const l = useLook();
  const [studio, setStudio] = React.useState(false);
  const save = (patch: Partial<BusinessProcess>) => apply(m => repo.saveProcess(m, p, patch));
  const roles = rolesOf(model, p.id);
  const { reference, ours } = flowsOf(model, p.id);
  const decisions = model.decisions.filter(d => d.processId === p.id);
  const reqs = model.requirements.filter(r => r.processId === p.id);
  const cov = processCoverage(model.requirements, p.id);
  const targets = model.apps.filter(a => a.target);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-emph="process-panel">
      <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className={l.row}>
          <span className={l.code}>{p.code}</span>
          <Pill text={ORIGIN_LABEL[p.origin] || ""} tone={p.origin === ORIGIN.own ? "info" : "brand"} />
          {!effectiveScope(model, p) && <Pill text="Out of scope" />}
          {cov.coverage != null && <Pill text={"Coverage: " + COVERAGE_LABEL[cov.coverage]} tone={cov.coverage === COVERAGE.gap ? "bad" : cov.coverage === COVERAGE.standard ? "ok" : "warn"} />}
          <span style={{ flexGrow: 1 }} />
          {p.origin === ORIGIN.own && <Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete “" + p.name + "” and its flows? Requirements stay, marked for review.")) apply(async m => { const n = await repo.deleteOwnProcess(m, p); onDeleted(); return n; }); }}>Delete</Button>}
        </div>
        <Edit value={p.name} onSave={v => v.trim() && save({ name: v.trim() })} />
        <div className={l.fields}>
          <Field label="In scope"><Switch checked={p.inScope} onChange={(_, d) => save({ inScope: d.checked })} /></Field>
          <Field label="Review"><Choice value={p.review} labels={REVIEW_LABEL} onChange={v => save({ review: v ?? REVIEW.open })} /></Field>
          <Field label="Disposition" hint="What happens to how this is done today"><Choice value={p.disposition} labels={DISPOSITION_LABEL} onChange={v => save({ disposition: v })} /></Field>
          <Field label="Process owner"><Pick value={p.ownerRoleId} items={model.roles} onChange={v => save({ ownerRoleId: v })} /></Field>
          <Field label="Application today"><Pick value={p.currentAppId} items={model.apps} onChange={v => save({ currentAppId: v })} /></Field>
          <Field label="Target application"><Pick value={p.targetAppId} items={targets.length ? targets : model.apps} onChange={v => save({ targetAppId: v })} /></Field>
          <Field label="Users"><Edit value={p.users} onSave={v => save({ users: v })} placeholder="e.g. 20" /></Field>
        </div>
        <Field label="Roles involved">
          <div className={l.row}>
            {model.roles.map(r => <Checkbox key={r.id} label={r.name} checked={roles.some(x => x.id === r.id)} onChange={(_, d) => apply(m => repo.setProcessRoles(m, p.id, d.checked ? roles.map(x => x.id).concat(r.id) : roles.filter(x => x.id !== r.id).map(x => x.id)))} />)}
            {!model.roles.length && <span className={l.muted}>Add roles under Settings.</span>}
          </div>
        </Field>
        <Field label="Summary"><Edit multiline value={p.summary} onSave={v => save({ summary: v })} /></Field>
        <Field label="Comments"><Edit multiline value={p.comments} onSave={v => save({ comments: v })} /></Field>
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
        <Capture model={model} repo={repo} apply={apply} processId={p.id} />
        {reqs.length > 0 && <RequirementList model={model} repo={repo} apply={apply} rows={reqs} hideProcess />}
      </div>
    </div>
  );
}

export function DecisionRow({ d, model, repo, apply }: { d: ConfigDecision; model: Model; repo: Repository; apply: PageProps["apply"] }) {
  const l = useLook();
  const save = (patch: Partial<ConfigDecision>) => apply(m => repo.saveDecision(m, d, patch));
  const app = model.apps.find(a => a.id === d.appId);
  return (
    <div style={{ borderTop: "1px solid " + C.line, paddingTop: 10, display: "grid", gridTemplateColumns: "1fr minmax(200px, 300px) auto", gap: 10, alignItems: "start" }}>
      <div>
        <div className={l.row}><span className={l.code}>{d.code}</span><span style={{ fontWeight: 600 }}>{d.question}</span></div>
        {(d.guidance || d.menuPath || app) && <div className={l.muted} style={{ fontSize: 12, marginTop: 2 }}>{[app?.name, d.menuPath, d.guidance].filter(Boolean).join(" · ")}</div>}
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
