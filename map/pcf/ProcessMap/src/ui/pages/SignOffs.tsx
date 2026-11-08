// Sign-off: freeze scope, decisions, flows and requirements; compare with today; approve; export.
import * as React from "react";
import { Button, Field, Input, Spinner } from "@fluentui/react-components";
import { ArrowDownload16Regular, DocumentText16Regular, Print16Regular } from "@fluentui/react-icons";
import { useLook } from "../look";
import { PageProps, Pill, Empty, Problem } from "../kit";
import { SIGNOFF, SIGNOFF_LABEL, ITEM_LABEL } from "../../domain/codes";
import { canApprove, differences, Difference, FrozenItem } from "../../domain/rules";
import { signOffTables, workbook, signOffDocument, saveFile, printHtml } from "../../domain/documents";
import { loadSignOffItems, signOffContents } from "../../domain/repository";
import type { SignOff } from "../../domain/types";

export function SignOffs({ model, repo, apply, user }: PageProps & { user: { id: string | null; name: string } }) {
  const l = useLook();
  const [note, setNote] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const open = model.signOffs.find(s => s.id === openId) || null;
  return (
    <>
      <div className={l.card + " " + l.row}>
        <Field label="Scope note" style={{ flexGrow: 1 }}><Input value={note} placeholder="What this sign-off covers" onChange={(_, d) => setNote(d.value)} /></Field>
        <Button appearance="primary" disabled={busy} data-emph="signoff-freeze" onClick={async () => { setBusy(true); await apply(m => repo.freeze(m, note)); setNote(""); setBusy(false); }}>Freeze for review</Button>
        {busy && <Spinner size="tiny" />}
      </div>
      {!model.signOffs.length ? <Empty title="Nothing signed off yet" text="Freezing takes a copy of the scope, configuration decisions, confirmed flows and active requirements, so later changes show against it." /> : (
        <div className={l.card}>
          <table className={l.table}>
            <thead><tr><th>Sign-off</th><th>Version</th><th>State</th><th>Approved</th><th>Scope note</th></tr></thead>
            <tbody>{model.signOffs.map(s => (
              <tr key={s.id} className={l.tr} onClick={() => setOpenId(s.id === openId ? null : s.id)}>
                <td>{s.name}</td><td>v{s.version}</td>
                <td><Pill text={SIGNOFF_LABEL[s.state]} tone={s.state === SIGNOFF.approved ? "ok" : s.state === SIGNOFF.review ? "warn" : "neutral"} /></td>
                <td>{s.approvedOn ? s.approvedOn.slice(0, 10) + (s.approver ? " by " + s.approver : "") : ""}</td><td className={l.muted}>{s.scopeNote}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {open && <Detail key={open.id} s={open} model={model} repo={repo} apply={apply} user={user} onGone={() => setOpenId(null)} />}
    </>
  );
}

function Detail({ s, model, repo, apply, user, onGone }: PageProps & { s: SignOff; user: { id: string | null; name: string }; onGone: () => void }) {
  const l = useLook();
  const [items, setItems] = React.useState<FrozenItem[] | null>(null);
  const [diff, setDiff] = React.useState<Difference[] | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  React.useEffect(() => { loadSignOffItems(repo.g, s.id).then(setItems).catch(e => setProblem(String(e?.message || e))); }, [s.id]);
  const approved = s.state === SIGNOFF.approved || s.state === SIGNOFF.superseded;
  const title = (model.workspace.organisation || "Process") + " sign-off v" + s.version;
  const facts: [string, string][] = [["State", SIGNOFF_LABEL[s.state]], ["Scope note", s.scopeNote || "-"], ["Approved", s.approvedOn ? s.approvedOn.slice(0, 10) + " by " + (s.approver || "-") : "Not yet"]];
  const file = title.replace(/[^\w.-]+/g, "_");
  if (!items) return <div className={l.card}><Problem text={problem} />{!problem && <Spinner label="Loading" />}</div>;
  const counts = signOffTables(items).map(t => t.title + ": " + t.rows.length).join(" · ");
  return (
    <div className={l.card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Problem text={problem} onClose={() => setProblem(null)} />
      <div className={l.row}><b>{s.name}</b><span className={l.muted}>{counts}</span></div>
      <div className={l.row}>
        {canApprove(s, model.signOffs) && <Button appearance="primary" onClick={() => apply(m => repo.approve(m, s, user.id, user.name))}>Approve</Button>}
        {!approved && <Button onClick={() => { if (window.confirm("Discard " + s.name + "? This can't be undone.")) { onGone(); apply(m => repo.discard(m, s)); } }}>Discard</Button>}
        <Button icon={<ArrowDownload16Regular />} onClick={() => saveFile(file + ".xlsx", workbook(signOffTables(items)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>Excel</Button>
        <Button icon={<DocumentText16Regular />} onClick={() => saveFile(file + ".doc", signOffDocument(title, facts, items, approved), "application/msword")}>Word</Button>
        <Button icon={<Print16Regular />} onClick={() => { if (!printHtml(signOffDocument(title, facts, items, approved))) setProblem("The browser blocked the print window. Allow pop-ups for this site."); }}>PDF</Button>
        <Button appearance="subtle" onClick={async () => setDiff(differences(items, await signOffContents(repo.g, model)))}>Compare with today</Button>
      </div>
      {diff && (diff.length === 0 ? <div className={l.muted}>No changes since this sign-off.</div> : (
        <table className={l.table}>
          <thead><tr><th>Change</th><th>Type</th><th>Item</th><th>Fields</th></tr></thead>
          <tbody>{diff.map((d, i) => (
            <tr key={i}><td><Pill text={d.kind} tone={d.kind === "added" ? "ok" : d.kind === "removed" ? "bad" : "warn"} /></td><td>{ITEM_LABEL[d.item.type]}</td><td>{d.item.name}</td><td className={l.muted}>{d.kind === "changed" ? d.fields.join(", ") : ""}</td></tr>
          ))}</tbody>
        </table>
      ))}
    </div>
  );
}
