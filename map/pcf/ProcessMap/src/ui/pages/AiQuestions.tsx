// The question generator (AI) in a workshop's Prepare: for one business process, the next questions to ask, from
// Microsoft's flow and scenarios for it and what the organisation said already. The facilitator adds the useful ones to
// the workshop as open questions (RAID action items marked as a question). Suggestions from an AI: check them.
import * as React from "react";
import { Button, Radio, RadioGroup, Spinner } from "@fluentui/react-components";
import { Sparkle20Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Pick, Pill } from "../kit";
import { RAID, labelOf } from "../../domain/codes";
import { levelUp, isActive } from "../../domain/rules";
import { loadActivities } from "../../domain/repository";
import { questionInputs, checkQuestions, flowFor, SuggestedQuestion } from "../../domain/ai";
import { AI_MODELS, AI_MODEL_LABEL, AiModel, readModel, saveModel, promptOf, estimateRun, estimateText, PROMPT_CHARS, timeText } from "../../domain/aiModels";
import { questionsOf, MsTemplate } from "../../domain/workshop";
import type { Workshop, ProcessItem } from "../../domain/types";

export function AiQuestions({ model, repo, apply, w, processes, tpl }: PageProps & { w: Workshop; processes: ProcessItem[]; tpl: MsTemplate | null }) {
  const l = useLook();
  const [pid, setPid] = React.useState<string | null>(processes[0]?.id || null);
  const [choice, setChoice] = React.useState<AiModel>(readModel("questions"));
  const [busy, setBusy] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(Date.now());
  const [got, setGot] = React.useState<{ pid: string; questions: SuggestedQuestion[]; dropped: number } | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  React.useEffect(() => { if (!busy) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [busy]);
  const p = processes.find(x => x.id === pid) || null;
  if (!processes.length) return null;
  const asked = (x: ProcessItem) => questionsOf(tpl).map(q => q.text).concat(model.raids.filter(r => r.isQuestion && (r.itemId === x.id || r.workshopId === w.id)).map(r => r.description));
  const systems = (x: ProcessItem) => { const a = levelUp(model.items, x, 2); return model.systems.filter(s => s.itemId === x.id || (a && s.itemId === a.id)).map(s => s.name + (s.decision != null ? " (" + labelOf("systemDecision", s.decision) + ")" : "")); };
  const size = (m: AiModel) => estimateText(estimateRun([{ chars: PROMPT_CHARS.questions + 2500 + model.requirements.filter(r => isActive(r) && r.itemId === p?.id).length * 120 }], m));
  const run = async () => {
    if (!p) return;
    setProblem(null); setBusy(Date.now()); setGot(null);
    try {
      const f = flowFor(model, p.id);
      const acts = f ? await loadActivities(repo.g, f.id) : [];
      const inp = questionInputs(model, p, { activities: acts, asked: asked(p), systems: systems(p) });
      const prompt = promptOf(model.workspace.settings.aiPrompts, "questions", choice);
      const why = await repo.g.promptReady(prompt);
      if (why) throw new Error("The question generator can't run: " + why + ".");
      const r = await repo.g.predict(prompt, { Process: inp.Process, Catalog: inp.Catalog, Asked: inp.Asked, Known: inp.Known });
      if (r.ok === false) throw new Error(r.filtered ? "Microsoft's content filter blocked it." : r.message);
      const c = checkQuestions(r.output, inp);
      if (c.ok === false) throw new Error(c.message);
      setGot({ pid: p.id, questions: c.questions, dropped: c.dropped.length });
    } catch (e: any) { setProblem(e?.message || String(e)); }
    finally { setBusy(null); }
  };
  const est = estimateRun([{ chars: PROMPT_CHARS.questions + 2500 }], choice).seconds;
  return (
    <div data-emph="ai-questions-gen" style={{ display: "flex", flexDirection: "column", gap: 6, borderLeft: "3px solid " + C.railActive, paddingLeft: 10 }}>
      <div className={l.section} style={{ margin: 0 }}><Sparkle20Regular style={{ verticalAlign: "middle" }} /> Suggest questions (AI)</div>
      <div className={l.muted} style={{ fontSize: 12 }}>For one business process: the next questions to ask, from Microsoft's flow and scenarios for it and what is known already. They come from an AI: add only the ones worth asking.</div>
      <div className={l.row}>
        <Pick value={pid} items={processes.map(x => ({ id: x.id, name: x.code + " " + x.name }))} onChange={setPid} width={320} />
        <RadioGroup layout="horizontal" value={choice} onChange={(_, d) => { const m = d.value as AiModel; setChoice(m); saveModel("questions", m); }}>
          {AI_MODELS.map(m => <Radio key={m} value={m} label={AI_MODEL_LABEL[m] + ": " + size(m)} />)}
        </RadioGroup>
        <Button size="small" appearance="primary" data-emph="ai-questions-run" disabled={!p || !!busy} icon={busy ? <Spinner size="tiny" /> : undefined} onClick={run}>{busy ? "Asking… " + Math.round((now - busy) / 1000) + " s of " + timeText(est) : "Suggest questions"}</Button>
      </div>
      {problem && <div style={{ color: C.bad, fontSize: 12 }}>{problem}</div>}
      {got && got.pid === pid && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {got.questions.map((q, i) => {
            const raised = model.raids.some(r => r.isQuestion && r.description === q.text && r.workshopId === w.id);
            return (
              <div key={i} data-emph="ai-suggested-question" style={{ fontSize: 13, borderTop: "1px solid " + C.line, paddingTop: 4 }}>
                <div className={l.row} style={{ justifyContent: "space-between" }}>
                  <span>{q.text} <Pill text={q.confidence} tone={q.confidence === "high" ? "ok" : q.confidence === "low" ? "bad" : "warn"} /></span>
                  <Button size="small" disabled={raised} data-emph="ai-question-keep" onClick={() => apply(m => repo.addRaid(m, { type: RAID.action, isQuestion: true, description: q.text, itemId: got.pid, workshopId: w.id,
                    source: "AI question generator (accepted): " + q.why + (q.step ? " · step " + q.step : "") + (q.link ? " · " + q.link : "") }))}>{raised ? "Added" : "Add to the workshop"}</Button>
                </div>
                <div className={l.muted} style={{ fontSize: 12 }}>{q.why}{q.step && " · step " + q.step}{q.link && <> · <a href={q.link} target="_blank" rel="noreferrer">Microsoft Learn</a></>}{q.problems.length ? " · " + q.problems.join("; ") : ""}</div>
              </div>
            );
          })}
          {!got.questions.length && <div className={l.muted}>No new questions.</div>}
          {got.dropped > 0 && <div className={l.muted} style={{ fontSize: 11 }}>{got.dropped} left out (asked already, or more than 8).</div>}
        </div>
      )}
    </div>
  );
}
