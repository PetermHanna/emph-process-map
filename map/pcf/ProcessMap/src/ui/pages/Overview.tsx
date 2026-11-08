// The main page: our processes the way Microsoft's catalog documentation draws them. Each end-to-end process shows its
// process areas left to right with arrows; inside each area its business processes run top to bottom with arrows.
// Names can be changed to our own; Microsoft's name stays visible underneath.
import * as React from "react";
import { Button, Tooltip, Switch } from "@fluentui/react-components";
import {
  ArrowRight20Filled, ArrowDown16Regular, Flowchart16Regular, CheckmarkCircle16Filled, ChevronDown16Regular, ChevronRight16Regular,
  CheckboxChecked16Filled, CheckboxUnchecked16Regular,
} from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Stat, Meter, Empty, Pill, Rename } from "../kit";
import type { Nav } from "../Shell";
import { REVIEW, COVERAGE, FLOW_TYPE, FLOW_STATE, DISPOSITION, DISPOSITION_LABEL, ORIGIN } from "../../domain/codes";
import { isActive, processCoverage } from "../../domain/rules";
import { areasOf, effectiveScope, flowsOf } from "../../domain/repository";
import type { BusinessProcess, EndToEnd, ProcessArea } from "../../domain/types";
import { areaIcon, endToEndIcon, Tile } from "../icons";

const DISPOSITION_TONE: Record<number, "ok" | "info" | "neutral" | "bad"> = { [DISPOSITION.retain]: "ok", [DISPOSITION.transition]: "info", [DISPOSITION.retire]: "neutral", [DISPOSITION.gap]: "bad" };
const GREY = "#64748B";

export function Overview({ model, repo, apply, nav }: PageProps & { nav: Nav }) {
  const l = useLook();
  const [onlyInScope, setOnlyInScope] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [opened, setOpened] = React.useState<Set<string>>(new Set());
  const inScope = model.processes.filter(p => effectiveScope(model, p));
  const confirmed = inScope.filter(p => p.review === REVIEW.confirmed).length;
  const active = model.requirements.filter(isActive);
  const gaps = active.filter(r => r.coverage === COVERAGE.gap).length;
  const ours = model.flows.filter(f => f.type === FLOW_TYPE.ours);
  const answered = model.decisions.filter(d => d.answer.trim()).length;
  const used = (e: EndToEnd) => e.inScope && areasOf(model, e.id).some(a => model.processes.some(p => p.areaId === a.id && effectiveScope(model, p)));
  const shown = model.endToEnds.filter(e => used(e) || opened.has(e.id));
  const others = model.endToEnds.filter(e => !shown.includes(e));
  const toggle = (set: Set<string>, id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n; };

  if (!model.endToEnds.length) return <Empty title="No processes yet" text="Load the Microsoft Business Process Catalog (see the install guide) or add your first end-to-end process." action={<Button appearance="primary" onClick={() => nav.go("processes")}>Go to Processes</Button>} />;

  return (
    <>
      <div className={l.grid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
        <Stat value={inScope.length} label="Business processes in scope" />
        <Stat value={inScope.length ? Math.round((100 * confirmed) / inScope.length) + "%" : "–"} label="Reviewed and confirmed" tone={C.railActive} />
        <Stat value={active.length} label="Active requirements" />
        <Stat value={gaps} label="Gaps" tone={gaps ? C.bad : undefined} />
        <Stat value={ours.filter(f => f.state === FLOW_STATE.confirmed).length + " / " + ours.length} label="Our flows confirmed" />
        <Stat value={answered + " / " + model.decisions.length} label="Decisions answered" />
      </div>
      <div className={l.row}>
        <Switch label="Only what's in scope" checked={onlyInScope} onChange={(_, d) => setOnlyInScope(d.checked)} />
        <span className={l.muted} style={{ fontSize: 12 }}>Click a process to open it. Use the box to put it in or out of scope, and the pencil to give it your own name.</span>
      </div>

      {!shown.length && <Empty title="Nothing in scope yet" text="Open an end-to-end process below and tick the business processes you run." />}

      {shown.map(e => {
        const colour = used(e) && e.accent && e.accent !== GREY ? e.accent : used(e) ? C.railActive : GREY;
        const areas = areasOf(model, e.id).filter(a => !onlyInScope || model.processes.some(p => p.areaId === a.id && effectiveScope(model, p)));
        const procs = model.processes.filter(p => areas.some(a => a.id === p.areaId) && effectiveScope(model, p));
        const done = procs.filter(p => p.review === REVIEW.confirmed).length;
        const onTarget = procs.filter(p => p.targetAppId && model.apps.find(x => x.id === p.targetAppId)?.target).length;
        const open = !collapsed.has(e.id);
        return (
          <section key={e.id} className={l.card} style={{ padding: 0, overflow: "hidden" }} data-emph="e2e-section">
            <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", background: colour + "12", borderBottom: open ? "1px solid " + C.line : undefined }}>
              <button onClick={() => setCollapsed(s => toggle(s, e.id))} aria-label={open ? "Collapse" : "Expand"} style={{ border: 0, background: "transparent", cursor: "pointer", lineHeight: 0 }}>
                {open ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
              </button>
              <Tile icon={endToEndIcon(e.code)} colour={colour} size={38} filled />
              <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span><span className={l.code} style={{ minWidth: 0, marginRight: 6 }}>{e.code}</span>
                  <Rename name={e.name} catalogName={e.catalogName} size={17} onSave={name => apply(m => repo.saveEndToEnd(m, e, { name }))} /></span>
                <span className={l.muted} style={{ fontSize: 12 }}>{areas.length} process areas · {procs.length} business processes in scope</span>
              </div>
              <Pill text={done + " of " + procs.length + " confirmed"} tone={done === procs.length && procs.length ? "ok" : "neutral"} />
              <Pill text={onTarget + " of " + procs.length + " on target applications"} tone={onTarget === procs.length && procs.length ? "ok" : "warn"} />
              <div style={{ width: 110 }}><Meter part={done} whole={procs.length} colour={colour} /></div>
              {!used(e) && <Button size="small" appearance="subtle" onClick={() => setOpened(s => toggle(s, e.id))}>Hide</Button>}
            </header>
            {open && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 0, padding: "16px 18px 18px", overflowX: "auto" }} data-emph="area-flow">
                {areas.map((a, i) => (
                  <React.Fragment key={a.id}>
                    {i > 0 && <div style={{ alignSelf: "flex-start", paddingTop: 18, color: colour, flexShrink: 0, width: 28, display: "grid", placeItems: "center" }}><ArrowRight20Filled /></div>}
                    <AreaColumn a={a} e={e} colour={colour} onlyInScope={onlyInScope} model={model} repo={repo} apply={apply} nav={nav} />
                  </React.Fragment>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {others.length > 0 && (
        <div className={l.card}>
          <div className={l.section} style={{ marginTop: 0, marginBottom: 8 }}>Not in scope: open one to choose its processes</div>
          <div className={l.row}>
            {others.map(e => (
              <button key={e.id} data-emph="open-e2e" onClick={() => setOpened(s => toggle(s, e.id))} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid " + C.line, background: "#fff", borderRadius: 999, padding: "4px 12px 4px 6px", cursor: "pointer", color: C.muted, fontSize: 13 }}>
                <Tile icon={endToEndIcon(e.code)} colour={GREY} size={22} />{e.code} {e.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function AreaColumn({ a, e, colour, onlyInScope, model, repo, apply, nav }: PageProps & { a: ProcessArea; e: EndToEnd; colour: string; onlyInScope: boolean; nav: Nav }) {
  const l = useLook();
  const all = model.processes.filter(p => p.areaId === a.id);
  const list = onlyInScope ? all.filter(p => effectiveScope(model, p)) : all;
  const live = all.some(p => effectiveScope(model, p));
  const Icon = areaIcon(a.catalogName || a.name, e.code);
  const c = live ? colour : GREY;
  return (
    <div data-emph="area-column" style={{ width: 228, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 10, background: live ? c : "#F1F5F9", color: live ? "#fff" : C.muted,
        clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)", paddingRight: 18, minHeight: 52 }}>
        <span style={{ lineHeight: 0, flexShrink: 0 }}><Icon style={{ fontSize: 22 }} /></span>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Rename name={a.name} catalogName={a.catalogName} size={13} onSave={name => apply(m => repo.saveArea(m, a, { name }))} />
          <span style={{ fontSize: 10, opacity: 0.8, fontFamily: "Consolas, monospace" }}>{a.code} · {all.filter(p => effectiveScope(model, p)).length} of {all.length} in scope</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", padding: "8px 6px 0" }}>
        {list.map((p, i) => (
          <React.Fragment key={p.id}>
            {i > 0 && <div style={{ display: "grid", placeItems: "center", height: 16, color: "#94A3B8" }}><ArrowDown16Regular /></div>}
            <ProcessBox p={p} n={i + 1} colour={c} model={model} repo={repo} apply={apply} nav={nav} />
          </React.Fragment>
        ))}
        {!list.length && <span className={l.muted} style={{ fontSize: 12, padding: 6 }}>No business processes.</span>}
      </div>
    </div>
  );
}

function ProcessBox({ p, n, colour, model, repo, apply, nav }: PageProps & { p: BusinessProcess; n: number; colour: string; nav: Nav }) {
  const l = useLook();
  const on = effectiveScope(model, p);
  const app = (id: string | null) => model.apps.find(a => a.id === id)?.name || "";
  const { reference, ours } = flowsOf(model, p.id);
  const cov = processCoverage(model.requirements, p.id);
  const reqs = model.requirements.filter(r => r.processId === p.id && isActive(r)).length;
  const ok = p.review === REVIEW.confirmed;
  const target = app(p.targetAppId);
  return (
    <div data-emph="process-card" onClick={() => nav.go("processes", p.id)} className={l.cardClick}
      style={{ display: "flex", flexDirection: "column", gap: 4, padding: "7px 9px", borderRadius: 8, cursor: "pointer", fontSize: 12,
        background: !on ? "#F8FAFC" : ok ? "#F0FDF4" : "#fff", opacity: on ? 1 : 0.7,
        border: (on ? "1px solid " : "1px dashed ") + (ok ? "#86EFAC" : on ? colour + "88" : "#CBD5E1"), borderLeft: "4px solid " + (on ? (ok ? C.ok : colour) : "#CBD5E1") }}>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        <Tooltip content={on ? "In scope: click to take it out" : "Out of scope: click to put it in"} relationship="label">
          <button data-emph="scope-toggle" onClick={ev => { ev.stopPropagation(); apply(async m => {
              let next = await repo.saveProcess(m, p, { inScope: !p.inScope });
              if (p.inScope) return next;
              // Putting a process in scope brings its area and end-to-end process in too.
              const a = next.areas.find(x => x.id === p.areaId);
              if (a && !a.inScope) next = await repo.saveArea(next, a, { inScope: true });
              const e = a && next.endToEnds.find(x => x.id === a.endToEndId);
              if (e && !e.inScope) next = await repo.saveEndToEnd(next, e, { inScope: true });
              return next;
            }); }}
            style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", lineHeight: 0, color: on ? colour : "#94A3B8", flexShrink: 0, marginTop: 1 }}>
            {p.inScope ? <CheckboxChecked16Filled /> : <CheckboxUnchecked16Regular />}
          </button>
        </Tooltip>
        <span style={{ fontSize: 10, color: C.muted, minWidth: 12, marginTop: 2 }}>{n}</span>
        <div style={{ minWidth: 0, flexGrow: 1 }}>
          <Rename name={p.name} catalogName={p.catalogName} size={12} weight={on ? 600 : 400} onSave={name => apply(m => repo.saveProcess(m, p, { name }))} />
          <div className={l.code} style={{ fontSize: 10 }}>{p.code}{p.origin === ORIGIN.own ? " · our own" : ""}</div>
        </div>
        {ok && <CheckmarkCircle16Filled style={{ color: C.ok, flexShrink: 0 }} />}
      </div>
      {on && (target || p.disposition != null || reqs > 0 || ours || reference) && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", paddingLeft: 22 }}>
          {target && <span style={{ fontSize: 10, color: C.muted }}>→ {target}</span>}
          {p.disposition != null && <Pill text={DISPOSITION_LABEL[p.disposition]} tone={DISPOSITION_TONE[p.disposition]} />}
          {cov.coverage === COVERAGE.gap && <Pill text="Gap" tone="bad" />}
          {reqs > 0 && <Pill text={String(reqs) + " req."} />}
          {(ours || reference) && <Tooltip content={ours ? "Our process" + (ours.state === FLOW_STATE.confirmed ? ", confirmed" : ", draft") : "Microsoft reference flow"} relationship="label">
            <span style={{ lineHeight: 0, color: ours ? colour : "#94A3B8", marginLeft: "auto" }}><Flowchart16Regular /></span>
          </Tooltip>}
        </div>
      )}
      {!on && (reference) && <span style={{ paddingLeft: 22, color: "#94A3B8", lineHeight: 0 }} title="Microsoft reference flow available"><Flowchart16Regular /></span>}
    </div>
  );
}
