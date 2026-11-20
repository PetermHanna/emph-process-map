// The storyline design review: the main path shown in Dynamics 365, fit to standard per step. The business processes of
// the areas in scope (as the room has them now), main path first; per process our flow (else Microsoft's reference), each
// step with its fit and reason, a demo link (the step's, else the process's) or Play in the guide, and the process's
// fit gap status proposed from its steps. Written at Close when the room agrees.
import * as React from "react";
import { Button, Checkbox, Input, Spinner, Tooltip } from "@fluentui/react-components";
import { Play16Regular, Open16Regular, ChevronDown16Regular, ChevronRight16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { Choice, FitGapPick, Pill, PageProps } from "../kit";
import { DELTA, SHAPE, labelOf } from "../../domain/codes";
import { flowsOf, loadActivities } from "../../domain/repository";
import { RunState, STEP_FITS, StepFitValue, storyProcesses, stepKey, setStepFit, setProcessFit, fitFromSteps, toggleMainPath, demoLinkOf, DemoLink } from "../../domain/workshop";
import type { Activity, ProcessItem } from "../../domain/types";
import { playInGuide } from "../flow/guide";

const FIT_LABELS = Object.fromEntries(STEP_FITS.map((f, i) => [i, f.name])) as Record<number, string>;

export function StoryTool({ model, repo, apply, e2e, run, onRun, closed, onVisit, current }: PageProps & {
  e2e: ProcessItem | null; run: RunState; onRun: (fn: (r: RunState) => RunState) => void; closed: boolean; onVisit: (key: string, name: string) => void; current: string | null;
}) {
  const l = useLook();
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [acts, setActs] = React.useState<Record<string, Activity[] | null>>({});
  const [linkFor, setLinkFor] = React.useState<string | null>(null); // "code" or "code#step"
  const links = model.workspace.settings.demoLinks || [];
  const ps = e2e ? storyProcesses(run, model.items, e2e.id) : [];
  const flowOf = (p: ProcessItem) => { const f = flowsOf(model, p.id); return f.ours || f.reference || null; };
  const load = (p: ProcessItem) => {
    const f = flowOf(p);
    if (!f || acts[p.id] !== undefined) return;
    setActs(a => ({ ...a, [p.id]: null }));
    loadActivities(repo.g, f.id).then(xs => setActs(a => ({ ...a, [p.id]: xs.filter(x => x.delta !== DELTA.removed && x.shape !== SHAPE.start && x.shape !== SHAPE.end).sort((x, y) => x.rank - y.rank) })))
      .catch(() => setActs(a => ({ ...a, [p.id]: [] })));
  };
  const toggle = (p: ProcessItem) => { setOpen(o => ({ ...o, [p.id]: !o[p.id] })); load(p); if (!closed) onVisit(p.id, p.name); };
  const saveLink = (code: string, step: string | undefined, url: string, note: string) => apply(m => {
    const rest = (m.workspace.settings.demoLinks || []).filter(x => !(x.code === code && (x.step || "") === (step || "")));
    const next: DemoLink[] = url.trim() ? rest.concat({ code, ...(step ? { step } : {}), url: url.trim(), ...(note.trim() ? { note: note.trim() } : {}) }) : rest;
    return repo.saveSettings(m, { ...m.workspace.settings, demoLinks: next });
  });
  const linkBox = (code: string, step?: string) => {
    const cur = links.find(x => x.code === code && (x.step || "") === (step || ""));
    let url = cur?.url || "", note = cur?.note || "";
    return (
      <span className={l.row} data-emph="demo-link-form" style={{ fontSize: 12 }}>
        <Input size="small" placeholder="https://… (the demo environment)" defaultValue={url} onChange={(_, d) => { url = d.value; }} style={{ minWidth: 260 }} />
        <Input size="small" placeholder="Note (record, user)" defaultValue={note} onChange={(_, d) => { note = d.value; }} />
        <Button size="small" appearance="primary" data-emph="demo-link-save" onClick={() => { setLinkFor(null); saveLink(code, step, url, note); }}>Save</Button>
        <Button size="small" onClick={() => setLinkFor(null)}>Cancel</Button>
      </span>
    );
  };
  const demo = (p: ProcessItem, a?: Activity) => {
    const d = demoLinkOf(links, p.code, a?.code);
    const f = flowOf(p);
    const k = p.code + (a ? "#" + a.code : "");
    if (linkFor === k) return linkBox(p.code, a?.code);
    return (
      <span className={l.row} style={{ gap: 4 }}>
        {d && <Tooltip content={d.note || d.url} relationship="description"><Button size="small" appearance="subtle" icon={<Open16Regular />} data-emph="demo-open" onClick={() => window.open(d.url, "_blank", "noopener")}>Demo{a && !d.step ? " (process)" : ""}</Button></Tooltip>}
        {f && <Tooltip content="Play this flow over the live app with the EMPH guide" relationship="description"><Button size="small" appearance="subtle" icon={<Play16Regular />} onClick={() => playInGuide(f.id, a?.code)}>Play</Button></Tooltip>}
        {!closed && <button style={{ border: 0, background: "none", padding: 0, color: C.muted, cursor: "pointer", fontSize: 11 }} data-emph="demo-link-add" onClick={() => setLinkFor(k)}>{d && (!a || d.step) ? "change link" : "add a demo link"}</button>}
      </span>
    );
  };
  if (!e2e) return <div className={l.muted}>This workshop has no end-to-end process.</div>;
  if (!ps.length) return <div className={l.muted} data-emph="story-empty">No business process in an area in scope. Set the scope of the areas on the scenario board first.</div>;
  return (
    <div data-emph="story" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className={l.muted} style={{ fontSize: 12 }}>The business processes of the areas in scope, the main path first. Open one to walk its steps and mark the fit to standard; the process's fit gap status follows from its steps.</div>
      {ps.map(p => {
        const fit = run.processFit[p.id], steps = acts[p.id];
        const suggested = steps ? fitFromSteps(run, p.id, steps.map(a => a.code)) : null;
        const main = run.mainPath.includes(p.id);
        return (
          <div key={p.id} data-emph="story-process" data-id={p.id} style={{ border: "1px solid " + (current?.split("#")[0] === p.id ? C.railActive : C.line), borderRadius: 8, padding: 8 }}>
            <div className={l.row} style={{ justifyContent: "space-between" }}>
              <span className={l.row} style={{ cursor: "pointer" }} onClick={() => toggle(p)} data-emph="story-open">
                {open[p.id] ? <ChevronDown16Regular /> : <ChevronRight16Regular />}<span className={l.code}>{p.code}</span> <b>{p.name}</b>
                {main && <Pill text="main path" tone="brand" />}{!flowOf(p) && <Pill text="no flow" />}
              </span>
              <span className={l.row}>
                <Checkbox label="Main path" checked={main} disabled={closed} data-emph="story-main" onChange={() => onRun(r => toggleMainPath(r, p.id))} />
                {demo(p)}
              </span>
            </div>
            <div className={l.row} style={{ marginTop: 4 }} data-emph="story-fit">
              <span className={l.muted} style={{ fontSize: 12 }}>Fit gap status{fit ? " (proposed)" : p.fitGap != null ? " (today: " + labelOf("fitGapStatus", p.fitGap) + ")" : ""}:</span>
              <FitGapPick fitGap={fit?.fitGap ?? null} gapApproach={fit?.approach ?? null} disabled={closed}
                onSave={(fitGap, approach) => onRun(r => setProcessFit(r, p.id, fitGap == null ? null : { fitGap, approach, reason: r.processFit[p.id]?.reason }))} />
              {suggested != null && suggested !== fit?.fitGap && !closed && <Button size="small" data-emph="story-use-steps" onClick={() => onRun(r => setProcessFit(r, p.id, { fitGap: suggested, reason: r.processFit[p.id]?.reason }))}>Use the steps: {labelOf("fitGapStatus", suggested)}</Button>}
              {fit && <Input size="small" placeholder="Why" defaultValue={fit.reason || ""} disabled={closed} onBlur={e => { if (e.target.value.trim() !== (fit.reason || "")) onRun(r => setProcessFit(r, p.id, { ...r.processFit[p.id], reason: e.target.value })); }} />}
            </div>
            {open[p.id] && (steps === null || steps === undefined ? (flowOf(p) ? <Spinner size="tiny" label="Loading the flow" /> : <div className={l.muted} style={{ fontSize: 12 }}>No flow: set the fit for the whole process above.</div>) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
                {steps.map((a, i) => {
                  const k = stepKey(p.id, a.code), f = run.stepFit[k];
                  const fi = f ? STEP_FITS.findIndex(x => x.fit === f.fit) : null;
                  return (
                    <div key={a.id} data-emph="story-step" data-code={a.code} className={l.row} style={{ borderTop: "1px solid " + C.line, paddingTop: 3, background: current === k ? "#F0FDFA" : undefined }}>
                      <span className={l.code} style={{ minWidth: 20 }}>{i + 1}</span>
                      <span style={{ flexGrow: 1, cursor: closed ? "default" : "pointer" }} onClick={() => !closed && onVisit(k, a.name)}>{a.name} <span className={l.muted} style={{ fontSize: 11 }}>{a.lane}</span></span>
                      <span data-emph="step-fit"><Choice value={fi} labels={FIT_LABELS} width={140} disabled={closed} placeholder="Fit?"
                        onChange={v => onRun(r => setStepFit(r, k, v == null ? null : { fit: STEP_FITS[v].fit as StepFitValue, name: a.name, reason: r.stepFit[k]?.reason }))} /></span>
                      {f && <Input size="small" placeholder="Reason" defaultValue={f.reason || ""} disabled={closed} style={{ minWidth: 140 }} onBlur={e => { if (e.target.value.trim() !== (f.reason || "")) onRun(r => setStepFit(r, k, { ...r.stepFit[k], reason: e.target.value })); }} />}
                      {demo(p, a)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
