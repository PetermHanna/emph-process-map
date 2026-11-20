// The scenario board, drawn like Microsoft's picture: the areas of one end-to-end process left to right with arrows, each
// with its groups of scenario cards, the bands along the bottom. The room sets the scope of the end-to-end process and
// each area (proposals, written at Close when agreed); out-of-scope and Not applicable areas are greyed and folded.
// Cards: tap to keep or strike, star the main path, a note, and the business process the card stands for.
import * as React from "react";
import { Button, Input, Tooltip } from "@fluentui/react-components";
import { Star16Filled, Star16Regular, ArrowRight16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { Choice, Pick, Pill } from "../kit";
import { SCOPE, labelOf } from "../../domain/codes";
import { scopeChoices } from "../../domain/rules";
import { BoardColumn, BoardCard, RunState, MsTemplate, boardViewOf, scopeShown, scopeOff, setMark, setScopeMark, linksOf, boardCounts } from "../../domain/workshop";
import type { Model, ProcessItem } from "../../domain/types";

/** A scope proposal for an end-to-end process or an area, with its reason when out or not applicable. */
export function ScopeMarkPick({ it, run, onRun, disabled }: { it: { id: string; level?: number; scope: number | null; scopeReason?: string }; run: RunState; onRun: (fn: (r: RunState) => RunState) => void; disabled?: boolean }) {
  const shown = scopeShown(run, it), mark = run.scope[it.id];
  const opts = Object.fromEntries(scopeChoices(it.level ?? 2).map(v => [v, labelOf("scope", v)])) as Record<number, string>;
  return (
    <span data-emph="board-scope" data-item={it.id} style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} onClick={e => e.stopPropagation()}>
      <Choice value={shown ?? SCOPE.unspecified} labels={opts} width={150} disabled={disabled} placeholder={labelOf("scope", SCOPE.unspecified)}
        onChange={v => onRun(r => (v == null || (v === it.scope && !r.scope[it.id]?.reason) ? setScopeMark(r, it.id, null) : setScopeMark(r, it.id, { scope: v, reason: r.scope[it.id]?.reason })))} />
      {mark ? <Pill text="proposed" tone="info" /> : null}
      {scopeOff(shown) && <Input size="small" placeholder="Reason" defaultValue={mark?.reason || (shown === it.scope ? it.scopeReason || "" : "")} disabled={disabled} style={{ minWidth: 160 }} data-emph="board-scope-reason"
        onBlur={e => { const reason = e.target.value.trim(); if (reason !== (mark?.reason || "")) onRun(r => setScopeMark(r, it.id, { scope: shown ?? SCOPE.unspecified, reason })); }} />}
    </span>
  );
}

export function BoardTool({ model, e2e, cols, tpl, run, onRun, line, closed }: {
  model: Model; e2e: ProcessItem | null; cols: BoardColumn[]; tpl: MsTemplate | null; run: RunState; onRun: (fn: (r: RunState) => RunState) => void; line: string; closed: boolean;
}) {
  const l = useLook();
  const view = boardViewOf(line);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [noteFor, setNoteFor] = React.useState<string | null>(null);
  const e2eOff = e2e ? scopeOff(scopeShown(run, e2e)) : false;
  const counts = boardCounts(cols, run);
  const processes = (c: BoardColumn) => (c.area ? model.items.filter(x => x.level === 3 && x.parentId === c.area!.id) : []);
  const card = (c: BoardCard, col: BoardColumn) => {
    const m = run.marks[c.key] || {};
    const links = linksOf(run, c);
    const cycle = () => onRun(r => setMark(r, c.key, { ...m, state: !m.state ? "keep" : m.state === "keep" ? "strike" : undefined }));
    const ps = processes(col);
    return (
      <div key={c.key} data-emph="board-card" data-key={c.key} data-state={m.state || ""} style={{ border: "1px solid " + (m.state === "strike" ? "#FCA5A5" : m.state === "keep" ? "#86EFAC" : "#BFDBFE"), borderRadius: 6,
        background: m.state === "strike" ? "#FEF2F2" : m.state === "keep" ? "#F0FDF4" : "#EFF6FF", padding: "4px 6px", fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
          <span role="button" tabIndex={0} data-emph="card-mark" onClick={() => !closed && cycle()} style={{ flexGrow: 1, cursor: closed ? "default" : "pointer", textDecoration: m.state === "strike" ? "line-through" : undefined }}
            title="Tap: keep, strike, clear">• {c.text}</span>
          <Tooltip content="Main path" relationship="label"><Button size="small" appearance="transparent" data-emph="card-main" disabled={closed} icon={m.main ? <Star16Filled color="#D97706" /> : <Star16Regular />}
            onClick={() => onRun(r => setMark(r, c.key, { ...m, main: !m.main }))} /></Tooltip>
        </div>
        {(noteFor === c.key || m.note) && <Input size="small" defaultValue={m.note || ""} placeholder="Note" disabled={closed} autoFocus={noteFor === c.key}
          onBlur={e => { setNoteFor(null); if ((e.target.value || "") !== (m.note || "")) onRun(r => setMark(r, c.key, { ...(r.marks[c.key] || {}), note: e.target.value.trim() })); }} />}
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", color: C.muted }}>
          {!m.note && noteFor !== c.key && !closed && <button style={{ border: 0, background: "none", padding: 0, color: C.muted, cursor: "pointer", fontSize: 11 }} onClick={() => setNoteFor(c.key)}>note</button>}
          {c.catalog ? <span style={{ fontSize: 11 }}>{model.items.find(x => x.id === c.links[0])?.code}</span> : ps.length > 0 && (
            <span data-emph="card-links" style={{ fontSize: 11 }} title="The business process this card stands for: striking it takes that process out at Close">
              <Pick value={links[0] || null} items={ps.map(p => ({ id: p.id, name: p.code + " " + p.name }))} placeholder="Stands for no process" width={150} disabled={closed}
                onChange={id => onRun(r => setMark(r, c.key, { ...(r.marks[c.key] || {}), links: id ? [id] : [] }))} />
            </span>
          )}
        </div>
      </div>
    );
  };
  return (
    <div data-emph="board" data-view={view.view} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {e2e && (
        <div className={l.row} data-emph="board-e2e" style={{ justifyContent: "space-between" }}>
          <span><span className={l.code}>{e2e.code}</span> <b>{e2e.name}</b></span>
          <ScopeMarkPick it={e2e} run={run} onRun={onRun} disabled={closed} />
        </div>
      )}
      {e2eOff && <div style={{ color: C.warn }} data-emph="board-e2e-off">{e2e!.code} {e2e!.name}: {labelOf("scope", scopeShown(run, e2e!))}. The board is greyed; change the scope above to walk it.</div>}
      <div className={l.muted} style={{ fontSize: 12 }} data-emph="board-counts">
        {view.view === "overview" ? "Overview: the areas and their scope. " : "Tap a card to keep it, again to strike it (not in scope), again to clear. Star the main path. "}
        {counts.cards} cards: {counts.kept} kept, {counts.struck} struck, {counts.main} on the main path.{!tpl && " Microsoft has no board for this end-to-end process: the catalog's scenarios stand in."}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", alignItems: "stretch", opacity: e2eOff ? 0.45 : 1, paddingBottom: 4 }}>
        {cols.map((col, i) => {
          const off = col.area ? scopeOff(scopeShown(run, col.area)) : false;
          const n = col.groups.reduce((s, g) => s + g.cards.length, 0);
          const folded = view.view === "overview" || ((off || e2eOff) && !open[col.code]);
          const named = view.area === col.code;
          return (
            <React.Fragment key={col.code}>
              {i > 0 && <ArrowRight16Regular style={{ alignSelf: "center", flexShrink: 0, color: C.muted }} />}
              <div data-emph="board-area" data-code={col.code} data-off={off ? "1" : "0"} style={{ minWidth: 210, maxWidth: 260, flexShrink: 0, border: named ? "2px solid " + C.railActive : "1px solid " + C.line, borderRadius: 8,
                background: off ? "#F1F5F9" : "#fff", padding: 8, display: "flex", flexDirection: "column", gap: 6, opacity: off ? 0.6 : 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}><span className={l.code}>{col.code}</span> {col.name}</div>
                {col.area && col.area.code !== col.code && <div className={l.muted} style={{ fontSize: 11 }}>Catalog {col.area.code} {col.area.name}</div>}
                {!col.area && <div style={{ color: C.warn, fontSize: 11 }}>No catalog area by this name: scope can't be set here.</div>}
                {col.area && <ScopeMarkPick it={col.area} run={run} onRun={onRun} disabled={closed} />}
                {folded ? (
                  <div className={l.muted} style={{ fontSize: 12 }}>
                    {n} cards{view.view !== "overview" && <> · <button style={{ border: 0, background: "none", padding: 0, color: C.railActive, cursor: "pointer" }} data-emph="board-unfold" onClick={() => setOpen(o => ({ ...o, [col.code]: true }))}>Show the {n} cards</button></>}
                  </div>
                ) : col.groups.map(g => (
                  <div key={g.group} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1D4ED8" }}>{g.group}</div>
                    {g.cards.map(c => card(c, col))}
                  </div>
                ))}
                {(off || e2eOff) && open[col.code] && view.view !== "overview" && <button style={{ border: 0, background: "none", padding: 0, color: C.muted, cursor: "pointer", fontSize: 12, textAlign: "left" }} onClick={() => setOpen(o => ({ ...o, [col.code]: false }))}>Fold the cards</button>}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {!!tpl?.bands?.length && <div className={l.row} data-emph="board-bands">{tpl.bands.map(b => <span key={b} style={{ background: "#DCFCE7", color: "#166534", borderRadius: 6, padding: "3px 10px", fontSize: 12 }}>{b}</span>)}</div>}
    </div>
  );
}
