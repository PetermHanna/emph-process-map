// Organisation name and the roles used as lanes and process owners, with the licence each role needs.
import * as React from "react";
import { Button, Field, Input, Tooltip } from "@fluentui/react-components";
import { Delete16Regular } from "@fluentui/react-icons";
import { useLook } from "../look";
import { PageProps, Edit, AddBox, Choice, Pill } from "../kit";
import { LICENCE_LABEL } from "../../domain/codes";

export function Settings({ model, repo, apply }: PageProps) {
  const l = useLook();
  // people per licence type: the role's licence count, else its headcount
  const totals = Object.keys(LICENCE_LABEL).map(Number).map(t => ({ t, people: model.roles.filter(r => r.licenceType === t).reduce((n, r) => n + (r.licenceUsers ?? r.headcount ?? 0), 0), roles: model.roles.filter(r => r.licenceType === t).length })).filter(x => x.roles);
  return (
    <>
      <div className={l.card} style={{ maxWidth: 520 }}>
        <Field label="Organisation" hint="Shown in the navigation and on sign-off documents."><Edit value={model.workspace.organisation} onSave={v => apply(m => repo.setOrganisation(m, v.trim()))} /></Field>
      </div>
      <div className={l.card}>
        <div className={l.section} style={{ marginTop: 0 }}>Roles</div>
        <div className={l.muted} style={{ fontSize: 12, marginBottom: 8 }}>Roles are the lanes in process flows and the owners of business processes. The licence is what the people in the role need; workshop transcript lines about licences are kept under the role.</div>
        <table className={l.table} data-emph="roles">
          <thead><tr><th>Role</th><th>Summary</th><th>Headcount</th><th>Licence</th><th>People</th><th>Processes</th><th /></tr></thead>
          <tbody>{model.roles.map(r => {
            const save = (patch: Partial<typeof r>) => apply(m => repo.saveRole(m, m.roles.find(x => x.id === r.id) || r, patch));
            return (
              <tr key={r.id}>
                <td><Edit value={r.name} onSave={v => v.trim() && save({ name: v.trim() })} /></td>
                <td><Edit value={r.summary} onSave={v => save({ summary: v })} /></td>
                <td style={{ width: 110 }}><Input type="number" defaultValue={r.headcount != null ? String(r.headcount) : ""} onBlur={e => { const v = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))); if (v !== r.headcount) save({ headcount: v }); }} /></td>
                <td style={{ width: 190 }}>
                  <Choice value={r.licenceType ?? null} labels={LICENCE_LABEL} onChange={v => save({ licenceType: v })} width={170} />
                  {r.licenceNote && <Tooltip content={<div style={{ whiteSpace: "pre-wrap" }}>{r.licenceNote}</div>} relationship="description"><span className={l.muted} style={{ fontSize: 11, cursor: "help" }}> {r.licenceNote.split("\n").length} quoted</span></Tooltip>}
                </td>
                <td style={{ width: 100 }}><Input type="number" key={"lu" + (r.licenceUsers ?? "")} defaultValue={r.licenceUsers != null ? String(r.licenceUsers) : ""} placeholder={r.headcount != null ? String(r.headcount) : ""} onBlur={e => { const v = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))); if (v !== (r.licenceUsers ?? null)) save({ licenceUsers: v }); }} /></td>
                <td>{model.processRoles.filter(x => x.roleId === r.id).length || ""}</td>
                <td><Tooltip content="Delete" relationship="label"><Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete the role " + r.name + "?")) apply(m => repo.deleteRole(m, r)); }} /></Tooltip></td>
              </tr>
            );
          })}</tbody>
        </table>
        {totals.length > 0 && <div className={l.row} style={{ marginTop: 8 }} data-emph="licence-totals"><span className={l.muted} style={{ fontSize: 12 }}>Licences:</span>{totals.map(x => <Pill key={x.t} text={LICENCE_LABEL[x.t] + ": " + x.people} tone="brand" />)}</div>}
        <div style={{ marginTop: 10 }}><AddBox placeholder="New role" onAdd={name => apply(m => repo.saveRole(m, { id: "", name, summary: "", rank: Math.max(0, ...m.roles.map(x => x.rank)) + 10, headcount: null }, {}))} /></div>
      </div>
    </>
  );
}
