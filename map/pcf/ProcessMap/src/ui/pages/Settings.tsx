// Organisation name, the roles used as lanes, and the licence each role needs, as Business Map's C7: a licence type (Full,
// Team Members, Operations - Activity, Device, None) and, for Full, a base product (the highest priced app) plus attach
// products. A licence is suggested from the scenarios the role works in. Prices come from a dated price table the person
// keeps here (no prices ship with the app: Microsoft's licensing guide carries no licence to copy it).
import * as React from "react";
import { Button, Field, Input, Tooltip } from "@fluentui/react-components";
import { Delete16Regular, Add16Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Edit, AddBox, ListChoice, Pill, Choice } from "../kit";
import { LICENCE, labelOf, labels, option } from "../../domain/codes";
import { licenceProblems, licenceSummary, roleProducts, suggestLicence, PRICE_KINDS } from "../../domain/rules";
import type { LicencePrice, Role } from "../../domain/types";
import { AI_JOB_LABEL, AI_MODELS, AI_MODEL_LABEL, PROMPT_NAMES, AiJob, promptOf } from "../../domain/aiModels";

const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number, cur: string) => n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + (cur ? " " + cur : "");

export function Settings({ model, repo, apply }: PageProps) {
  const l = useLook();
  const prices = model.workspace.settings.prices;
  const rows = model.roles.map(r => ({ headcount: r.headcount, type: labelOf("licenceType", r.licenceType) || null, base: labelOf("products", r.baseProduct) || null, attach: r.attachProducts || "" }));
  const sum = licenceSummary(rows, prices, today());
  const t = sum.totals;
  return (
    <>
      <div className={l.card} style={{ maxWidth: 520 }}>
        <Field label="Organisation" hint="Shown in the navigation and on sign-off documents."><Edit value={model.workspace.organisation} onSave={v => apply(m => repo.setOrganisation(m, v.trim()))} /></Field>
      </div>
      <div className={l.card}>
        <div className={l.section} style={{ marginTop: 0 }}>Roles and licences</div>
        <div className={l.muted} style={{ fontSize: 12, marginBottom: 8 }}>Roles are the lanes in process flows. The licence is what the people in the role need: a type and, for Full, a base product (the highest priced app) plus attach products.
          It is suggested from the products of the scenarios in scope below the processes the role works in. Workshop transcript lines about licences are kept in the note.</div>
        <table className={l.table} data-emph="roles">
          <thead><tr><th>Role</th><th>Responsible role (Microsoft)</th><th>Headcount</th><th>Licence</th><th>Processes</th><th /></tr></thead>
          <tbody>{model.roles.map(r => <RoleRow key={r.id} r={r} model={model} repo={repo} apply={apply} />)}</tbody>
        </table>
        <div style={{ marginTop: 10 }}><AddBox placeholder="New role" onAdd={name => apply(m => repo.saveRole(m, { id: "", name, summary: "", rank: Math.max(0, ...m.roles.map(x => x.rank)) + 10, headcount: null }, {}))} /></div>
      </div>
      <div className={l.card} data-emph="licence-summary">
        <div className={l.section} style={{ marginTop: 0 }}>Licences per type</div>
        <div className={l.row} style={{ marginTop: 6 }}>
          <Pill text={"Full: " + t.Full} tone="brand" />
          {Object.entries(sum.products).sort((a, b) => a[0].localeCompare(b[0])).map(([p, v]) => <Pill key={p} text={p + ": " + v.base + " base" + (v.attach ? ", " + v.attach + " attach" : "")} tone="info" />)}
          <Pill text={"Team Members: " + t["Team Members"]} /><Pill text={"Operations - Activity: " + t["Operations - Activity"]} /><Pill text={"Device: " + t.Device} /><Pill text={"None: " + t.None} />
          {t.open > 0 && <Pill text={"Not decided: " + t.open} tone="warn" />}
        </div>
        <div className={l.muted} style={{ fontSize: 12, marginTop: 8 }} data-emph="licence-cost">
          {sum.monthly == null ? "Add prices below for a monthly estimate." : "Estimate per month: " + money(sum.monthly, sum.currency) + (sum.complete ? "" : " (some licences have no price in the table yet)") + "."}
          {" "}An estimate for planning, from headcount: the licence follows the security roles people get, so check it against the admin center's licence report after go-live.
        </div>
      </div>
      <Prices prices={prices} onSave={list => apply(m => repo.saveSettings(m, { ...m.workspace.settings, prices: list }))} />
      <AiPrompts model={model} repo={repo} apply={apply} />
    </>
  );
}

function RoleRow({ r, model, repo, apply }: PageProps & { r: Role }) {
  const l = useLook();
  const save = (patch: Partial<Role>) => apply(m => repo.saveRole(m, m.roles.find(x => x.id === r.id) || r, patch));
  const type = labelOf("licenceType", r.licenceType) || null, base = labelOf("products", r.baseProduct) || null;
  const products = roleProducts(model.items, model.itemRoles, r.id);
  const sg = suggestLicence(products, [], model.workspace.settings.prices);
  const same = sg.type === type && (sg.base || null) === base && sg.attach.join("; ") === (r.attachProducts || "");
  const problems = licenceProblems({ type, base, attach: r.attachProducts || "" });
  return (
    <tr data-emph="role-row">
      <td><Edit value={r.name} onSave={v => v.trim() && save({ name: v.trim() })} /></td>
      <td><ListChoice list="responsibleRole" value={r.responsibleRole ?? null} onChange={v => save({ responsibleRole: v })} width={200} /></td>
      <td style={{ width: 100 }}><Input type="number" key={"hc" + (r.headcount ?? "")} defaultValue={r.headcount != null ? String(r.headcount) : ""} onBlur={e => { const v = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))); if (v !== r.headcount) save({ headcount: v }); }} /></td>
      <td style={{ minWidth: 300 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span data-emph="role-licence-type"><ListChoice list="licenceType" value={r.licenceType ?? null} onChange={v => save({ licenceType: v })} width={170} /></span>
          {r.licenceType === LICENCE.full && <>
            <span data-emph="role-licence-base"><ListChoice list="products" value={r.baseProduct ?? null} onChange={v => save({ baseProduct: v })} width={170} placeholder="Base product" /></span>
            <span style={{ width: 200 }}><Edit value={r.attachProducts || ""} onSave={v => save({ attachProducts: v })} placeholder="Attach products (; between)" /></span>
          </>}
          {r.licenceNote && <Tooltip content={<div style={{ whiteSpace: "pre-wrap" }}>{r.licenceNote}</div>} relationship="description"><span className={l.muted} style={{ fontSize: 11, cursor: "help" }}>{r.licenceNote.split("\n").length} noted</span></Tooltip>}
        </div>
        {problems.map(p => <div key={p} style={{ color: C.bad, fontSize: 11 }}>{p}</div>)}
        {!same && <div className={l.muted} style={{ fontSize: 11, marginTop: 4 }} data-emph="role-licence-suggest">
          Suggested: {sg.type}{sg.base ? " (base " + sg.base + (sg.attach.length ? ", attach " + sg.attach.join(", ") : "") + ")" : ""}. {sg.why}{" "}
          <Button size="small" appearance="transparent" data-emph="role-licence-apply" onClick={() => save({ licenceType: option("licenceType", sg.type), baseProduct: sg.base ? option("products", sg.base) : null, attachProducts: sg.attach.join("; "),
            licenceNote: ((r.licenceNote ? r.licenceNote + "\n" : "") + "Suggested from the scenarios: " + sg.why).slice(0, 20000) })}>Use it</Button>
        </div>}
      </td>
      <td>{model.itemRoles.filter(x => x.roleId === r.id).length || ""}</td>
      <td><Tooltip content="Delete" relationship="label"><Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete the role " + r.name + "?")) apply(m => repo.deleteRole(m, r)); }} /></Tooltip></td>
    </tr>
  );
}

const KIND_LABEL = Object.fromEntries(PRICE_KINDS.map((k, i) => [i + 1, k])) as Record<number, string>;
const PRODUCTS = labels("products");

/** The dated price table: list prices per user (or device) per month, newest valid row wins. */
function Prices({ prices, onSave }: { prices: LicencePrice[]; onSave: (list: LicencePrice[]) => void }) {
  const l = useLook();
  const set = (i: number, patch: Partial<LicencePrice>) => onSave(prices.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  return (
    <div className={l.card} data-emph="prices">
      <div className={l.section} style={{ marginTop: 0 }}>Licence prices</div>
      <div className={l.muted} style={{ fontSize: 12, margin: "4px 0 8px" }}>List prices per user (or device) per month, each with the day it is valid from and its source: for example the current Dynamics 365 Licensing Guide,
        or your own agreement. The newest row valid today is used. No prices come with the app; the suggestion above orders base products by these prices.</div>
      <table className={l.table}>
        <thead><tr><th>Product</th><th>Licence</th><th>Price</th><th>Currency</th><th>Valid from</th><th>Source</th><th /></tr></thead>
        <tbody>{prices.map((p, i) => (
          <tr key={i} data-emph="price-row">
            <td><Choice value={option("products", p.product)} labels={PRODUCTS} placeholder="Any" width={170} onChange={v => set(i, { product: labelOf("products", v) })} /></td>
            <td><Choice value={PRICE_KINDS.indexOf(p.kind) + 1 || null} labels={KIND_LABEL} width={150} onChange={v => v && set(i, { kind: PRICE_KINDS[v - 1] })} /></td>
            <td style={{ width: 100 }}><Input type="number" min={0} key={"p" + p.price} defaultValue={String(p.price)} onBlur={e => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== p.price) set(i, { price: v }); }} /></td>
            <td style={{ width: 90 }}><Edit value={p.currency} onSave={v => set(i, { currency: v.trim().toUpperCase() })} placeholder="USD" /></td>
            <td style={{ width: 150 }}><Input type="date" key={"d" + p.validFrom} defaultValue={p.validFrom} onBlur={e => { if (e.target.value && e.target.value !== p.validFrom) set(i, { validFrom: e.target.value }); }} /></td>
            <td><Edit value={p.source} onSave={v => set(i, { source: v })} placeholder="Where the price comes from" /></td>
            <td><Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label="Delete price" onClick={() => onSave(prices.filter((_, k) => k !== i))} /></td>
          </tr>
        ))}</tbody>
      </table>
      <Button style={{ marginTop: 8 }} icon={<Add16Regular />} data-emph="price-add" onClick={() => onSave(prices.concat({ product: "", kind: "Base", price: 0, currency: prices[prices.length - 1]?.currency || "USD", validFrom: today(), source: "" }))}>Add a price</Button>
    </div>
  );
}

/** The AI Builder prompts the AI analysis and the question generator call: a name or an id per job and model (install.md, "AI prompts"). */
function AiPrompts({ model, repo, apply }: PageProps) {
  const l = useLook();
  const set = model.workspace.settings.aiPrompts || {};
  const [state, setState] = React.useState<Record<string, string>>({});
  const check = async () => {
    const out: Record<string, string> = {};
    for (const job of Object.keys(PROMPT_NAMES) as AiJob[]) for (const m of AI_MODELS) { const r = await repo.g.promptReady(promptOf(set, job, m)); out[job + m] = r ? "Not found: " + r : "Found"; }
    setState(out);
  };
  return (
    <div className={l.card} data-emph="ai-prompts">
      <div className={l.section} style={{ marginTop: 0 }}>AI prompts</div>
      <div className={l.muted} style={{ fontSize: 12, marginBottom: 8 }}>The AI analysis and the question generator call AI Builder prompts in this environment (they use AI Builder credits). Create them as install.md says,
        then leave a field empty for the default name, or give another name or the prompt's id. What they return comes from an AI: it is shown as suggestions, and nothing changes until someone accepts one.</div>
      <table className={l.table}>
        <thead><tr><th>Job</th><th>Model</th><th>Prompt name or id</th><th /></tr></thead>
        <tbody>{(Object.keys(PROMPT_NAMES) as AiJob[]).flatMap(job => AI_MODELS.map(m => (
          <tr key={job + m}>
            <td>{AI_JOB_LABEL[job]}</td><td>{AI_MODEL_LABEL[m]}</td>
            <td><Input data-emph={"ai-prompt-" + job + "-" + m} defaultValue={set[job]?.[m] || ""} placeholder={PROMPT_NAMES[job][m]} style={{ width: 320 }}
              onBlur={e => { const v = e.target.value.trim(); if (v === (set[job]?.[m] || "")) return; apply(mm => repo.saveSettings(mm, { ...mm.workspace.settings, aiPrompts: { ...set, [job]: { ...(set[job] || {}), [m]: v } } })); }} /></td>
            <td style={{ fontSize: 12 }}>{state[job + m] || ""}</td>
          </tr>
        )))}</tbody>
      </table>
      <div style={{ marginTop: 8 }}><Button size="small" data-emph="ai-prompts-check" onClick={check}>Check the prompts</Button></div>
    </div>
  );
}
