// The main page: our processes as a map. Each end-to-end process in scope is a section; each process area a row of
// business-process cards in catalog order, with today's and the target application, the decision and the flow.
import * as React from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowRight16Regular, Flowchart16Regular, CheckmarkCircle16Filled, Circle16Regular, ChevronDown16Regular, ChevronRight16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Stat, Meter, Empty, Pill } from "../kit";
import type { Nav } from "../Shell";
import { REVIEW, COVERAGE, FLOW_TYPE, FLOW_STATE, DISPOSITION, DISPOSITION_LABEL, ORIGIN } from "../../domain/codes";
import { isActive, processCoverage } from "../../domain/rules";
import { areasOf, effectiveScope, flowsOf } from "../../domain/repository";
import type { BusinessProcess, Model } from "../../domain/types";
import { areaIcon, endToEndIcon, Tile } from "../icons";

const DISPOSITION_TONE: Record<number, "ok" | "info" | "neutral" | "bad"> = { [DISPOSITION.retain]: "ok", [DISPOSITION.transition]: "info", [DISPOSITION.retire]: "neutral", [DISPOSITION.gap]: "bad" };

export function Overview({ model, nav }: PageProps & { nav: Nav }) {
  const l = useLook();
  const [closed, setClosed] = React.useState<Set<string>>(new Set());
  const inScope = model.processes.filter(p => effectiveScope(model, p));
  const confirmed = inScope.filter(p => p.review === REVIEW.confirmed).length;
  const active = model.requirements.filter(isActive);
  const gaps = active.filter(r => r.coverage === COVERAGE.gap).length;
  const ours = model.flows.filter(f => f.type === FLOW_TYPE.ours);
  const answered = model.decisions.filter(d => d.answer.trim()).length;
  const scopedE2E = model.endToEnds.filter(e => e.inScope && areasOf(model, e.id).some(a => model.processes.some(p => p.areaId === a.id && effectiveScope(model, p))));
  const others = model.endToEnds.filter(e => !scopedE2E.includes(e));

  if (!model.endToEnds.length) return <Empty title="No processes yet" text="Load the Microsoft Business Process Catalog (see the install guide) or add your first end-to-end process." action={<Button appearance="primary" onClick={() => nav.go("processes")}>Go to Processes</Button>} />;

  return (
    <>
      <div className={l.grid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        <Stat value={inScope.length} label="Business processes in scope" />
        <Stat value={inScope.length ? Math.round((100 * confirmed) / inScope.length) + "%" : "–"} label="Reviewed and confirmed" tone={C.railActive} />
        <Stat value={active.length} label="Active requirements" />
        <Stat value={gaps} label="Gaps" tone={gaps ? C.bad : undefined} />
        <Stat value={ours.filter(f => f.state === FLOW_STATE.confirmed).length + " / " + ours.length} label="Our flows confirmed" />
        <Stat value={answered + " / " + model.decisions.length} label="Decisions answered" />
      </div>

      {!scopedE2E.length && <Empty title="Nothing in scope yet" text="Open Processes and switch on the business processes your organisation runs." action={<Button appearance="primary" onClick={() => nav.go("processes")}>Choose processes</Button>} />}

      {scopedE2E.map(e => {
        const colour = e.accent && e.accent !== "#64748B" ? e.accent : C.railActive;
        const areas = areasOf(model, e.id).filter(a => a.inScope);
        const procs = model.processes.filter(p => areas.some(a => a.id === p.areaId) && effectiveScope(model, p));
        const done = procs.filter(p => p.review === REVIEW.confirmed).length;
        const onTarget = procs.filter(p => p.targetAppId && model.apps.find(x => x.id === p.targetAppId)?.target).length;
        const open = !closed.has(e.id);
        return (
          <section key={e.id} className={l.card} style={{ padding: 0, overflow: "hidden" }} data-emph="e2e-section">
            <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: colour + "12", borderBottom: open ? "1px solid " + C.line : undefined, cursor: "pointer" }}
              onClick={() => setClosed(s => { const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n; })}>
              {open ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
              <Tile icon={endToEndIcon(e.code)} colour={colour} size={38} filled />
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600 }}><span className={l.code} style={{ minWidth: 0, marginRight: 6 }}>{e.code}</span>{e.name}</div>
                <div className={l.muted} style={{ fontSize: 12 }}>{areas.filter(a => procs.some(p => p.areaId === a.id)).length} process areas · {procs.length} business processes</div>
              </div>
              <Pill text={done + " of " + procs.length + " confirmed"} tone={done === procs.length && procs.length ? "ok" : "neutral"} />
              <Pill text={onTarget + " of " + procs.length + " on target applications"} tone={onTarget === procs.length && procs.length ? "ok" : "warn"} />
              <div style={{ width: 120 }}><Meter part={done} whole={procs.length} colour={colour} /></div>
            </header>
            {open && (
              <div style={{ padding: "6px 18px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                {areas.map(a => {
                  const list = model.processes.filter(p => p.areaId === a.id && effectiveScope(model, p));
                  if (!list.length) return null;
                  const Icon = areaIcon(a.name, e.code);
                  return (
                    <div key={a.id} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14, alignItems: "start", padding: "12px 0", borderTop: "1px solid #F1F5F9" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }} onClick={() => nav.go("processes", list[0].id)}>
                        <Tile icon={Icon} colour={colour} size={34} />
                        <div><div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div><div className={l.code}>{a.code}</div></div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 8 }}>
                        {list.map((p, i) => (
                          <React.Fragment key={p.id}>
                            {i > 0 && <ArrowRight16Regular style={{ alignSelf: "center", color: "#94A3B8" }} />}
                            <ProcessCard p={p} model={model} colour={colour} icon={Icon} n={i + 1} onOpen={() => nav.go("processes", p.id)} />
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {others.length > 0 && (
        <div className={l.card}>
          <div className={l.section} style={{ marginTop: 0, marginBottom: 8 }}>Not in scope</div>
          <div className={l.row}>
            {others.map(e => {
              const I = endToEndIcon(e.code);
              return (
                <button key={e.id} onClick={() => nav.go("processes", e.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid " + C.line, background: "#fff", borderRadius: 999, padding: "4px 12px 4px 6px", cursor: "pointer", color: C.muted, fontSize: 13 }}>
                  <Tile icon={I} colour="#64748B" size={22} />{e.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function ProcessCard({ p, model, colour, icon, n, onOpen }: { p: BusinessProcess; model: Model; colour: string; icon: any; n: number; onOpen: () => void }) {
  const l = useLook();
  const app = (id: string | null) => model.apps.find(a => a.id === id)?.name || "";
  const { reference, ours } = flowsOf(model, p.id);
  const cov = processCoverage(model.requirements, p.id);
  const reqs = model.requirements.filter(r => r.processId === p.id && isActive(r)).length;
  const ok = p.review === REVIEW.confirmed;
  const now = app(p.currentAppId), target = app(p.targetAppId);
  return (
    <div data-emph="process-card" onClick={onOpen} className={l.cardClick}
      style={{ width: 230, display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 10, cursor: "pointer", background: ok ? "#F0FDF4" : "#fff",
        border: "1px solid " + (ok ? "#86EFAC" : C.line), borderTop: "3px solid " + (ok ? C.ok : colour) }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ position: "relative" }}>
          <Tile icon={icon} colour={colour} size={28} filled />
          <span style={{ position: "absolute", top: -6, left: -6, background: "#0F172A", color: "#fff", borderRadius: 999, fontSize: 9, fontWeight: 700, minWidth: 15, height: 15, display: "grid", placeItems: "center" }}>{n}</span>
        </div>
        <div style={{ minWidth: 0, flexGrow: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, lineHeight: "17px" }}>{p.name}</div>
          <div className={l.code}>{p.code}{p.origin === ORIGIN.own ? " · our own" : ""}</div>
        </div>
        <Tooltip content={ok ? "Confirmed" : "Not reviewed yet"} relationship="label">{ok ? <CheckmarkCircle16Filled style={{ color: C.ok, flexShrink: 0 }} /> : <Circle16Regular style={{ color: "#CBD5E1", flexShrink: 0 }} />}</Tooltip>
      </div>
      {(now || target) && <div style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <span>{now || "–"}</span><ArrowRight16Regular style={{ fontSize: 12 }} /><span style={{ color: C.ink, fontWeight: 600 }}>{target || "no target"}</span>
      </div>}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        {p.disposition != null && <Pill text={DISPOSITION_LABEL[p.disposition]} tone={DISPOSITION_TONE[p.disposition]} />}
        {cov.coverage === COVERAGE.gap && <Pill text="Gap" tone="bad" />}
        {reqs > 0 && <Pill text={reqs + (reqs === 1 ? " requirement" : " requirements")} />}
        {(ours || reference) && <Tooltip content={ours ? "Our process" + (ours.state === FLOW_STATE.confirmed ? ", confirmed" : ", draft") : "Microsoft reference flow"} relationship="label">
          <span style={{ display: "inline-flex", alignItems: "center", color: ours ? colour : "#94A3B8", marginLeft: "auto" }}><Flowchart16Regular /></span>
        </Tooltip>}
      </div>
    </div>
  );
}
