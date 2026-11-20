// A requirement opens its flow with its step selected (Business Map N1): "Open flow: 80.20.010 Estimate projects › Approve".
// The flow is our process if there is one, else Microsoft's reference, of the requirement's business process (a scenario's parent).
import * as React from "react";
import { Button } from "@fluentui/react-components";
import { Flowchart16Regular } from "@fluentui/react-icons";
import { C } from "../look";
import type { Apply } from "../kit";
import { DELTA } from "../../domain/codes";
import { flowLinkText } from "../../domain/rules";
import { flowsOf, loadActivities, Repository } from "../../domain/repository";
import type { Model, Requirement, ProcessItem, Activity } from "../../domain/types";
import { FlowStudio } from "../flow/FlowStudio";

/** The business process a requirement's flow hangs on: its item if that is level 3, the parent of a scenario. */
export function processOf(model: Model, itemId: string | null): ProcessItem | null {
  const it = model.items.find(x => x.id === itemId);
  if (!it) return null;
  if (it.level === 3) return it;
  if (it.level === 4) return model.items.find(x => x.id === it.parentId) || null;
  return null;
}

/** One read per flow, shared by every link on the page. */
const acts = new Map<string, Promise<Activity[]>>();
const activitiesOf = (repo: Repository, flowId: string) => { if (!acts.has(flowId)) acts.set(flowId, loadActivities(repo.g, flowId).catch(() => [])); return acts.get(flowId)!; };

export function FlowLink({ model, repo, apply, r }: { model: Model; repo: Repository; apply: Apply; r: Requirement }) {
  const p = processOf(model, r.itemId);
  const flow = p ? flowsOf(model, p.id).ours || flowsOf(model, p.id).reference : undefined;
  const [step, setStep] = React.useState<Activity | null | undefined>(undefined);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    if (!flow || !r.activityId) { setStep(null); return; }
    activitiesOf(repo, flow.id).then(xs => { if (live) setStep(xs.find(a => a.id === r.activityId) || null); });
    return () => { live = false; };
  }, [flow?.id, r.activityId]);
  if (!p || !flow) return null;
  const gone = !!r.activityId && step !== undefined && (step === null || step.delta === DELTA.removed);
  return (
    <span data-emph="flow-link" style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
      <Button data-emph="flow-link-open" appearance="transparent" size="small" icon={<Flowchart16Regular />} style={{ padding: 0, minWidth: 0, textAlign: "left" }} onClick={() => { acts.delete(flow.id); setOpen(true); }}>
        {flowLinkText(p, step && !gone ? step.name : null)}
      </Button>
      {gone && <span data-emph="flow-link-gone" style={{ color: C.warn, fontSize: 12 }}>The step it was raised on is no longer in the flow.</span>}
      {open && <FlowStudio model={model} repo={repo} apply={apply} process={p} focus={step && !gone ? step.code : null} onClose={() => setOpen(false)} />}
    </span>
  );
}
