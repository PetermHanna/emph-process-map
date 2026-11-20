// Organisation name and the roles used as lanes, with Microsoft's responsible role, headcount and the licence each role needs:
// a licence type and, for Full, a base product (the highest priced app) plus attach products.
import * as React from "react";
import { Button, Field, Input, Tooltip } from "@fluentui/react-components";
import { Delete16Regular } from "@fluentui/react-icons";
import { useLook } from "../look";
import { PageProps, Edit, AddBox, ListChoice, Pill } from "../kit";
import { LICENCE_LABEL, labelOf } from "../../domain/codes";

export function Settings({ model, repo, apply }: PageProps) {
  const l = useLook();
  // people per licence type and base product: the role's headcount
  const groups = new Map<string, number>();
  model.roles.filter(r => r.licenceType != null).forEach(r => { const k = LICENCE_LABEL[r.licenceType!] + (r.baseProduct != null ? " " + labelOf("products", r.baseProduct) : ""); groups.set(k, (groups.get(k) || 0) + (r.headcount ?? 0)); });
  return (
    <>
      <div className={l.card} style={{ maxWidth: 520 }}>
        <Field label="Organisation" hint="Shown in the navigation and on sign-off documents."><Edit value={model.workspace.organisation} onSave={v => apply(m => repo.setOrganisation(m, v.trim()))} /></Field>
      </div>
      <div className={l.card}>
        <div className={l.section} style={{ marginTop: 0 }}>Roles</div>
        <div className={l.muted} style={{ fontSize: 12, marginBottom: 8 }}>Roles are the lanes in process flows. The licence is what the people in the role need: a type and, for Full, a base product plus attach products. Workshop transcript lines about licences are kept in the note.</div>
        <table className={l.table} data-emph="roles">
          <thead><tr><th>Role</th><th>Responsible role (Microsoft)</th><th>Headcount</th><th>Licence type</th><th>Base product</th><th>Attach products</th><th>Processes</th><th /></tr></thead>
          <tbody>{model.roles.map(r => {
            const save = (patch: Partial<typeof r>) => apply(m => repo.saveRole(m, m.roles.find(x => x.id === r.id) || r, patch));
            return (
              <tr key={r.id}>
                <td><Edit value={r.name} onSave={v => v.trim() && save({ name: v.trim() })} /></td>
                <td><ListChoice list="responsibleRole" value={r.responsibleRole ?? null} onChange={v => save({ responsibleRole: v })} width={200} /></td>
                <td style={{ width: 100 }}><Input type="number" key={"hc" + (r.headcount ?? "")} defaultValue={r.headcount != null ? String(r.headcount) : ""} onBlur={e => { const v = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))); if (v !== r.headcount) save({ headcount: v }); }} /></td>
                <td style={{ width: 200 }}>
                  <ListChoice list="licenceType" value={r.licenceType ?? null} onChange={v => save({ licenceType: v })} width={170} />
                  {r.licenceNote && <Tooltip content={<div style={{ whiteSpace: "pre-wrap" }}>{r.licenceNote}</div>} relationship="description"><span className={l.muted} style={{ fontSize: 11, cursor: "help" }}> {r.licenceNote.split("\n").length} quoted</span></Tooltip>}
                </td>
                <td><ListChoice list="products" value={r.baseProduct ?? null} onChange={v => save({ baseProduct: v })} width={170} /></td>
                <td><Edit value={r.attachProducts || ""} onSave={v => save({ attachProducts: v })} placeholder="e.g. Field Service" /></td>
                <td>{model.itemRoles.filter(x => x.roleId === r.id).length || ""}</td>
                <td><Tooltip content="Delete" relationship="label"><Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete the role " + r.name + "?")) apply(m => repo.deleteRole(m, r)); }} /></Tooltip></td>
              </tr>
            );
          })}</tbody>
        </table>
        {groups.size > 0 && <div className={l.row} style={{ marginTop: 8 }} data-emph="licence-totals"><span className={l.muted} style={{ fontSize: 12 }}>Licences:</span>{[...groups].map(([k, n]) => <Pill key={k} text={k + ": " + n} tone="brand" />)}</div>}
        <div style={{ marginTop: 10 }}><AddBox placeholder="New role" onAdd={name => apply(m => repo.saveRole(m, { id: "", name, summary: "", rank: Math.max(0, ...m.roles.map(x => x.rank)) + 10, headcount: null }, {}))} /></div>
      </div>
    </>
  );
}
