// History (emph_history, insert only): every change to a process item's or requirement's tracked fields, old -> new,
// how (workshop, direct, migration, proposal, restore), by whom and when. Restoring an old value is itself a change,
// so it writes a new history row.
import * as React from "react";
import { Button, Input, Tooltip } from "@fluentui/react-components";
import { ArrowUndo16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Pill, Choice, Empty } from "../kit";
import type { Nav } from "../Shell";
import { labelOf } from "../../domain/codes";
import { historyField, historyOf, restorePatch } from "../../domain/rules";
import { itemLabel } from "../../domain/repository";
import type { HistoryRow, Model } from "../../domain/types";

const TABLES: Record<number, string> = { 1: "Process items", 2: "Requirements" };
const TABLE_OF: Record<number, string> = { 1: "emph_processitem", 2: "emph_requirement" };
const when = (iso: string) => (iso ? iso.slice(0, 16).replace("T", " ") : "");

/** A history value as text: a process item's id as its label. */
function shown(m: Model, h: HistoryRow, v: string) {
  if (h.field === "_emph_item_value" && v) return itemLabel(m.items.find(x => x.id === v)) || v;
  return v;
}
/** What the row is about: "80.20.010 Name" or "RQ-00012 Name". */
export function rowName(m: Model, h: HistoryRow) {
  if (h.table === "emph_processitem") return itemLabel(m.items.find(x => x.id === h.rowId)) || "(deleted item)";
  const r = m.requirements.find(x => x.id === h.rowId);
  return r ? (r.reqId ? r.reqId + " " : "") + r.name : "(deleted requirement)";
}

function Line({ h, model, repo, apply, showRow, onOpen }: PageProps & { h: HistoryRow; showRow?: boolean; onOpen?: () => void }) {
  const l = useLook();
  const def = historyField(h.table, h.field);
  const can = "patch" in restorePatch(h, model.history);
  return (
    <tr data-emph="history-row">
      {showRow && <td><button onClick={onOpen} style={{ border: 0, background: "transparent", color: "#0F766E", cursor: "pointer", padding: 0, textAlign: "left" }}>{rowName(model, h)}</button></td>}
      <td style={{ whiteSpace: "nowrap" }}>{def?.label || h.field}</td>
      <td><span style={{ color: C.muted, textDecoration: "line-through" }}>{shown(model, h, h.oldValue) || "empty"}</span> → <b>{shown(model, h, h.newValue) || "empty"}</b></td>
      <td><Pill text={labelOf("setHow", h.how) || "Direct"} tone={h.how != null && labelOf("setHow", h.how) === "Restore" ? "warn" : "neutral"} />{h.workshopName && <span className={l.muted} style={{ fontSize: 11 }}> {h.workshopName}</span>}</td>
      <td className={l.muted} style={{ whiteSpace: "nowrap" }}>{h.by || "-"}</td>
      <td className={l.muted} style={{ whiteSpace: "nowrap" }}>{when(h.createdOn)}</td>
      <td>{can && <Tooltip content={"Restore “" + (shown(model, h, h.oldValue) || "empty") + "”"} relationship="label">
        <Button size="small" appearance="subtle" data-emph="history-restore" icon={<ArrowUndo16Regular />} onClick={() => apply(m => repo.restore(m, h))}>Restore</Button>
      </Tooltip>}</td>
    </tr>
  );
}

const Head = ({ showRow }: { showRow?: boolean }) => <thead><tr>{showRow && <th>Item</th>}<th>Field</th><th>Old → new</th><th>How</th><th>By</th><th>When</th><th /></tr></thead>;

/** The history of one process item or requirement, folded until opened. */
export function ItemHistory({ model, repo, apply, table, rowId }: PageProps & { table: string; rowId: string }) {
  const l = useLook();
  const [open, setOpen] = React.useState(false);
  const rows = historyOf(model.history, table, rowId);
  if (!rows.length) return <div className={l.muted} style={{ fontSize: 12 }} data-emph="item-history">No changes recorded yet.</div>;
  return (
    <div data-emph="item-history">
      <Button size="small" appearance="subtle" onClick={() => setOpen(!open)} data-emph="item-history-toggle">{open ? "Hide history" : "History (" + rows.length + ")"}</Button>
      {open && <table className={l.table}><Head /><tbody>{rows.map(h => <Line key={h.id || h.createdOn + h.field} h={h} model={model} repo={repo} apply={apply} />)}</tbody></table>}
    </div>
  );
}

export function History({ model, repo, apply, nav }: PageProps & { nav: Nav }) {
  const l = useLook();
  const [table, setTable] = React.useState<number | null>(null);
  const [find, setFind] = React.useState("");
  const f = find.trim().toLowerCase();
  const rows = model.history.filter(h => (table == null || h.table === TABLE_OF[table]) && (!f || (rowName(model, h) + " " + h.oldValue + " " + h.newValue + " " + h.by).toLowerCase().includes(f)))
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  const shownRows = rows.slice(0, 300);
  const open = (h: HistoryRow) => (h.table === "emph_processitem" ? nav.go("processes", h.rowId) : nav.go("requirements", h.rowId));
  return (
    <>
      <div className={l.card + " " + l.row}>
        <Choice value={table} labels={TABLES} placeholder="All changes" onChange={setTable} width={170} />
        <Input placeholder="Find an item, a value or a person" value={find} onChange={(_, d) => setFind(d.value)} style={{ minWidth: 280 }} />
        <span className={l.muted} style={{ fontSize: 12 }}>{rows.length} change{rows.length === 1 ? "" : "s"}{rows.length > shownRows.length ? ", the newest " + shownRows.length + " shown" : ""}. Restoring writes a new row.</span>
      </div>
      {!rows.length ? <Empty title="No changes yet" text="Changes to scope, fit-gap, owners and requirements are recorded here as they are made." /> : (
        <div className={l.card} data-emph="history">
          <table className={l.table}><Head showRow /><tbody>{shownRows.map(h => <Line key={h.id || h.createdOn + h.field} h={h} model={model} repo={repo} apply={apply} showRow onOpen={() => open(h)} />)}</tbody></table>
        </div>
      )}
    </>
  );
}
