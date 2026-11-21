// The AI analysis of a workshop (its Analyse step) or of documents alone (Draft from documents): what goes, documents to
// add, the model with credits and time shown first, progress while it runs, then the review. The answers come from an AI:
// nothing changes until a person accepts a suggestion.
import * as React from "react";
import { Button, Radio, RadioGroup, Spinner } from "@fluentui/react-components";
import { Attach16Regular, Delete16Regular, Sparkle20Regular } from "@fluentui/react-icons";
import { C, useLook } from "../look";
import { PageProps, Meter, Pick } from "../kit";
import { AI_MODELS, AiModel, readModel, saveModel, progressOf, promptOf, timeText } from "../../domain/aiModels";
import { FILE_ACCEPT } from "../../domain/aiFiles";
import { runText, RunDocument } from "../../domain/ai";
import type { Workshop, Screenshot, AiRun } from "../../domain/types";
import { gather, plan, estimateOf, estimateLine, readUpload, runAnalysis, RunInputs } from "../aiRun";
import { AiReview } from "./AiReview";

export function AiAnalyse({ model, repo, apply, w, shots }: PageProps & { w: Workshop | null; shots: Screenshot[] }) {
  const l = useLook();
  const [docs, setDocs] = React.useState<RunDocument[]>([]);
  const [refused, setRefused] = React.useState<string[]>([]);
  const [choice, setChoice] = React.useState<AiModel>(readModel("analyse"));
  const [inputs, setInputs] = React.useState<RunInputs | null>(null);
  const [ready, setReady] = React.useState<string | null | undefined>(undefined);
  const [running, setRunning] = React.useState<{ since: number; text: string; estimate: number } | null>(null);
  const [now, setNow] = React.useState(Date.now());
  const [problem, setProblem] = React.useState<string | null>(null);
  const runs: AiRun[] = (w ? w.session.ai : model.workspace.settings.aiRuns) || [];
  const [shown, setShown] = React.useState<string | null>(null);
  const run = runs.find(r => r.run === shown) || runs[0] || null;
  const prompt = promptOf(model.workspace.settings.aiPrompts, "analyse", choice);
  React.useEffect(() => { let live = true; setReady(undefined); repo.g.promptReady(prompt).then(r => live && setReady(r)).catch(e => live && setReady(String(e?.message || e))); return () => { live = false; }; }, [prompt]);
  React.useEffect(() => { let live = true; gather(repo, model, w, shots, docs).then(x => live && setInputs(x)).catch(() => live && setInputs(null)); return () => { live = false; }; }, [w?.id, w?.transcript, w?.drawings, shots.length, docs]);
  React.useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [running]);
  const calls = inputs ? plan(inputs) : [];
  const spoken = inputs ? inputs.lines.filter(x => x.kind === "spoken").length : 0, seen = inputs ? inputs.lines.length - spoken : 0;
  const nothing = !spoken && !seen && !docs.length;
  const add = async (files: FileList | null) => {
    const ok: RunDocument[] = [], no: string[] = [];
    for (const f of Array.from(files || [])) { const r = await readUpload(f); if (r.ok === true) ok.push(r.doc); else no.push(f.name + ": " + (r as { why: string }).why); }
    setDocs(d => d.concat(ok)); setRefused(no);
  };
  const go = async () => {
    if (!inputs) return;
    setProblem(null);
    const est = estimateOf(calls, docs, choice);
    setRunning({ since: Date.now(), text: "Starting", estimate: est.seconds });
    try {
      const fresh = await gather(repo, model, w ? model.workshops.find(x => x.id === w.id) || w : null, shots, docs);
      const done = await runAnalysis(repo, apply, fresh, choice, p => setRunning(r => (r ? { ...r, text: p.text + (p.calls > 1 ? " · call " + p.call + " of " + p.calls : "") } : r)));
      setShown(done.run);
    } catch (e: any) { setProblem(e?.message || String(e)); }
    finally { setRunning(null); }
  };
  const elapsed = running ? Math.round((now - running.since) / 1000) : 0;
  return (
    <div data-emph="ai-analyse" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className={l.section} style={{ margin: 0 }}><Sparkle20Regular style={{ verticalAlign: "middle" }} /> {w ? "AI analysis of this workshop" : "Draft from documents (AI)"}</div>
      <div style={{ fontSize: 12, background: "#FFF8E1", border: "1px solid #F3D27A", borderRadius: 6, padding: "6px 10px" }} data-emph="ai-warning">
        The suggestions come from an AI (an AI Builder prompt in this environment). They can be wrong or incomplete. Nothing changes until you accept one: check each against its quote.
      </div>
      <div style={{ fontSize: 13 }} data-emph="ai-sources">
        {w ? <>Sends {spoken} transcript lines, {seen} screenshot and drawing lines at their moment{inputs && inputs.processIds.length ? ", the flows of " + inputs.processIds.length + " business processes" : ""}{docs.length ? " and " + docs.length + " documents" : ""}, with today's map.</>
          : <>Reads the documents you add here, with today's map. There is no workshop.</>}
      </div>
      <div className={l.row} data-emph="ai-docs">
        <label style={{ cursor: "pointer" }}>
          <input type="file" multiple accept={FILE_ACCEPT} style={{ display: "none" }} data-emph="ai-file" onChange={e => { add(e.target.files); e.target.value = ""; }} />
          <span className={l.row} style={{ fontSize: 13, color: C.railActive }}><Attach16Regular /> Add documents (PDF, pictures, Word, PowerPoint, Excel, text)</span>
        </label>
        {docs.map((d, i) => (
          <span key={i} className={l.row} style={{ fontSize: 12, border: "1px solid " + C.line, borderRadius: 6, padding: "1px 6px" }} data-emph="ai-doc">
            {d.name} <span className={l.muted}>({d.note})</span>
            <Button size="small" appearance="subtle" icon={<Delete16Regular />} aria-label="Remove" onClick={() => setDocs(x => x.filter((_, k) => k !== i))} />
          </span>
        ))}
      </div>
      {refused.length > 0 && <div style={{ color: C.bad, fontSize: 12 }}>{refused.join(" · ")}</div>}
      <RadioGroup value={choice} onChange={(_, d) => { const m = d.value as AiModel; setChoice(m); saveModel("analyse", m); }} data-emph="ai-model">
        {AI_MODELS.map(m => <Radio key={m} value={m} label={calls.length ? estimateLine(calls, docs, m) : m} data-emph={"ai-model-" + m} />)}
      </RadioGroup>
      <div className={l.row}>
        <Button appearance="primary" icon={running ? <Spinner size="tiny" /> : <Sparkle20Regular />} data-emph="ai-run" disabled={!!running || nothing || !inputs || !!ready || ready === undefined} onClick={go}>
          {running ? "Analysing…" : "Analyse with AI"}
        </Button>
        {ready && <span style={{ color: C.warn, fontSize: 12 }} data-emph="ai-not-ready">Not available: {ready}. Settings › AI prompts names the prompt.</span>}
        {nothing && !ready && <span className={l.muted} style={{ fontSize: 12 }}>{w ? "Paste a transcript, take a screenshot, draw on a flow or add a document first." : "Add a document first."}</span>}
      </div>
      {running && (
        <div data-emph="ai-progress" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 12 }}>{running.text} · {elapsed} s of {timeText(running.estimate)}</span>
          <Meter part={Math.round(progressOf(elapsed, running.estimate) * 100)} whole={100} />
        </div>
      )}
      {problem && <div style={{ color: C.bad }} data-emph="ai-problem">{problem}</div>}
      {run && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid " + C.line, paddingTop: 8 }}>
          <div className={l.row} style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 12 }} data-emph="ai-run-text"><b>{new Date(run.at).toLocaleString()}</b> · {run.model} · {run.seconds} s · {runText(run)}</span>
            {runs.length > 1 && <Pick value={run.run} items={runs.map(r => ({ id: r.run, name: new Date(r.at).toLocaleString() + " · " + r.proposals + " suggestions" }))} onChange={id => setShown(id)} width={280} />}
          </div>
          {run.calls.filter(c => !c.ok).map((c, i) => <div key={i} style={{ color: C.warn, fontSize: 12 }}>The {c.name} call failed: {c.error}.</div>)}
          <AiReview model={model} repo={repo} apply={apply} run={run} />
        </div>
      )}
    </div>
  );
}
