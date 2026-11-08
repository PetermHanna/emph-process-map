// Full-screen flow studio: the Microsoft reference next to our process, with editing, confirm and reset.
import * as React from "react";
import {
  OverlayDrawer, DrawerHeader, DrawerHeaderTitle, DrawerBody, Button, Spinner, Field, Input, Textarea, Dropdown, Option, OptionGroup,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, TabList, Tab,
} from "@fluentui/react-components";
import { Dismiss24Regular, Add16Regular, Delete16Regular, ArrowUp16Regular, ArrowDown16Regular, CheckmarkCircle20Regular, ArrowReset20Regular, Edit20Regular, Play20Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { Pill, Problem, Apply } from "../kit";
import { FlowCanvas, swimlaneLayout } from "./Canvas";
import { FlowStep, toStep, toActivity, STEP_TYPE, CHANGE } from "./shape";
import { moveBranch } from "./placement";
import { useGuide, playInGuide } from "./guide";
import { SHAPE_LABEL, FLOW_STATE, REQ_ORIGIN } from "../../domain/codes";
import { flowDeltas, unreachable, covers, nextActivityCode, FlowDelta } from "../../domain/rules";
import { loadActivities, flowsOf, Repository, ResetPlan } from "../../domain/repository";
import type { Model, BusinessProcess, Activity } from "../../domain/types";

const DELTA_TONE: Record<number, "ok" | "warn" | "bad"> = { [CHANGE.added]: "ok", [CHANGE.changed]: "warn", [CHANGE.removed]: "bad" };
const DELTA_TEXT: Record<number, string> = { [CHANGE.added]: "Added", [CHANGE.changed]: "Changed", [CHANGE.removed]: "Dropped" };

export function FlowStudio({ model, repo, apply, process: p, onClose }: { model: Model; repo: Repository; apply: Apply; process: BusinessProcess; onClose: () => void }) {
  const l = useLook();
  const { reference, ours } = flowsOf(model, p.id);
  const [view, setView] = React.useState<"ours" | "reference">("ours");
  const [refActs, setRefActs] = React.useState<Activity[]>([]);
  const [acts, setActs] = React.useState<FlowStep[] | null>(null);
  const [sel, setSel] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<FlowStep[][]>([]);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<{ deltas: FlowDelta[]; rationale: Record<string, string>; links: Record<string, string> } | null>(null);
  const [resetting, setResetting] = React.useState<ResetPlan | null>(null);
  const guide = useGuide();
  const [guideHint, setGuideHint] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    (async () => {
      const r = reference ? await loadActivities(repo.g, reference.id) : [];
      const o = ours ? await loadActivities(repo.g, ours.id) : null;
      if (!live) return;
      setRefActs(r); setActs(o ? o.map(toStep) : null);
    })().catch(e => setProblem(String(e?.message || e)));
    return () => { live = false; };
  }, [reference?.id, ours?.id]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); setProblem(null); try { await fn(); } catch (e: any) { setProblem(e?.message || String(e)); } finally { setBusy(false); } };
  const editable = view === "ours" && !!ours && ours.state === FLOW_STATE.draft && !busy;
  const shown: FlowStep[] = view === "reference" ? refActs.map(toStep) : acts || [];
  const cur = shown.find(x => x.code === sel) || null;
  const lanes = Array.from(new Set(shown.map(x => x.func).filter(Boolean)));
  const store = async (s: FlowStep) => toStep(await repo.saveActivity(toActivity(s)));
  const remember = () => { if (acts) setHistory(h => h.concat([acts]).slice(-20)); };

  const start = (fromReference: boolean) => run(async () => {
    let made: { activities: Activity[] } | null = null;
    await apply(async m => { const r = await repo.createOurFlow(m, p, fromReference ? reference || null : null, fromReference ? refActs : []); made = r; return r.model; });
    if (made) { setActs((made as { activities: Activity[] }).activities.map(toStep)); setView("ours"); }
  });
  const save = (s: FlowStep, patch: Partial<FlowStep>) => run(async () => {
    remember();
    const next = { ...s, ...patch };
    if (s.change === CHANGE.unchanged && patch.change === undefined) next.change = CHANGE.changed;
    const saved = await store(next);
    setActs(xs => (xs || []).map(x => (x.id === s.id ? saved : x)));
  });
  const addAfter = (s: FlowStep) => run(async () => {
    remember();
    const code = nextActivityCode(acts || []);
    const created = await store({ id: "", flowId: ours!.id, code, name: "New activity", type: STEP_TYPE.task, func: s.func, phase: s.phase, next: s.next, description: "", change: CHANGE.added, sort: s.sort + 1 });
    const prev = await store({ ...s, next: [{ to: code, label: "" }], change: s.change === CHANGE.unchanged ? CHANGE.changed : s.change });
    setActs(xs => (xs || []).map(x => (x.id === s.id ? prev : x)).concat(created));
    setSel(code);
  });
  const remove = (s: FlowStep) => run(async () => {
    remember();
    const out: FlowStep[] = [];
    for (const o of (acts || []).filter(x => x.id !== s.id)) {
      if (!o.next.some(k => k.to === s.code)) { out.push(o); continue; }
      out.push(await store({ ...o, next: o.next.flatMap(k => (k.to === s.code ? s.next.map(x => ({ to: x.to, label: k.label })) : [k])), change: o.change === CHANGE.unchanged ? CHANGE.changed : o.change }));
    }
    if (s.change === CHANGE.added) { await repo.dropActivity(toActivity(s)); setActs(out); }
    else setActs(out.concat(await store({ ...s, change: CHANGE.removed })).sort((a, b) => a.sort - b.sort));
    setSel(null);
  });
  const placed = (res: { steps: FlowStep[]; changed: string[]; created: string | null }) => run(async () => {
    remember();
    const saved: FlowStep[] = [];
    for (const c of res.changed) saved.push(await store(res.steps.find(x => x.code === c)!));
    const dropped = (acts || []).filter(x => x.change === CHANGE.removed && !res.steps.some(y => y.code === x.code));
    setActs(res.steps.map(x => saved.find(z => z.code === x.code) || x).concat(dropped));
    if (res.created) setSel(res.created);
  });
  const undo = () => run(async () => {
    const prev = history[history.length - 1];
    if (!prev || !acts) return;
    for (const c of acts) if (!prev.some(x => x.code === c.code) && c.id) await repo.dropActivity(toActivity(c));
    const back: FlowStep[] = [];
    for (const x of prev) {
      const c = acts.find(y => y.code === x.code);
      back.push(!c ? await store({ ...x, id: "" }) : JSON.stringify(c) !== JSON.stringify(x) ? await store({ ...x, id: c.id }) : c);
    }
    setHistory(h => h.slice(0, -1)); setActs(back);
  });

  const askConfirm = () => {
    const deltas = ours?.referenceId ? flowDeltas((acts || []).map(toActivity), refActs) : [];
    const stranded = unreachable((acts || []).map(toActivity), refActs);
    if (stranded.length) { setProblem("Nothing leads to: " + stranded.map(x => x.name).join(", ") + ". Connect or drop them first."); return; }
    if (!deltas.length) { finish({}, {}); return; }
    const captured = model.requirements.filter(r => r.origin === REQ_ORIGIN.captured);
    setConfirming({ deltas, rationale: Object.fromEntries(deltas.map(d => [d.code, d.rationale])), links: Object.fromEntries(deltas.flatMap(d => { const r = captured.find(x => x.evidenceFlowId === ours!.id && covers(x.originRef, d.code)); return r ? [[d.code, r.id]] : []; })) });
  };
  const finish = (rationale: Record<string, string>, links: Record<string, string>) => run(async () => {
    const saved: FlowStep[] = [];
    for (const s of acts || []) saved.push(s.code in rationale && (rationale[s.code] || "") !== (s.reason || "") ? await store({ ...s, reason: rationale[s.code] }) : s);
    setActs(saved); setHistory([]); setConfirming(null);
    await apply(m => repo.confirmFlow(m, m.flows.find(f => f.id === ours!.id)!, saved.map(toActivity), refActs, links));
  });
  const askReset = () => run(async () => setResetting(await repo.resetPlan(model, ours!, (acts || []).map(toActivity), refActs)));

  const playable = view === "reference" ? (refActs.length ? reference : undefined) : (ours && acts?.length ? ours : undefined);
  const counts = (acts || []).reduce<Record<number, number>>((a, x) => { a[x.change] = (a[x.change] || 0) + 1; return a; }, {});
  const capturedReqs = model.requirements.filter(r => r.origin === REQ_ORIGIN.captured && (r.processId === p.id || !r.processId));

  return (
    <OverlayDrawer open size="full" position="end" onOpenChange={(_, d) => { if (!d.open) onClose(); }}>
      <DrawerHeader>
        <DrawerHeaderTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />} aria-label="Close" onClick={onClose} />}>
          <span className={l.code}>{p.code}</span> {p.name}
        </DrawerHeaderTitle>
        <div className={l.row}>
          <TabList selectedValue={view} onTabSelect={(_, d) => { setView(d.value as "ours" | "reference"); setSel(null); }}>
            <Tab value="ours">Our process</Tab>
            <Tab value="reference" disabled={!reference}>Microsoft reference</Tab>
          </TabList>
          <span style={{ flexGrow: 1 }} />
          {view === "ours" && ours && <Pill text={ours.state === FLOW_STATE.confirmed ? "Confirmed" : "Draft"} tone={ours.state === FLOW_STATE.confirmed ? "ok" : "warn"} />}
          {view === "ours" && ours?.referenceId && <span className={l.muted} style={{ fontSize: 12 }}>{counts[CHANGE.changed] || 0} changed · {counts[CHANGE.added] || 0} added · {counts[CHANGE.removed] || 0} dropped</span>}
          {view === "ours" && ours?.state === FLOW_STATE.draft && <Button appearance="primary" icon={<CheckmarkCircle20Regular />} disabled={busy} onClick={askConfirm} data-emph="flow-confirm">Confirm</Button>}
          {view === "ours" && ours?.state === FLOW_STATE.confirmed && <Button icon={<Edit20Regular />} disabled={busy} onClick={() => run(() => apply(m => repo.setFlowState(m, ours, FLOW_STATE.draft)))}>Reopen</Button>}
          {view === "ours" && ours?.referenceId && <Button appearance="subtle" icon={<ArrowReset20Regular />} disabled={busy} onClick={askReset}>Back to reference</Button>}
          {playable && (guide
            ? <Button icon={<Play20Regular />} disabled={busy} onClick={() => playInGuide(playable.id)} data-emph="flow-play" title={"Opens a new tab and plays this flow over the live app (guide " + guide + ")"}>Play in the guide</Button>
            : <Button appearance="subtle" icon={<Play20Regular />} onClick={() => setGuideHint(true)} data-emph="flow-play-hint">Play in the guide</Button>)}
          {view === "reference" && reference?.sourceLink && <a href={reference.sourceLink} target="_blank" rel="noreferrer">Source on Microsoft Learn</a>}
        </div>
      </DrawerHeader>
      <DrawerBody>
        <Problem text={problem} onClose={() => setProblem(null)} />
        {view === "ours" && !ours && (
          <div className={l.card} style={{ maxWidth: 560, margin: "24px auto", textAlign: "center" }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>No flow for our process yet</div>
            <div className={l.muted} style={{ margin: "6px 0 14px" }}>{reference ? "Start from the Microsoft reference and change what you do differently. Every change is tracked." : "There is no Microsoft reference for this process. Draw it from a blank start."}</div>
            <div className={l.row} style={{ justifyContent: "center" }}>
              {reference && <Button appearance="primary" disabled={busy} onClick={() => start(true)} data-emph="flow-adapt">Adapt the reference</Button>}
              <Button disabled={busy} appearance={reference ? "secondary" : "primary"} onClick={() => start(false)}>Start blank</Button>
            </div>
          </div>
        )}
        {(view === "reference" || ours) && (acts || view === "reference" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
            <div>
              <FlowCanvas key={view + (ours?.id || "")} steps={shown.filter(x => x.change !== CHANGE.removed)} selected={sel} colour={C.railActive} editable={editable}
                onSelect={code => setSel(code)} onPlace={placed} newStep={() => ({ code: nextActivityCode(acts || []), sort: Math.max(0, ...(acts || []).map(x => x.sort)) + 10, flowId: ours!.id })}
                onRefuse={setProblem} onUndo={editable ? undo : undefined} canUndo={history.length > 0 && !busy} roles={model.roles.map(r => r.name)} />
              {view === "ours" && (acts || []).some(x => x.change === CHANGE.removed) && (
                <div className={l.row} style={{ marginTop: 8 }}><span className={l.muted}>Dropped:</span>{(acts || []).filter(x => x.change === CHANGE.removed).map(x => <span key={x.code} style={{ cursor: "pointer", textDecoration: "line-through" }} onClick={() => setSel(x.code)}><Pill text={x.name} tone="bad" /></span>)}</div>
              )}
            </div>
            <div className={l.card}>
              {!cur ? <div className={l.muted}>{editable ? "Select an activity to edit it, or drag one from the palette." : view === "reference" ? "The Microsoft reference flow. Switch to Our process to adapt it." : "Confirmed. Reopen to change it."}</div>
                : <ActivityPanel key={cur.code + cur.id} s={cur} all={shown} lanes={lanes} roles={model.roles.map(r => r.name)} editable={editable} original={view === "ours" ? refActs.map(toStep).find(x => x.code === cur.code) : undefined}
                    onSave={patch => save(cur, patch)} onAddAfter={() => addAfter(cur)} onRemove={() => remove(cur)} />}
            </div>
          </div>
        ) : <Spinner label="Loading the flow" />)}
        {busy && <Spinner size="tiny" style={{ position: "fixed", right: 24, bottom: 24 }} />}

        {confirming && (
          <Dialog open onOpenChange={(_, d) => { if (!d.open) setConfirming(null); }}>
            <DialogSurface style={{ maxWidth: 760 }}><DialogBody>
              <DialogTitle>Why does our process differ?</DialogTitle>
              <DialogContent>
                <div className={l.muted} style={{ marginBottom: 10 }}>Give a rationale, or link a requirement that already covers it. Each rationale becomes a draft requirement.</div>
                {confirming.deltas.map(d => (
                  <div key={d.code} style={{ display: "grid", gridTemplateColumns: "180px 1fr 220px", gap: 8, marginBottom: 8, alignItems: "start" }}>
                    <div><Pill text={{ added: "Added", removed: "Dropped", changed: "Changed" }[d.kind]} tone={d.kind === "added" ? "ok" : d.kind === "removed" ? "bad" : "warn"} /> <b>{d.name}</b></div>
                    <Textarea rows={2} disabled={!!confirming.links[d.code]} value={confirming.rationale[d.code] || ""} placeholder="Rationale" onChange={(_, x) => setConfirming(c => c && { ...c, rationale: { ...c.rationale, [d.code]: x.value } })} />
                    <Dropdown placeholder="or link a requirement" value={capturedReqs.find(r => r.id === confirming.links[d.code])?.reqId || ""} selectedOptions={confirming.links[d.code] ? [confirming.links[d.code]] : []}
                      onOptionSelect={(_, x) => setConfirming(c => c && { ...c, links: { ...c.links, [d.code]: x.optionValue || "" } })}>
                      <Option value="">No link</Option>
                      {capturedReqs.map(r => <Option key={r.id} value={r.id} text={r.reqId}>{r.reqId} {r.name}</Option>)}
                    </Dropdown>
                  </div>
                ))}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirming(null)}>Cancel</Button>
                <Button appearance="primary" disabled={busy || confirming.deltas.some(d => !(confirming.rationale[d.code] || "").trim() && !confirming.links[d.code])} onClick={() => finish(confirming.rationale, confirming.links)}>Confirm our process</Button>
              </DialogActions>
            </DialogBody></DialogSurface>
          </Dialog>
        )}
        {guideHint && (
          <Dialog open onOpenChange={(_, d) => { if (!d.open) setGuideHint(false); }}>
            <DialogSurface style={{ maxWidth: 520 }}><DialogBody>
              <DialogTitle>Play flows with the guide</DialogTitle>
              <DialogContent>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-emph="guide-hint">
                  <div>The guide is a browser extension that walks through a flow step by step over the live Dynamics 365 pages. It isn't installed in this browser.</div>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Get the <b>guide</b> folder of EMPH Process Map.</li>
                    <li>Open <b>edge://extensions</b> (Edge) or <b>chrome://extensions</b> (Chrome) and switch on <b>Developer mode</b>.</li>
                    <li>Choose <b>Load unpacked</b> and select the guide folder.</li>
                    <li>Reload this page. <b>Play in the guide</b> then opens the flow in a new tab.</li>
                  </ol>
                </div>
              </DialogContent>
              <DialogActions><Button appearance="primary" onClick={() => setGuideHint(false)}>OK</Button></DialogActions>
            </DialogBody></DialogSurface>
          </Dialog>
        )}
        {resetting && (
          <Dialog open onOpenChange={(_, d) => { if (!d.open) setResetting(null); }}>
            <DialogSurface><DialogBody>
              <DialogTitle>Go back to the Microsoft reference?</DialogTitle>
              <DialogContent>
                Our process flow is deleted, with {resetting.generated.length} requirement(s) it generated{resetting.touched ? ` (${resetting.touched} edited by hand)` : ""}, {resetting.testRuns.length} test run(s) and {resetting.notes.length} review note(s) on them.
                {resetting.linked.length > 0 && ` ${resetting.linked.length} hand-captured requirement(s) stay, marked for review.`} Sign-offs keep their own copies. This can't be undone.
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setResetting(null)}>Cancel</Button>
                <Button appearance="primary" onClick={() => run(async () => { const plan = resetting; setResetting(null); await apply(m => repo.resetFlow(m, ours!, plan)); setActs(null); setView("reference"); })}>Delete our process</Button>
              </DialogActions>
            </DialogBody></DialogSurface>
          </Dialog>
        )}
      </DrawerBody>
    </OverlayDrawer>
  );
}

function ActivityPanel({ s, all, lanes, roles, editable, original, onSave, onAddAfter, onRemove }: {
  s: FlowStep; all: FlowStep[]; lanes: string[]; roles: string[]; editable: boolean; original?: FlowStep;
  onSave: (p: Partial<FlowStep>) => void; onAddAfter: () => void; onRemove: () => void;
}) {
  const l = useLook();
  const live = all.filter(x => x.change !== CHANGE.removed);
  const targets = live.filter(x => x.code !== s.code);
  const lay = React.useMemo(() => swimlaneLayout(live), [all]);
  const back = (to: string) => lay.back.has(s.code + ">" + to) || (lay.col.get(to) ?? 99) <= (lay.col.get(s.code) ?? 0);
  const decision = s.type === STEP_TYPE.decision;
  const setLink = (i: number, patch: Partial<{ to: string; label: string }>) => onSave({ next: s.next.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const others = roles.filter(r => !lanes.includes(r));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className={l.row}><span className={l.code}>{s.code}</span><b>{SHAPE_LABEL[s.type]}</b>{s.change !== CHANGE.unchanged && <Pill text={DELTA_TEXT[s.change]} tone={DELTA_TONE[s.change]} />}</div>
      <Field label="Activity"><Input disabled={!editable} defaultValue={s.name} onBlur={e => { const v = e.target.value.trim(); if (v && v !== s.name) onSave({ name: v }); }} /></Field>
      <Field label="Lane (role)">
        <Dropdown disabled={!editable} value={s.func} selectedOptions={[s.func]} onOptionSelect={(_, d) => { if (d.optionValue && d.optionValue !== s.func) onSave({ func: d.optionValue }); }}>
          <OptionGroup label="In this flow">{lanes.map(x => <Option key={x} value={x}>{x}</Option>)}</OptionGroup>
          {others.length > 0 && <OptionGroup label="Other roles (adds a lane)">{others.map(x => <Option key={x} value={x}>{x}</Option>)}</OptionGroup>}
        </Dropdown>
      </Field>
      <Field label="Shape">
        <Dropdown disabled={!editable} value={SHAPE_LABEL[s.type]} selectedOptions={[String(s.type)]} onOptionSelect={(_, d) => onSave({ type: Number(d.optionValue) })}>
          {Object.keys(SHAPE_LABEL).map(k => <Option key={k} value={k}>{SHAPE_LABEL[Number(k)]}</Option>)}
        </Dropdown>
      </Field>
      <Field label="Summary"><Textarea disabled={!editable} resize="vertical" defaultValue={s.description} onBlur={e => { if (e.target.value !== s.description) onSave({ description: e.target.value }); }} /></Field>
      <Field label={decision ? "Outcomes (first is the top row)" : "Next"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {s.next.map((k, i) => (
            <div key={i} style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {(decision || s.next.length > 1) && <Input disabled={!editable} size="small" style={{ width: 70 }} placeholder={i === 0 ? "Yes" : "No"} defaultValue={k.label} onBlur={e => { if (e.target.value !== k.label) setLink(i, { label: e.target.value }); }} />}
              <Dropdown disabled={!editable} size="small" style={{ minWidth: 0, flexGrow: 1 }} value={(back(k.to) ? "↩ " : "") + (all.find(x => x.code === k.to)?.name || k.to)} selectedOptions={[k.to]} onOptionSelect={(_, d) => setLink(i, { to: d.optionValue as string })}>
                {targets.map(t => <Option key={t.code} value={t.code} text={t.name}>{(back(t.code) ? "↩ back to " : "") + t.name}</Option>)}
              </Dropdown>
              {decision && <Button size="small" appearance="subtle" disabled={!editable || i === 0} icon={<ArrowUp16Regular />} aria-label="Up" onClick={() => onSave({ next: moveBranch(s.next, i, -1) })} />}
              {decision && <Button size="small" appearance="subtle" disabled={!editable || i === s.next.length - 1} icon={<ArrowDown16Regular />} aria-label="Down" onClick={() => onSave({ next: moveBranch(s.next, i, 1) })} />}
              <Button size="small" appearance="subtle" disabled={!editable || (decision && s.next.length <= 1)} icon={<Delete16Regular />} aria-label="Remove" onClick={() => onSave({ next: s.next.filter((_, x) => x !== i) })} />
            </div>
          ))}
          {editable && targets.length > 0 && (decision || !s.next.length) && <Button size="small" appearance="transparent" icon={<Add16Regular />} style={{ alignSelf: "flex-start" }} onClick={() => onSave({ next: s.next.concat({ to: s.next[0]?.to || targets[0].code, label: decision && s.next.length === 1 ? "No" : "" }) })}>{decision ? "Add an outcome" : "Add a link"}</Button>}
        </div>
      </Field>
      {original && s.change === CHANGE.changed && <div className={l.muted} style={{ fontSize: 12 }}>{"Reference: “" + original.name + "”, " + original.func}</div>}
      {editable && s.type !== STEP_TYPE.end && (
        <div className={l.row}>
          <Button size="small" icon={<Add16Regular />} onClick={onAddAfter}>Add after</Button>
          {s.type !== STEP_TYPE.start && s.change !== CHANGE.removed && <Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={onRemove}>Drop</Button>}
          {s.change === CHANGE.removed && <Button size="small" onClick={() => onSave({ change: CHANGE.changed })}>Restore</Button>}
        </div>
      )}
    </div>
  );
}
