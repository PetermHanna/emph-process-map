// The requirements register (Microsoft's Requirement work item): capture, filter, rate and approve.
// MoSCoW is shown, Microsoft's priority is stored (Must = 1, Should = 2, Could = 3, Won't = 4).
import * as React from "react";
import { Button, Field, Input, Textarea, Switch, OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody } from "@fluentui/react-components";
import { Dismiss24Regular, Delete16Regular, ArrowDownload16Regular } from "@fluentui/react-icons";
import { useLook } from "../look";
import { PageProps, Pill, Choice, ListChoice, FitGapPick, Pick, Edit, Empty, Apply } from "../kit";
import type { Nav } from "../Shell";
import { MOSCOW_LABEL, REQ_ORIGIN_LABEL, FIT_GAP, APPROVAL, labelOf, moscowOf, labels } from "../../domain/codes";
import { isActive } from "../../domain/rules";
import { workbook, saveFile } from "../../domain/documents";
import { effectiveScope, itemLabel } from "../../domain/repository";
import type { Model, Requirement } from "../../domain/types";
import type { Repository } from "../../domain/repository";
import { ItemHistory } from "./History";

const fitTone = (f: number | null) => (f === FIT_GAP.gap ? "bad" : f === FIT_GAP.fit ? "ok" : "neutral") as "bad" | "ok" | "neutral";
const CLOSED: Record<number, string> = { 1: "Deferred", 2: "Duplicate", 3: "Withdrawn" };

/** Business processes and scenarios to hang a requirement on: those in scope, and the one it is on now. */
const itemChoices = (m: Model, current: string | null) =>
  m.items.filter(x => (x.level >= 3 && effectiveScope(m, x)) || x.id === current).map(x => ({ id: x.id, name: itemLabel(x) }));

/** A line from a meeting transcript to capture: it fills the box, and is kept as the requirement's source text. */
export interface CaptureFrom { key: string; text: string; who: string; sourceText: string; itemId?: string | null; activityId?: string | null; activityName?: string }

export function Capture({ model, repo, apply, itemId, workshopId, onCaptured, from, onDropFrom }: { model: Model; repo: Repository; apply: Apply; itemId?: string | null; workshopId?: string | null; onCaptured?: (r: Requirement) => void; from?: CaptureFrom | null; onDropFrom?: () => void }) {
  const [text, setText] = React.useState("");
  const [who, setWho] = React.useState("");
  const [pid, setPid] = React.useState<string | null>(itemId ?? null);
  React.useEffect(() => setPid(itemId ?? null), [itemId]);
  const [act, setAct] = React.useState<{ id: string; name: string } | null>(null); // the flow step it was said on
  React.useEffect(() => { if (from) { setText(from.text); setWho(from.who); if (from.itemId) setPid(from.itemId); setAct(from.activityId ? { id: from.activityId, name: from.activityName || "" } : null); } else setAct(null); }, [from?.key]);
  const go = () => apply(async m => {
    const r = await repo.addRequirement(m, text, { itemId: pid, workshopId: workshopId || null, raisedBy: who.trim(), sourceText: from?.sourceText || "", sourceType: from ? "Workshop transcript" : workshopId ? "Workshop" : "", activityId: act?.id ?? null });
    setText(""); setWho(""); setAct(null); onCaptured?.(r.requirement);
    return r.model;
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-emph="capture">
      <Textarea rows={2} value={text} placeholder="What do you need that standard doesn't do? One requirement at a time." onChange={(_, d) => setText(d.value)} />
      {from && (
        <div data-emph="capture-from" style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#475569", background: "#F8FAFC", borderLeft: "3px solid #94A3B8", padding: "4px 8px" }}>
          <span style={{ flexGrow: 1, fontStyle: "italic" }}>{from.sourceText}</span>
          <Button size="small" appearance="transparent" onClick={() => { setText(""); setWho(""); setAct(null); onDropFrom?.(); }}>Don't keep</Button>
        </div>
      )}
      {act && (
        <div data-emph="capture-step" style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <span>On flow step: <b>{act.name}</b></span>
          <Button size="small" appearance="transparent" onClick={() => setAct(null)}>Whole process instead</Button>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {itemId === undefined && <Pick value={pid} items={itemChoices(model, pid)} onChange={setPid} placeholder="No process item" width={260} />}
        <Input value={who} placeholder="Raised by" onChange={(_, d) => setWho(d.value)} />
        <Button appearance="primary" disabled={!text.trim()} onClick={go}>Capture</Button>
      </div>
    </div>
  );
}

export function RequirementList({ model, repo, apply, rows, hideItem, openId }: { model: Model; repo: Repository; apply: Apply; rows: Requirement[]; hideItem?: boolean; openId?: string | null }) {
  const l = useLook();
  const [open, setOpen] = React.useState<string | null>(openId || null);
  const cur = model.requirements.find(r => r.id === open) || null;
  const iname = (id: string | null) => itemLabel(model.items.find(x => x.id === id));
  return (
    <>
      <table className={l.table} data-emph="requirements">
        <thead><tr><th>ID</th><th>Requirement</th>{!hideItem && <th>Process item</th>}<th>MoSCoW</th><th>Fit gap status</th><th>Business approval</th></tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.id} className={l.tr} onClick={() => setOpen(r.id)} style={{ opacity: isActive(r) ? 1 : 0.55 }}>
            <td className={l.code}>{r.reqId}</td>
            <td>{r.name} {r.review && <Pill text="Review" tone="warn" />}</td>
            {!hideItem && <td className={l.muted}>{iname(r.itemId)}</td>}
            <td>{moscowOf(r.priority)}</td>
            <td>{r.fitGap != null && <Pill text={labelOf("fitGapStatus", r.fitGap) + (r.fitGap === FIT_GAP.gap && r.gapApproach != null ? ": " + labelOf("gapSolutionApproach", r.gapApproach).replace(/^\d+ - /, "") : "")} tone={fitTone(r.fitGap)} />}</td>
            <td>{labelOf("businessApprovalState", r.approval)}{r.closedReason ? " (" + r.closedReason + ")" : ""}</td>
          </tr>
        ))}</tbody>
      </table>
      {cur && <RequirementEditor r={cur} model={model} repo={repo} apply={apply} onClose={() => setOpen(null)} />}
    </>
  );
}

function RequirementEditor({ r, model, repo, apply, onClose }: { r: Requirement; model: Model; repo: Repository; apply: Apply; onClose: () => void }) {
  const l = useLook();
  const save = (patch: Partial<Requirement>) => apply(m => repo.updateRequirement(m, m.requirements.find(x => x.id === r.id) || r, patch));
  const flow = model.flows.find(f => f.id === r.evidenceFlowId);
  const closed = Number(Object.keys(CLOSED).find(k => CLOSED[Number(k)] === r.closedReason)) || null;
  return (
    <OverlayDrawer open position="end" size="medium" onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DrawerHeader><DrawerHeaderTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />} aria-label="Close" onClick={onClose} />}>{r.reqId || "Requirement"}</DrawerHeaderTitle></DrawerHeader>
      <DrawerBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-emph="requirement-editor">
          <div className={l.row}><Pill text={REQ_ORIGIN_LABEL[r.origin] || ""} tone="info" />{r.review && <Pill text="Needs review" tone="warn" />}{flow && <Pill text={"Evidence: " + flow.name} />}</div>
          <Field label="Description"><Edit multiline value={r.description} onSave={v => v.trim() && save({ description: v })} /></Field>
          <div className={l.fields}>
            <Field label="Process item"><Pick value={r.itemId} items={itemChoices(model, r.itemId)} onChange={v => save({ itemId: v })} /></Field>
            <Field label="Requirement type"><ListChoice list="requirementType" value={r.type} onChange={v => save({ type: v })} /></Field>
            <Field label="MoSCoW" hint={r.priority != null ? "Priority " + labelOf("priority", r.priority) : undefined}><Choice value={r.priority} labels={MOSCOW_LABEL} onChange={v => save({ priority: v })} /></Field>
            <Field label="Fit gap status"><FitGapPick fitGap={r.fitGap} gapApproach={r.gapApproach} onSave={(fitGap, gapApproach) => save({ fitGap, gapApproach })} /></Field>
            <Field label="Estimated complexity"><ListChoice list="estimatedComplexity" value={r.complexity} onChange={v => save({ complexity: v })} /></Field>
            <Field label="Business approval state"><ListChoice list="businessApprovalState" value={r.approval} onChange={v => save({ approval: v ?? APPROVAL.new })} /></Field>
            <Field label="Author"><ListChoice list="author" value={r.author} onChange={v => save({ author: v })} /></Field>
            <Field label="Closed reason"><Choice value={closed} labels={CLOSED} placeholder="Open" onChange={v => save({ closedReason: v ? CLOSED[v] : "" })} /></Field>
            <Field label="Raised by"><Edit value={r.raisedBy} onSave={v => save({ raisedBy: v })} /></Field>
            <Field label="Owner"><Edit value={r.owner} onSave={v => save({ owner: v })} /></Field>
            <Field label="Approved by"><Edit value={r.approvedBy} onSave={v => save({ approvedBy: v })} /></Field>
            <Field label="Approved on"><Input type="date" defaultValue={r.approvedOn || ""} onBlur={e => { if ((e.target.value || null) !== r.approvedOn) save({ approvedOn: e.target.value || null }); }} /></Field>
          </div>
          <Field label="Source text" hint={r.sourceType || undefined}><Edit multiline value={r.sourceText} onSave={v => save({ sourceText: v })} /></Field>
          <Field label="Acceptance criteria"><Edit multiline value={r.acceptanceCriteria} onSave={v => save({ acceptanceCriteria: v })} /></Field>
          <Field label="Requirement mapping" hint="How the solution meets it"><Edit multiline value={r.mapping} onSave={v => save({ mapping: v })} /></Field>
          <Field label="Scope approach"><Edit multiline value={r.scopeApproach} onSave={v => save({ scopeApproach: v })} /></Field>
          <Field label="Needs review"><Switch checked={r.review} onChange={(_, d) => save({ review: d.checked })} /></Field>
          <ItemHistory model={model} repo={repo} apply={apply} table="emph_requirement" rowId={r.id} />
          <div><Button appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete " + (r.reqId || "this requirement") + "? This can't be undone.")) { onClose(); apply(m => repo.deleteRequirement(m, r)); } }}>Delete requirement</Button></div>
        </div>
      </DrawerBody>
    </OverlayDrawer>
  );
}

export function Requirements({ model, repo, apply, nav }: PageProps & { nav: Nav }) {
  const l = useLook();
  const [approval, setApproval] = React.useState<number | null>(null);
  const [fit, setFit] = React.useState<number | null>(null);
  const [onlyReview, setOnlyReview] = React.useState(false);
  const [q, setQ] = React.useState("");
  const rows = model.requirements
    .filter(r => (approval == null || r.approval === approval) && (fit == null || r.fitGap === fit) && (!onlyReview || r.review) && (!q || (r.reqId + " " + r.description).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.reqId.localeCompare(a.reqId));
  const exportAll = () => {
    const iname = (id: string | null) => itemLabel(model.items.find(p => p.id === id));
    saveFile("requirements.xlsx", workbook([{ title: "Requirements", columns: ["ID", "Description", "Process item", "Requirement type", "MoSCoW", "Priority", "Fit gap status", "Gap solution approach", "Estimated complexity", "Business approval state", "Owner", "Raised by", "Source text", "Acceptance criteria", "Requirement mapping"],
      rows: model.requirements.map(r => [r.reqId, r.description, iname(r.itemId), labelOf("requirementType", r.type), moscowOf(r.priority), labelOf("priority", r.priority), labelOf("fitGapStatus", r.fitGap), labelOf("gapSolutionApproach", r.gapApproach),
        labelOf("estimatedComplexity", r.complexity), labelOf("businessApprovalState", r.approval), r.owner, r.raisedBy, r.sourceText, r.acceptanceCriteria, r.mapping]) }]),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };
  return (
    <>
      <div className={l.card}><Capture model={model} repo={repo} apply={apply} /></div>
      <div className={l.row}>
        <Input placeholder="Search" value={q} onChange={(_, d) => setQ(d.value)} />
        <Choice value={approval} labels={labels("businessApprovalState")} onChange={setApproval} placeholder="Any approval state" />
        <Choice value={fit} labels={labels("fitGapStatus")} onChange={setFit} placeholder="Fit or gap" />
        <Switch label="Needs review" checked={onlyReview} onChange={(_, d) => setOnlyReview(d.checked)} />
        <span style={{ flexGrow: 1 }} />
        <Button icon={<ArrowDownload16Regular />} onClick={exportAll}>Excel</Button>
      </div>
      {rows.length ? <div className={l.card}><RequirementList model={model} repo={repo} apply={apply} rows={rows} openId={model.requirements.some(r => r.id === nav.focus) ? nav.focus : null} /></div>
        : <Empty title="No requirements" text={model.requirements.length ? "Nothing matches the filters." : "Capture the first one above, or in a workshop."} />}
    </>
  );
}
