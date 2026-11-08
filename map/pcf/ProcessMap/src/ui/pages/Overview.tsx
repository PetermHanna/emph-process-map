// Scope and progress at a glance, one card per end-to-end process.
import * as React from "react";
import { Button } from "@fluentui/react-components";
import { C, useLook } from "../look";
import { PageProps, Stat, Meter, Empty, Pill } from "../kit";
import type { Nav } from "../Shell";
import { REVIEW, COVERAGE, FLOW_TYPE, FLOW_STATE } from "../../domain/codes";
import { isActive } from "../../domain/rules";
import { areasOf, effectiveScope } from "../../domain/repository";

export function Overview({ model, nav }: PageProps & { nav: Nav }) {
  const l = useLook();
  const inScope = model.processes.filter(p => effectiveScope(model, p));
  const confirmed = inScope.filter(p => p.review === REVIEW.confirmed).length;
  const active = model.requirements.filter(isActive);
  const gaps = active.filter(r => r.coverage === COVERAGE.gap).length;
  const ours = model.flows.filter(f => f.type === FLOW_TYPE.ours);
  const answered = model.decisions.filter(d => d.answer.trim()).length;

  if (!model.endToEnds.length) return <Empty title="No end-to-end processes yet" text="Load the Microsoft Business Process Catalog or the sample, or add your first end-to-end process." action={<Button appearance="primary" onClick={() => nav.go("processes")}>Go to Processes</Button>} />;

  return (
    <>
      <div className={l.grid}>
        <Stat value={inScope.length} label="Business processes in scope" />
        <Stat value={inScope.length ? Math.round((100 * confirmed) / inScope.length) + "%" : "–"} label="Reviewed and confirmed" tone={C.railActive} />
        <Stat value={active.length} label="Active requirements" />
        <Stat value={gaps} label="Gaps" tone={gaps ? C.bad : undefined} />
        <Stat value={ours.filter(f => f.state === FLOW_STATE.confirmed).length + " / " + ours.length} label="Our flows confirmed" />
        <Stat value={answered + " / " + model.decisions.length} label="Configuration decisions answered" />
      </div>
      <div className={l.section}>End-to-end processes</div>
      <div className={l.grid}>
        {model.endToEnds.map(e => {
          const areas = areasOf(model, e.id);
          const procs = model.processes.filter(p => areas.some(a => a.id === p.areaId));
          const scoped = procs.filter(p => effectiveScope(model, p));
          const done = scoped.filter(p => p.review === REVIEW.confirmed).length;
          const reqs = active.filter(r => procs.some(p => p.id === r.processId)).length;
          return (
            <div key={e.id} data-emph="e2e-card" className={l.card + " " + l.cardClick} style={{ borderTop: "4px solid " + (e.accent || C.railActive), opacity: e.inScope ? 1 : 0.55 }} onClick={() => nav.go("processes", e.id)}>
              <div className={l.row} style={{ justifyContent: "space-between" }}><span className={l.code}>{e.code}</span>{!e.inScope && <Pill text="Out of scope" />}</div>
              <div style={{ fontWeight: 600, fontSize: 16, margin: "4px 0 10px" }}>{e.name}</div>
              <div className={l.muted} style={{ fontSize: 12, marginBottom: 6 }}>{areas.length} areas · {scoped.length} of {procs.length} processes in scope · {reqs} requirements</div>
              <Meter part={done} whole={scoped.length} colour={e.accent || C.railActive} />
            </div>
          );
        })}
      </div>
    </>
  );
}
