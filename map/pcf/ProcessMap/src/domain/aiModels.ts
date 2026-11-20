// The AI Builder prompts EMPH calls, the model choice and the estimate shown before a run.
// Peter (2026-11-20): an AI Builder prompt in the customer's own Dataverse environment, called through Predict, as
// Business Map does. AI Builder fixes the model per prompt, so each job has one prompt per model: the person picks
// GPT-5 chat (fast) or GPT-5 reasoning (thinker) per run and sees the expected credits and time first. The prompt id
// (or its name) is kept in the workspace settings. No keys in the app: Predict runs as the signed-in user.
//
// The estimate is Business Map's, fitted to its lab runs of 2026-11-15 (two real workshops, GPT-5 chat and reasoning):
// a guide, not a quote. EMPH has never run a real model (slice 5): the numbers are not checked against EMPH's prompt.

export type AiModel = "chat" | "reasoning";
export const AI_MODELS: AiModel[] = ["chat", "reasoning"];
export const AI_MODEL_LABEL: Record<AiModel, string> = { chat: "GPT-5 chat (fast)", reasoning: "GPT-5 reasoning (thinker)" };
export type AiJob = "analyse" | "questions";
export const AI_JOB_LABEL: Record<AiJob, string> = { analyse: "Analyse (workshop and documents)", questions: "Question generator" };
/** The prompt names install.md tells you to create; the settings may hold another name or the prompt's id instead. */
export const PROMPT_NAMES: Record<AiJob, Record<AiModel, string>> = {
  analyse: { chat: "EMPH Analyse", reasoning: "EMPH Analyse (GPT-5 reasoning)" },
  questions: { chat: "EMPH Question suggest", reasoning: "EMPH Question suggest (GPT-5 reasoning)" },
};
/** The inputs each prompt declares in AI Builder, by name and type (map/schema/prompts/*.md say the same; a test checks). */
export const PROMPT_INPUTS: Record<AiJob, { name: string; type: "text" | "file" }[]> = {
  analyse: [{ name: "Context", type: "text" }, { name: "Transcript", type: "text" }, { name: "Documents", type: "text" }, { name: "Pictures", type: "file" }, { name: "Document", type: "file" }],
  questions: [{ name: "Process", type: "text" }, { name: "Catalog", type: "text" }, { name: "Asked", type: "text" }, { name: "Known", type: "text" }],
};
/** The prompt texts' own length in characters, sent on every call (map/schema/prompts). */
export const PROMPT_CHARS: Record<AiJob, number> = { analyse: 9000, questions: 3000 };
/** Microsoft's limit per call. A call estimated above WARN_SECONDS is flagged. */
export const MAX_CALL_SECONDS = 100, WARN_SECONDS = 85;

/** The prompt per job and model as kept in the workspace settings: an id (GUID) or a prompt name; empty = the default name. */
export type AiPromptSettings = Partial<Record<AiJob, Partial<Record<AiModel, string>>>>;
export const promptOf = (s: AiPromptSettings | undefined, job: AiJob, model: AiModel) => (s?.[job]?.[model] || "").trim() || PROMPT_NAMES[job][model];
export const isGuid = (s: string) => /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(s.trim());

/** What one call sends: characters of text (prompt and inputs), pictures, document pages. */
export interface CallSize { chars: number; pictures?: number; pages?: number }
export interface Estimate { credits: number; seconds: number; slowest: number; calls: number; overLimit: boolean }

/**
 * One call. Business Map's fit on GPT-5 chat: about 11 credits per 1,000 characters, 16 per picture, 5 per document page,
 * 10 per call; about 3 s + 0.5 s per 1,000 characters + 1 s per picture. GPT-5 reasoning measured 17 times the credits and
 * about 4.5 times the time.
 */
export function estimateCall(size: CallSize, model: AiModel): { credits: number; seconds: number } {
  const k = size.chars / 1000, pics = size.pictures || 0, pages = size.pages || 0;
  const credits = 10 + 11 * k + 16 * pics + 5 * pages, seconds = 3 + 0.5 * k + pics + 0.1 * pages;
  return model === "reasoning" ? { credits: credits * 17, seconds: seconds * 4.5 } : { credits, seconds };
}
/** A run of calls: the first `parallel` at once, the others after them. Credits add up; time is the longest stretch. */
export function estimateRun(calls: CallSize[], model: AiModel, parallel = 1): Estimate {
  const each = calls.map(c => estimateCall(c, model));
  const credits = each.reduce((a, b) => a + b.credits, 0);
  const firstWave = each.slice(0, parallel).reduce((a, b) => Math.max(a, b.seconds), 0);
  const rest = each.slice(parallel).reduce((a, b) => a + b.seconds, 0);
  const slowest = each.reduce((a, b) => Math.max(a, b.seconds), 0);
  return { credits: Math.round(credits), seconds: Math.round(firstWave + rest), slowest: Math.round(slowest), calls: calls.length, overLimit: slowest > WARN_SECONDS };
}
const round = (n: number) => (n >= 1000 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n));
export const timeText = (s: number) => (s >= 90 ? "about " + Math.round(s / 60) + " min" : "about " + Math.max(5, Math.round(s / 5) * 5) + " s");
/** "about 1,200 AI Builder credits, about 50 s · 2 calls", plus a warning when a call may pass the 100 s limit. */
export function estimateText(e: Estimate): string {
  return "about " + round(e.credits).toLocaleString("en-US") + " AI Builder credits, " + timeText(e.seconds) + (e.calls > 1 ? " · " + e.calls + " calls" : "") +
    (e.overLimit ? " · a call may pass Microsoft's " + MAX_CALL_SECONDS + " s limit: use GPT-5 chat, or fewer documents per run" : "");
}
/** Progress while a run goes: the share of the estimate used, never quite full until it is done. */
export const progressOf = (elapsed: number, estimate: number) => Math.min(0.95, estimate > 0 ? elapsed / estimate : 0);

/** The person's last choice per job, kept in this browser; chat when none. */
const KEY = (job: AiJob) => "emph.aimodel." + job;
export function readModel(job: AiJob): AiModel {
  try { const v = (globalThis as any).localStorage?.getItem(KEY(job)); return v === "reasoning" ? "reasoning" : "chat"; } catch { return "chat"; }
}
export function saveModel(job: AiJob, m: AiModel) { try { (globalThis as any).localStorage?.setItem(KEY(job), m); } catch { /* private mode */ } }
