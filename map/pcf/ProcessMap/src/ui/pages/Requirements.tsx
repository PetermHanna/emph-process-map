// The requirements register: capture, filter, rate and resolve.
import * as React from "react";
import { Button, Field, Input, Textarea, Switch, OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody } from "@fluentui/react-components";
import { Dismiss24Regular, Delete16Regular, ArrowDownload16Regular } from "@fluentui/react-icons";
import { useLook } from "../look";
import { PageProps, Pill, Choice, Pick, Edit, Empty, Apply } from "../kit";
import type { Nav } from "../Shell";
import { MOSCOW_LABEL, CATEGORY_LABEL, REQ_STATE_LABEL, REQ_STATE, COVERAGE, COVERAGE_LABEL, SIZE_LABEL, REQ_ORIGIN_LABEL } from "../../domain/codes";
import { isActive } from "../../domain/rules";
import { workbook, saveFile } from "../../domain/documents";
import type { Model, Requirement } from "../../domain/types";
import type { Repository } from "../../domain/repository";

const coverageTone = (c: number | null) => (c === COVERAGE.gap ? "bad" : c === COVERAGE.standard ? "ok" : c == null ? "neutral" : "warn") as "bad" | "ok" | "neutral" | "warn";

export function Capture({ model, repo, apply, processId, workshopId, onCaptured }: { model: Model; repo: Repository; apply: Apply; processId?: string | null; workshopId?: string | null; onCaptured?: (r: Requirement) => void }) {
  const [text, setText] = React.useState("");
  const [who, setWho] = React.useState("");
  const [pid, setPid] = React.useState<string | null>(processId ?? null);
  React.useEffect(() => setPid(processId ?? null), [processId]);
  const go = () => apply(async m => {
    const r = await repo.addRequirement(m, text, { processId: pid, workshopId: workshopId || null, raisedBy: who.trim() });
    setText(""); onCaptured?.(r.requirement);
    return r.model;
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-emph="capture">
      <Textarea rows={2} value={text} placeholder="What do you need that standard doesn't do? One requirement at a time." onChange={(_, d) => setText(d.value)} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {processId === undefined && <Pick value={pid} items={model.processes.map(p => ({ id: p.id, name: p.code + " " + p.name }))} onChange={setPid} placeholder="No business process" width={260} />}
        <Input value={who} placeholder="Raised by" onChange={(_, d) => setWho(d.value)} />
        <Button appearance="primary" disabled={!text.trim()} onClick={go}>Capture</Button>
      </div>
    </div>
  );
}

export function RequirementList({ model, repo, apply, rows, hideProcess }: { model: Model; repo: Repository; apply: Apply; rows: Requirement[]; hideProcess?: boolean }) {
  const l = useLook();
  const [open, setOpen] = React.useState<string | null>(null);
  const cur = model.requirements.find(r => r.id === open) || null;
  const pname = (id: string | null) => { const p = model.processes.find(x => x.id === id); return p ? p.code + " " + p.name : ""; };
  return (
    <>
      <table className={l.table} data-emph="requirements">
        <thead><tr><th>ID</th><th>Requirement</th>{!hideProcess && <th>Business process</th>}<th>MoSCoW</th><th>State</th><th>Coverage</th></tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.id} className={l.tr} onClick={() => setOpen(r.id)} style={{ opacity: isActive(r) ? 1 : 0.55 }}>
            <td className={l.code}>{r.reqId}</td>
            <td>{r.name} {r.review && <Pill text="Review" tone="warn" />}</td>
            {!hideProcess && <td className={l.muted}>{pname(r.processId)}</td>}
            <td>{r.moscow != null ? MOSCOW_LABEL[r.moscow] : ""}</td>
            <td>{r.state != null ? REQ_STATE_LABEL[r.state] : ""}</td>
            <td>{r.coverage != null && <Pill text={COVERAGE_LABEL[r.coverage]} tone={coverageTone(r.coverage)} />}</td>
          </tr>
        ))}</tbody>
      </table>
      {cur && <RequirementEditor r={cur} model={model} repo={repo} apply={apply} onClose={() => setOpen(null)} />}
    </>
  );
}

function RequirementEditor({ r, model, repo, apply, onClose }: { r: Requirement; model: Model; repo: Repository; apply: Apply; onClose: () => void }) {
  const l = useLook();
  const save = (patch: Partial<Requirement>) => apply(m => repo.updateRequirement(m, r, patch));
  const flow = model.flows.find(f => f.id === r.evidenceFlowId);
  return (
    <OverlayDrawer open position="end" size="medium" onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DrawerHeader><DrawerHeaderTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />} aria-label="Close" onClick={onClose} />}>{r.reqId || "Requirement"}</DrawerHeaderTitle></DrawerHeader>
      <DrawerBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className={l.row}><Pill text={REQ_ORIGIN_LABEL[r.origin] || ""} tone="info" />{r.review && <Pill text="Needs review" tone="warn" />}{flow && <Pill text={"Evidence: " + flow.name} />}</div>
          <Field label="Description"><Edit multiline value={r.description} onSave={v => v.trim() && save({ description: v })} /></Field>
          <div className={l.fields}>
            <Field label="Business process"><Pick value={r.processId} items={model.processes.map(p => ({ id: p.id, name: p.code + " " + p.name }))} onChange={v => save({ processId: v })} /></Field>
            <Field label="MoSCoW"><Choice value={r.moscow} labels={MOSCOW_LABEL} onChange={v => save({ moscow: v })} /></Field>
            <Field label="Category"><Choice value={r.category} labels={CATEGORY_LABEL} onChange={v => save({ category: v })} /></Field>
            <Field label="State"><Choice value={r.state} labels={REQ_STATE_LABEL} onChange={v => save({ state: v ?? REQ_STATE.draft })} /></Field>
            <Field label="Coverage by standard"><Choice value={r.coverage} labels={COVERAGE_LABEL} onChange={v => save({ coverage: v })} /></Field>
            <Field label="Size"><Choice value={r.size} labels={SIZE_LABEL} onChange={v => save({ size: v })} /></Field>
            <Field label="Raised by"><Edit value={r.raisedBy} onSave={v => save({ raisedBy: v })} /></Field>
            <Field label="Owner"><Edit value={r.owner} onSave={v => save({ owner: v })} /></Field>
          </div>
          <Field label="In their words"><Edit multiline value={r.verbatim} onSave={v => save({ verbatim: v })} /></Field>
          <Field label="Resolution"><Edit multiline value={r.resolution} onSave={v => save({ resolution: v })} /></Field>
          <div className={l.fields}>
            <Field label="Resolved by"><Edit value={r.resolvedBy} onSave={v => save({ resolvedBy: v })} /></Field>
            <Field label="Resolved on"><Input type="date" defaultValue={r.resolvedOn || ""} onBlur={e => { if ((e.target.value || null) !== r.resolvedOn) save({ resolvedOn: e.target.value || null }); }} /></Field>
            <Field label="Needs review"><Switch checked={r.review} onChange={(_, d) => save({ review: d.checked })} /></Field>
          </div>
          <div><Button appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete " + (r.reqId || "this requirement") + "? This can't be undone.")) { onClose(); apply(m => repo.deleteRequirement(m, r)); } }}>Delete requirement</Button></div>
        </div>
      </DrawerBody>
    </OverlayDrawer>
  );
}

export function Requirements({ model, repo, apply }: PageProps & { nav: Nav }) {
  const l = useLook();
  const [state, setState] = React.useState<number | null>(null);
  const [coverage, setCoverage] = React.useState<number | null>(null);
  const [onlyReview, setOnlyReview] = React.useState(false);
  const [q, setQ] = React.useState("");
  const rows = model.requirements
    .filter(r => (state == null || r.state === state) && (coverage == null || r.coverage === coverage) && (!onlyReview || r.review) && (!q || (r.reqId + " " + r.description).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.reqId.localeCompare(a.reqId));
  const exportAll = () => {
    const pname = (id: string | null) => model.processes.find(p => p.id === id)?.name || "";
    saveFile("requirements.xlsx", workbook([{ title: "Requirements", columns: ["ID", "Description", "Business process", "MoSCoW", "Category", "State", "Coverage", "Size", "Owner", "Raised by", "Resolution"],
      rows: model.requirements.map(r => [r.reqId, r.description, pname(r.processId), MOSCOW_LABEL[r.moscow as number] || "", CATEGORY_LABEL[r.category as number] || "", REQ_STATE_LABEL[r.state as number] || "", COVERAGE_LABEL[r.coverage as number] || "", SIZE_LABEL[r.size as number] || "", r.owner, r.raisedBy, r.resolution]) }]),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };
  return (
    <>
      <div className={l.card}><Capture model={model} repo={repo} apply={apply} /></div>
      <div className={l.row}>
        <Input placeholder="Search" value={q} onChange={(_, d) => setQ(d.value)} />
        <Choice value={state} labels={REQ_STATE_LABEL} onChange={setState} placeholder="Any state" />
        <Choice value={coverage} labels={COVERAGE_LABEL} onChange={setCoverage} placeholder="Any coverage" />
        <Switch label="Needs review" checked={onlyReview} onChange={(_, d) => setOnlyReview(d.checked)} />
        <span style={{ flexGrow: 1 }} />
        <Button icon={<ArrowDownload16Regular />} onClick={exportAll}>Excel</Button>
      </div>
      {rows.length ? <div className={l.card}><RequirementList model={model} repo={repo} apply={apply} rows={rows} /></div>
        : <Empty title="No requirements" text={model.requirements.length ? "Nothing matches the filters." : "Capture the first one above, or in a workshop."} />}
    </>
  );
}
