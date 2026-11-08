// Organisation name and the roles used as lanes and process owners.
import * as React from "react";
import { Button, Field, Input, Tooltip } from "@fluentui/react-components";
import { Delete16Regular } from "@fluentui/react-icons";
import { useLook } from "../look";
import { PageProps, Edit, AddBox } from "../kit";

export function Settings({ model, repo, apply }: PageProps) {
  const l = useLook();
  return (
    <>
      <div className={l.card} style={{ maxWidth: 520 }}>
        <Field label="Organisation" hint="Shown in the navigation and on sign-off documents."><Edit value={model.workspace.organisation} onSave={v => apply(m => repo.setOrganisation(m, v.trim()))} /></Field>
      </div>
      <div className={l.card}>
        <div className={l.section} style={{ marginTop: 0 }}>Roles</div>
        <div className={l.muted} style={{ fontSize: 12, marginBottom: 8 }}>Roles are the lanes in process flows and the owners of business processes.</div>
        <table className={l.table}>
          <thead><tr><th>Role</th><th>Summary</th><th>Headcount</th><th>Processes</th><th /></tr></thead>
          <tbody>{model.roles.map(r => {
            const save = (patch: Partial<typeof r>) => apply(m => repo.saveRole(m, r, patch));
            return (
              <tr key={r.id}>
                <td><Edit value={r.name} onSave={v => v.trim() && save({ name: v.trim() })} /></td>
                <td><Edit value={r.summary} onSave={v => save({ summary: v })} /></td>
                <td style={{ width: 110 }}><Input type="number" defaultValue={r.headcount != null ? String(r.headcount) : ""} onBlur={e => { const v = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))); if (v !== r.headcount) save({ headcount: v }); }} /></td>
                <td>{model.processRoles.filter(x => x.roleId === r.id).length || ""}</td>
                <td><Tooltip content="Delete" relationship="label"><Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete the role " + r.name + "?")) apply(m => repo.deleteRole(m, r)); }} /></Tooltip></td>
              </tr>
            );
          })}</tbody>
        </table>
        <div style={{ marginTop: 10 }}><AddBox placeholder="New role" onAdd={name => apply(m => repo.saveRole(m, { id: "", name, summary: "", rank: Math.max(0, ...m.roles.map(x => x.rank)) + 10, headcount: null }, {}))} /></div>
      </div>
    </>
  );
}
