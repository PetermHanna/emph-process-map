// Parts of the workshop runner: the facilitator's agenda (Prepare), walking our process flow (Process flow), and a licence need from the transcript.
import * as React from "react";
import { Button, Field, Input, Spinner, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions } from "@fluentui/react-components";
import { Print20Regular, ArrowDownload20Regular, Delete16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { Pill, Pick, Choice, Apply } from "../kit";
import { REVIEW, DISPOSITION_LABEL, DECISION_STATE, SHAPE, DELTA, LICENCE_LABEL } from "../../domain/codes";
import { buildAgenda, agendaHtml, AgendaBlock, processKeyOf, activityCodeOf } from "../../domain/session";
import { isActive } from "../../domain/rules";
import { loadActivities, flowsOf, Repository } from "../../domain/repository";
import type { Model, Workshop, BusinessProcess, Activity, Role } from "../../domain/types";

/** Our process if there is one, else Microsoft's reference, without dropped activities, in flow order. */
async function flowOf(model: Model, repo: Repository, processId: string): Promise<Activity[]> {
  const { reference, ours } = flowsOf(model, processId);
  const f = ours || reference;
  if (!f) return [];
  return (await loadActivities(repo.g, f.id)).filter(a => a.delta !== DELTA.removed).sort((a, b) => a.rank - b.rank);
}

export function FacilitatorAgenda({ w, model, repo, agenda }: { w: Workshop; model: Model; repo: Repository; agenda: BusinessProcess[] }) {
  const l = useLook();
  const [acts, setActs] = React.useState<Record<string, Activity[]> | null>(null);
  const ids = agenda.map(p => p.id).join(",");
  React.useEffect(() => {
    let live = true; setActs(null);
    Promise.all(agenda.map(async p => [p.id, await flowOf(model, repo, p.id).catch(() => [])] as const)).then(r => { if (live) setActs(Object.fromEntries(r)); });
    return () => { live = false; };
  }, [ids, model.flows.length]);
  if (!acts) return <Spinner size="tiny" label="Preparing the agenda" />;
  const app = (id: string | null) => model.apps.find(a => a.id === id)?.name || "";
  const blocks: AgendaBlock[] = agenda.map(p => ({
    key: p.id, code: p.code, name: p.name, notUsed: p.review === REVIEW.notUsed, appToday: app(p.currentAppId), appTarget: app(p.targetAppId),
    disposition: p.disposition != null ? DISPOSITION_LABEL[p.disposition] || "" : "",
    roles: model.processRoles.filter(x => x.processId === p.id).map(x => model.roles.find(r => r.id === x.roleId)?.name || "").filter(Boolean),
    scope: model.requirements.filter(r => r.processId === p.id && isActive(r)).map(r => r.reqId ? r.reqId + " " + r.name : r.name),
    openQuestions: model.decisions.filter(d => d.processId === p.id && d.state !== DECISION_STATE.decided).length,
    activities: (acts[p.id] || []).filter(a => a.shape !== SHAPE.start && a.shape !== SHAPE.end).map(a => ({ name: a.name, decision: a.shape === SHAPE.decision })),
  }));
  const plan = buildAgenda(blocks);
  const html = () => agendaHtml(w.name, [w.heldOn, w.facilitator].filter(Boolean).join(" · "), plan);
  const print = () => {
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    f.contentDocument!.open(); f.contentDocument!.write(html()); f.contentDocument!.close();
    setTimeout(() => { f.contentWindow!.focus(); f.contentWindow!.print(); setTimeout(() => f.remove(), 1000); }, 200);
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + html()], { type: "application/msword" }));
    a.download = w.name.replace(/[\\/:*?"<>|]+/g, " ").trim() + " agenda.doc";
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div data-emph="facilitator-agenda" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className={l.row} style={{ justifyContent: "space-between" }}>
        <div className={l.section} style={{ margin: 0 }}>Facilitator's agenda <span className={l.muted} style={{ fontWeight: 400 }} data-emph="agenda-total">· {plan.items.length} business processes, {plan.total} min</span></div>
        <div className={l.row}>
          <Button size="small" icon={<Print20Regular />} disabled={!plan.items.length} onClick={print}>Print / PDF</Button>
          <Button size="small" icon={<ArrowDownload20Regular />} disabled={!plan.items.length} onClick={download}>.doc</Button>
        </div>
      </div>
      {plan.items.map((x, i) => (
        <div key={x.key} style={{ borderTop: "1px solid " + C.line, paddingTop: 6 }}>
          <div><b>{i + 1}.</b> <span className={l.code}>{x.code}</span> {x.name} <span style={{ color: C.railActive, fontSize: 12 }}>{x.from}–{x.to} min</span></div>
          <ul style={{ margin: "2px 0", paddingLeft: 20, fontSize: 13 }}>{x.prompts.map((p, k) => <li key={k}>{p}</li>)}</ul>
          {x.chain && <div className={l.muted} style={{ fontSize: 12 }}>Flow: {x.chain}</div>}
        </div>
      ))}
    </div>
  );
}

/** Our process step by step: each click is a timed visit "processId#activityCode", so transcript lines land on the step. */
export function FlowWalk({ w, model, repo, apply, p, acts, closed, onVisit, onAdapted, onOpenStudio }: {
  w: Workshop; model: Model; repo: Repository; apply: Apply; p: BusinessProcess; acts: Activity[] | null; closed: boolean;
  onVisit: (key: string, name: string) => void; onAdapted: () => void; onOpenStudio: () => void;
}) {
  const l = useLook();
  const { reference, ours } = flowsOf(model, p.id);
  const [busy, setBusy] = React.useState(false);
  const at = processKeyOf(w.session.current) === p.id ? activityCodeOf(w.session.current) : "";
  if (!ours) return (
    <div className={l.row}>
      <span className={l.muted}>No flow for our process yet.</span>
      {reference && <Button appearance="primary" disabled={closed || busy} data-emph="walk-adapt" onClick={async () => { setBusy(true); try { const ref = await loadActivities(repo.g, reference.id); await apply(async m => (await repo.createOurFlow(m, p, reference, ref)).model); onAdapted(); } finally { setBusy(false); } }}>Adapt the reference</Button>}
      <Button onClick={onOpenStudio}>Open the flow studio</Button>
    </div>
  );
  if (!acts) return <Spinner size="tiny" label="Loading our process" />;
  const walk = acts.filter(a => a.delta !== DELTA.removed && a.shape !== SHAPE.start && a.shape !== SHAPE.end).sort((a, b) => a.rank - b.rank);
  return (
    <div data-emph="flow-walk" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className={l.row} style={{ justifyContent: "space-between" }}>
        <span className={l.muted} style={{ fontSize: 12 }}>Walk our process with the people who run it. The step you're on collects what's said.</span>
        <div className={l.row}>
          <Button size="small" disabled={closed || !at} data-emph="walk-whole" onClick={() => onVisit(p.id, p.name)}>Back to the whole process</Button>
          <Button size="small" onClick={onOpenStudio}>Open the flow studio</Button>
        </div>
      </div>
      {walk.map((a, i) => {
        const notes = model.comments.filter(c => c.activityId === a.id);
        const reqs = model.requirements.filter(r => r.activityId === a.id && isActive(r));
        return (
          <div key={a.id} data-emph="walk-step" data-code={a.code} className={l.node + (a.code === at ? " " + l.nodeOn : "")} onClick={() => !closed && a.code !== at && onVisit(p.id + "#" + a.code, a.name)} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className={l.code} style={{ minWidth: 20 }}>{i + 1}</span><span style={{ flexGrow: 1 }}>{a.name}</span>
              {a.shape === SHAPE.decision && <Pill text="decision" tone="warn" />}<span className={l.muted} style={{ fontSize: 11 }}>{a.lane}</span>
            </div>
            {(notes.length > 0 || reqs.length > 0) && (
              <div style={{ paddingLeft: 28, fontSize: 12, color: "#475569" }}>
                {reqs.map(r => <span key={r.id} style={{ marginRight: 6 }}><Pill text={r.reqId || "requirement"} tone="brand" /></span>)}
                {notes.map(c => <div key={c.id}>“{c.text}”{c.author ? " (" + c.author + ")" : ""}</div>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Comments and requirements on one flow activity, as shown in the flow studio's activity panel. */
export function ActivityNotes({ model, repo, apply, activityId }: { model: Model; repo: Repository; apply: Apply; activityId: string }) {
  const l = useLook();
  const notes = model.comments.filter(c => c.activityId === activityId);
  const reqs = model.requirements.filter(r => r.activityId === activityId && isActive(r));
  if (!notes.length && !reqs.length) return null;
  return (
    <div data-emph="activity-notes" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {reqs.length > 0 && <div className={l.row}>{reqs.map(r => <Pill key={r.id} text={r.reqId + " " + r.name} tone="brand" />)}</div>}
      {notes.map(c => (
        <div key={c.id} style={{ display: "flex", gap: 4, alignItems: "flex-start", fontSize: 12 }}>
          <span style={{ flexGrow: 1 }}>“{c.text}”{c.author ? <span className={l.muted}> {c.author}</span> : null}</span>
          <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label="Delete comment" onClick={() => apply(m => repo.deleteComment(m, c))} />
        </div>
      ))}
    </div>
  );
}

/** A licence need from a transcript line: role, licence type and people, saved on the role with the quoted line. */
export function LicenceDialog({ model, quote, onSave, onClose }: { model: Model; quote: string; onSave: (role: Role, type: number, people: number | null) => void; onClose: () => void }) {
  const [roleId, setRoleId] = React.useState<string | null>(null);
  const role = model.roles.find(r => r.id === roleId) || null;
  const [type, setType] = React.useState<number | null>(null);
  const [people, setPeople] = React.useState("");
  React.useEffect(() => { if (role) { setType(role.licenceType ?? null); setPeople(role.licenceUsers != null ? String(role.licenceUsers) : role.headcount != null ? String(role.headcount) : ""); } }, [roleId]);
  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DialogSurface style={{ maxWidth: 520 }}><DialogBody>
        <DialogTitle>Licence need</DialogTitle>
        <DialogContent>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-emph="licence-form">
            <div style={{ fontStyle: "italic", fontSize: 13, borderLeft: "3px solid #94A3B8", paddingLeft: 8 }}>{quote}</div>
            <Field label="Role"><Pick value={roleId} items={model.roles} onChange={setRoleId} placeholder="Pick a role" /></Field>
            <Field label="Licence type"><Choice value={type} labels={LICENCE_LABEL} onChange={setType} placeholder="Pick a type" /></Field>
            <Field label="People"><Input type="number" min={0} value={people} onChange={(_, d) => setPeople(d.value)} /></Field>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button appearance="primary" data-emph="licence-save" disabled={!role || type == null} onClick={() => onSave(role!, type!, people === "" ? null : Math.max(0, Math.round(Number(people))))}>Save on the role</Button>
        </DialogActions>
      </DialogBody></DialogSurface>
    </Dialog>
  );
}
