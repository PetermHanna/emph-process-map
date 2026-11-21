// The review of one AI run, by segment like the workshops: organisation and notes, then each end-to-end process and area,
// then each flow. Accept, edit or reject each suggestion, or a whole segment at once; before → after with its quotes; a
// badge when it changes a confirmed value. Accepting applies it with How "AI accepted" and history. Below: what the checks
// dropped, what was already so, and the questions for the next workshop. Clear this run removes what nobody decided.
import * as React from "react";
import { Button, Textarea, Tooltip } from "@fluentui/react-components";
import { Checkmark16Regular, Dismiss16Regular, Edit16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Pill } from "../kit";
import { PROPOSAL, RAID, AI_CONFIDENCE, labelOf } from "../../domain/codes";
import { segmentsOf, segmentCount, isOpen, OBJECT_LABEL } from "../../domain/ai";
import type { AiRun, Proposal } from "../../domain/types";

const tone = (c: number | null) => (c === AI_CONFIDENCE.high ? "ok" : c === AI_CONFIDENCE.low ? "bad" : "warn") as "ok" | "bad" | "warn";
const OP: Record<string, string> = { create: "new", change: "change", remove: "remove" };

export function AiReview({ model, repo, apply, run }: PageProps & { run: AiRun }) {
  const l = useLook();
  const list = model.proposals.filter(p => p.run === run.run);
  const segs = segmentsOf(list, model);
  const open = list.filter(p => isOpen(p.status)).length;
  const [busy, setBusy] = React.useState(false);
  const all = async (items: Proposal[], accept: boolean) => {
    setBusy(true);
    try { for (const p of items.filter(x => isOpen(x.status))) await apply(m => { const cur = m.proposals.find(x => x.id === p.id) || p; return accept ? repo.acceptProposal(m, cur) : repo.rejectProposal(m, cur); }); }
    finally { setBusy(false); }
  };
  const clear = () => { if (window.confirm("Remove the " + open + " suggestions of this run that nobody decided? Accepted, edited and rejected ones stay.")) apply(m => repo.clearRun(m, run.run)); };
  return (
    <div data-emph="ai-review" data-run={run.run} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className={l.row} style={{ justifyContent: "space-between" }}>
        <span style={{ fontSize: 13 }}><b>{list.length} suggestions</b>, {open} open{run.summary ? <span className={l.muted}> · {run.summary}</span> : null}</span>
        <Button size="small" data-emph="ai-clear" disabled={!open || busy} onClick={clear}>Clear this run</Button>
      </div>
      {segs.map(s => (
        <div key={s.key} data-emph="ai-segment" data-key={s.key} style={{ border: "1px solid " + C.line, borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={l.row} style={{ justifyContent: "space-between" }}>
            <b style={{ fontSize: 13 }}>{s.title}</b>
            <span className={l.row}>
              <span className={l.muted} style={{ fontSize: 12 }} data-emph="ai-segment-count">{segmentCount(s)}</span>
              <Button size="small" appearance="primary" data-emph="ai-accept-all" disabled={!s.open || busy} onClick={() => all(s.items, true)}>Accept all</Button>
              <Button size="small" data-emph="ai-none" disabled={!s.open || busy} onClick={() => all(s.items, false)}>None of these</Button>
            </span>
          </div>
          {s.items.map(p => <Suggestion key={p.id} p={p} model={model} repo={repo} apply={apply} busy={busy} />)}
        </div>
      ))}
      {!list.length && <div className={l.muted}>This run made no suggestions{run.skipped.length ? ": everything it found is already so" : ""}.</div>}
      <Folded title={"Dropped by the checks (" + run.dropped.length + ")"} emph="ai-dropped" show={run.dropped.length > 0}>
        {run.dropped.map((d, i) => (
          <div key={i} style={{ fontSize: 12, borderBottom: "1px solid " + C.line, paddingBottom: 4 }}>
            <Pill text={OBJECT_LABEL[d.object] || d.object || "?"} /> {d.text} <span style={{ color: C.bad }}>· {d.reason}</span>
            {d.quotes.map((q, k) => <div key={k} className={l.muted}>“{q.quote}” ({q.source}{q.where ? " " + q.where : ""})</div>)}
          </div>
        ))}
      </Folded>
      <Folded title={"Already so (" + run.skipped.length + ")"} emph="ai-skipped" show={run.skipped.length > 0}>
        {run.skipped.map((d, i) => <div key={i} style={{ fontSize: 12 }}><Pill text={OBJECT_LABEL[d.object] || d.object} /> {d.text} <span className={l.muted}>· {d.why}</span></div>)}
      </Folded>
      <Folded title={"Questions for the next workshop (" + run.questions.length + ")"} emph="ai-questions" show={run.questions.length > 0}>
        {run.questions.map((q, i) => {
          const it = model.items.find(x => x.code === q.unit);
          const raised = model.raids.some(r => r.isQuestion && r.description === q.text);
          return (
            <div key={i} className={l.row} style={{ fontSize: 12, justifyContent: "space-between" }} data-emph="ai-question">
              <span>{q.unit && <span className={l.code}>{q.unit} </span>}{q.text}{q.why && <span className={l.muted}> · {q.why}</span>}</span>
              <Button size="small" disabled={raised} data-emph="ai-question-add" onClick={() => apply(m => repo.addRaid(m, { type: RAID.action, isQuestion: true, description: q.text, itemId: it?.id || null, workshopId: run.workshopId, source: "AI analysis (suggested question): " + q.why }))}>{raised ? "Raised" : "Add as open question"}</Button>
            </div>
          );
        })}
      </Folded>
      {run.problems.length > 0 && <div className={l.muted} style={{ fontSize: 11 }}>{run.problems.join(" · ")}</div>}
    </div>
  );
}

function Folded({ title, emph, show, children }: { title: string; emph: string; show: boolean; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  if (!show) return null;
  return (
    <div data-emph={emph}>
      <Button size="small" appearance="subtle" data-emph={emph + "-toggle"} onClick={() => setOpen(o => !o)}>{open ? "▾ " : "▸ "}{title}</Button>
      {open && <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 12 }}>{children}</div>}
    </div>
  );
}

function Suggestion({ p, model, repo, apply, busy }: PageProps & { p: Proposal; busy: boolean }) {
  const l = useLook();
  const [edit, setEdit] = React.useState<string | null>(null);
  const [showQuotes, setShowQuotes] = React.useState(false);
  const d = p.details, open = isOpen(p.status);
  const main = d.fields.text || d.fields.name || d.fields.reason || "";
  const editable = open && !!main && !(d.object === "scope" || d.op === "remove");
  const accept = (words?: string) => apply(m => repo.acceptProposal(m, m.proposals.find(x => x.id === p.id) || p, words)).then(() => setEdit(null));
  return (
    <div data-emph="ai-item" data-ref={d.ref} data-status={labelOf("proposalStatus", p.status)} style={{ display: "flex", flexDirection: "column", gap: 3, borderTop: "1px solid " + C.line, paddingTop: 5, opacity: open ? 1 : 0.7 }}>
      <div className={l.row} style={{ gap: 6, alignItems: "flex-start" }}>
        <Pill text={(OBJECT_LABEL[d.object] || d.object) + (OP[d.op] && d.object !== "scope" ? " · " + OP[d.op] : "")} tone="info" />
        <Tooltip content={"Confidence " + d.confidence + "; " + d.quotesChecked + " quote(s) found in the source" + (d.quotesUnchecked ? ", " + d.quotesUnchecked + " in a file the app can't search" : "")} relationship="description">
          <span><Pill text={d.confidence} tone={tone(p.confidence)} /></span>
        </Tooltip>
        {d.level === "Confirmed" && (d.op !== "create" || d.object === "scope" || d.object === "fit_gap") && <span data-emph="ai-confirmed"><Pill text="changes a confirmed value" tone="warn" /></span>}
        <span style={{ flexGrow: 1, fontSize: 13 }}>
          {p.field && <span className={l.muted}>{p.field}: </span>}
          {p.current && <><span style={{ textDecoration: "line-through", color: C.muted }} data-emph="ai-before">{p.current}</span> → </>}
          <span data-emph="ai-after">{d.edited || p.proposed}</span>
        </span>
        {open ? (
          <span className={l.row} style={{ gap: 2 }}>
            <Button size="small" appearance="primary" icon={<Checkmark16Regular />} data-emph="ai-accept" disabled={busy} onClick={() => accept()}>Accept</Button>
            {editable && <Button size="small" icon={<Edit16Regular />} data-emph="ai-edit" disabled={busy} onClick={() => setEdit(main)}>Edit</Button>}
            <Button size="small" icon={<Dismiss16Regular />} data-emph="ai-reject" disabled={busy} onClick={() => apply(m => repo.rejectProposal(m, m.proposals.find(x => x.id === p.id) || p))}>Reject</Button>
          </span>
        ) : <Pill text={labelOf("proposalStatus", p.status) + (p.decidedBy ? " by " + p.decidedBy : "")} tone={p.status === PROPOSAL.rejected ? "neutral" : "ok"} />}
      </div>
      {edit != null && (
        <div className={l.row} data-emph="ai-edit-box">
          <Textarea value={edit} onChange={(_, v) => setEdit(v.value)} style={{ flexGrow: 1 }} resize="vertical" />
          <Button size="small" appearance="primary" data-emph="ai-edit-accept" disabled={!edit.trim()} onClick={() => accept(edit)}>Accept edited</Button>
          <Button size="small" onClick={() => setEdit(null)}>Cancel</Button>
        </div>
      )}
      <div style={{ fontSize: 12, paddingLeft: 4 }}>
        {p.evidence.slice(0, showQuotes ? 9 : 1).map((e, i) => (
          <div key={i} data-emph="ai-quote" style={{ color: C.muted }}>“{e.quote}” <span style={{ fontSize: 11 }}>({e.source}{e.where ? " " + e.where : ""}{e.sourceName ? ", " + e.sourceName : ""}{e.checked ? "" : ", not checked: in a file"})</span></div>
        ))}
        {p.evidence.length > 1 && <Button size="small" appearance="transparent" onClick={() => setShowQuotes(s => !s)}>{showQuotes ? "fewer quotes" : "+" + (p.evidence.length - 1) + " quotes"}</Button>}
        {p.reason && <div className={l.muted} style={{ fontStyle: "italic" }}>{p.reason}</div>}
        {d.keptAsNote && <div style={{ color: C.warn }}>Accepting keeps it as a comment: {d.keptAsNote}</div>}
      </div>
    </div>
  );
}
