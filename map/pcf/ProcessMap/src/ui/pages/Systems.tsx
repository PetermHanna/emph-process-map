// Current systems per process area: the software used today and what happens to it (Keep, Migrate, Retire).
// The target is not a list of applications any more: it is the products of the scenarios (level 4) in scope.
import * as React from "react";
import { Button, Input, Tooltip } from "@fluentui/react-components";
import { Delete16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, ListChoice, Edit, AddBox, Pill, Pick, Empty } from "../kit";
import { SYSTEM } from "../../domain/codes";
import { productsOf, levelUp } from "../../domain/rules";
import { effectiveScope, itemsAt, itemLabel } from "../../domain/repository";
import type { CurrentSystem, ProcessItem } from "../../domain/types";

const TONE: Record<number, "ok" | "info" | "neutral"> = { [SYSTEM.keep]: "ok", [SYSTEM.migrate]: "info", [SYSTEM.retire]: "neutral" };

export function Systems({ model, repo, apply }: PageProps) {
  const l = useLook();
  const areas = itemsAt(model, 2).filter(a => effectiveScope(model, a) || model.systems.some(s => s.itemId === a.id));
  const areaOf = (s: CurrentSystem) => { const it = model.items.find(x => x.id === s.itemId); return it ? levelUp(model.items, it, 2) : undefined; };
  const loose = model.systems.filter(s => !areaOf(s) || !areas.includes(areaOf(s)!));
  const target = Array.from(new Set(areas.filter(a => effectiveScope(model, a)).flatMap(a => productsOf(model.items, a)))).sort();
  const blank = (itemId: string | null, name: string): CurrentSystem => ({ id: "", itemId, name, vendor: "", decision: SYSTEM.keep, retireOn: null, users: "", hosting: "", note: "" });
  return (
    <>
      <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className={l.muted} style={{ fontSize: 12 }}>The software used today in each process area in scope, and what happens to it. The target comes from the products of the scenarios in scope (Processes page).</div>
        <div className={l.row} data-emph="systems-target"><span className={l.muted} style={{ fontSize: 12 }}>Target products:</span>{target.length ? target.map(x => <Pill key={x} text={x} tone="brand" />) : <span className={l.muted} style={{ fontSize: 12 }}>no scenario in scope yet</span>}</div>
      </div>
      {!areas.length && <Empty title="No process area in scope" text="Put business processes in scope on Our processes; their areas show here." />}
      {areas.map(a => (
        <div key={a.id} className={l.card} data-emph="systems-area" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className={l.row}>
            <span className={l.code}>{a.code}</span><b>{a.name}</b>
            <span className={l.muted} style={{ fontSize: 12 }}>{itemLabel(levelUp(model.items, a, 1))}</span>
            <span style={{ flexGrow: 1 }} />
            <span className={l.muted} style={{ fontSize: 12 }}>Target:</span>{productsOf(model.items, a).map(x => <Pill key={x} text={x} tone="brand" />)}
          </div>
          <SystemTable rows={model.systems.filter(s => areaOf(s)?.id === a.id)} area={a} model={model} repo={repo} apply={apply} />
          <AddBox placeholder={"A system used today in " + a.name} onAdd={name => apply(m => repo.saveSystem(m, blank(a.id, name), {}))} />
        </div>
      ))}
      {loose.length > 0 && (
        <div className={l.card}>
          <div className={l.section} style={{ marginTop: 0 }}>Not on a process area in scope</div>
          <SystemTable rows={loose} area={null} model={model} repo={repo} apply={apply} />
        </div>
      )}
    </>
  );
}

function SystemTable({ rows, area, model, repo, apply }: PageProps & { rows: CurrentSystem[]; area: ProcessItem | null }) {
  const l = useLook();
  if (!rows.length) return <span className={l.muted} style={{ fontSize: 12 }}>No system recorded.</span>;
  // a system sits on the area, or on one business process in it
  const places = (s: CurrentSystem) => (area ? [area, ...model.items.filter(x => x.parentId === area.id)] : model.items.filter(x => x.id === s.itemId)).map(x => ({ id: x.id, name: itemLabel(x) }));
  return (
    <table className={l.table} data-emph="systems">
      <thead><tr><th>System</th><th>Vendor</th><th>Used for</th><th>Decision</th><th>Retire on</th><th>Users</th><th /></tr></thead>
      <tbody>{rows.map(s => {
        const save = (patch: Partial<CurrentSystem>) => apply(m => repo.saveSystem(m, m.systems.find(x => x.id === s.id) || s, patch));
        return (
          <tr key={s.id}>
            <td style={{ minWidth: 180 }}><Edit value={s.name} onSave={v => v.trim() && save({ name: v.trim() })} /></td>
            <td><Edit value={s.vendor} onSave={v => save({ vendor: v })} /></td>
            <td><Pick value={s.itemId} items={places(s)} onChange={v => save({ itemId: v })} width={200} /></td>
            <td><ListChoice list="systemDecision" value={s.decision} onChange={v => save({ decision: v })} width={110} />{s.decision != null && <span style={{ marginLeft: 4 }}><Pill text={s.decision === SYSTEM.retire ? "goes" : s.decision === SYSTEM.migrate ? "moves" : "stays"} tone={TONE[s.decision]} /></span>}</td>
            <td style={{ width: 150 }}><Input type="date" defaultValue={s.retireOn || ""} onBlur={e => { if ((e.target.value || null) !== s.retireOn) save({ retireOn: e.target.value || null }); }} /></td>
            <td style={{ width: 90 }}><Edit value={s.users} onSave={v => save({ users: v })} /></td>
            <td><Tooltip content="Delete" relationship="label"><Button size="small" appearance="subtle" icon={<Delete16Regular />} style={{ color: C.muted }} onClick={() => { if (window.confirm("Delete " + s.name + "?")) apply(m => repo.deleteSystem(m, s)); }} /></Tooltip></td>
          </tr>
        );
      })}</tbody>
    </table>
  );
}
