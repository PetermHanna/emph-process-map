// Applications in use today and planned.
import * as React from "react";
import { Button, Switch, Tooltip } from "@fluentui/react-components";
import { Delete16Regular } from "@fluentui/react-icons";
import { useLook } from "../look";
import { PageProps, Choice, Edit, AddBox, Pill } from "../kit";
import { APP_CATEGORY_LABEL, APP_STATUS, APP_STATUS_LABEL } from "../../domain/codes";

export function Applications({ model, repo, apply }: PageProps) {
  const l = useLook();
  const usedBy = (id: string) => model.processes.filter(p => p.currentAppId === id || p.targetAppId === id).length;
  return (
    <div className={l.card}>
      <table className={l.table} data-emph="applications">
        <thead><tr><th>Application</th><th>Category</th><th>Publisher</th><th>Status</th><th>Microsoft</th><th>Target</th><th>Processes</th><th /></tr></thead>
        <tbody>{model.apps.map(a => {
          const save = (patch: Partial<typeof a>) => apply(m => repo.saveApp(m, a, patch));
          return (
            <tr key={a.id}>
              <td style={{ minWidth: 200 }}><Edit value={a.name} onSave={v => v.trim() && save({ name: v.trim() })} /></td>
              <td><Choice value={a.category} labels={APP_CATEGORY_LABEL} onChange={v => save({ category: v })} /></td>
              <td><Edit value={a.publisher} onSave={v => save({ publisher: v })} /></td>
              <td><Choice value={a.status} labels={APP_STATUS_LABEL} onChange={v => save({ status: v })} width={120} /></td>
              <td><Switch checked={a.microsoft} onChange={(_, d) => save({ microsoft: d.checked })} /></td>
              <td><Switch checked={a.target} onChange={(_, d) => save({ target: d.checked })} /></td>
              <td>{usedBy(a.id) || ""}{a.target && <> <Pill text="Target" tone="brand" /></>}</td>
              <td><Tooltip content="Delete" relationship="label"><Button size="small" appearance="subtle" icon={<Delete16Regular />} onClick={() => { if (window.confirm("Delete " + a.name + "? Business processes using it lose the link.")) apply(m => repo.deleteApp(m, a)); }} /></Tooltip></td>
            </tr>
          );
        })}</tbody>
      </table>
      <div style={{ marginTop: 10 }}><AddBox placeholder="New application" onAdd={name => apply(m => repo.saveApp(m, { id: "", name, category: null, publisher: "", microsoft: false, target: false, status: APP_STATUS.inUse, hosting: "", summary: "" }, {}))} /></div>
    </div>
  );
}
