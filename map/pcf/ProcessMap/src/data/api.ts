// Dataverse access. The app only talks to Gateway, so the in-memory test page can stand in for Dataverse.
export type Row = Record<string, any>;

/** The answer of an AI Builder prompt: its output (JSON text or an object), or why it failed (filtered: Microsoft's content filter). */
export type PredictResult = { ok: true; output: any; seconds: number } | { ok: false; filtered: boolean; message: string };

export interface Gateway {
  query(table: string, options: string): Promise<Row[]>;
  insert(table: string, data: Row): Promise<string>;
  patch(table: string, id: string, data: Row): Promise<void>;
  drop(table: string, id: string): Promise<void>;
  /** null when the AI Builder prompt (its id, or its name) can be called, else the reason in plain words */
  promptReady(prompt: string): Promise<string | null>;
  /** Runs an AI Builder prompt through Predict with its inputs (text, or file inputs as { mimeType, base64Encoded }) */
  predict(prompt: string, inputs: Record<string, any>): Promise<PredictResult>;
}

type Fetch = (url: string, init?: any) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
const HEADERS = { "Content-Type": "application/json", Accept: "application/json", "OData-MaxVersion": "4.0", "OData-Version": "4.0" };
/** Microsoft's reference marks `source` "for internal use only"; without it Predict answers "Source is null" (Business Map, P1). */
export const PREDICT_SOURCE = JSON.stringify({ consumptionSource: "PowerApps", partnerSource: "AIBuilder", consumptionSourceVersion: "PowerFx" });
const readJson = (t: string): any => { try { return JSON.parse(t); } catch { return null; } };
const GUID = /^\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?$/i;

/**
 * Predict on an AI Builder prompt (msdyn_aimodel) as the signed-in user, from the model-driven app's own origin, as
 * Business Map does: POST msdyn_aimodels(<id>)/Microsoft.Dynamics.CRM.Predict with version 2.0 and the inputs in
 * requestv2. A prompt given by name is looked up once. A long call may answer 202 with a location to poll.
 */
export class PromptCaller {
  private ids = new Map<string, Promise<{ id: string | null; reason: string | null }>>();
  constructor(private fetchFn: Fetch, private base = "", private wait = (ms: number) => new Promise(r => setTimeout(r, ms))) {}
  private find(prompt: string) {
    const key = prompt.trim();
    let p = this.ids.get(key);
    if (!p) {
      p = (async () => {
        const g = GUID.exec(key);
        if (g) return { id: g[1], reason: null };
        try {
          const r = await this.fetchFn(this.base + "/api/data/v9.2/msdyn_aimodels?$select=msdyn_aimodelid&$filter=" + encodeURIComponent("msdyn_name eq '" + key.replace(/'/g, "''") + "'"), { headers: HEADERS });
          if (!r.ok) return { id: null, reason: r.status === 404 ? "AI Builder is not available in this environment" : "the prompt list can't be read (HTTP " + r.status + ")" };
          const id = readJson(await r.text())?.value?.[0]?.msdyn_aimodelid;
          return id ? { id, reason: null } : { id: null, reason: "the prompt \"" + key + "\" is not set up in this environment (see install.md, AI prompts)" };
        } catch { return { id: null, reason: "the prompt list can't be reached" }; }
      })();
      this.ids.set(key, p);
      p.then(x => { if (!x.id) this.ids.delete(key); });
    }
    return p;
  }
  async ready(prompt: string) { return (await this.find(prompt)).reason; }
  async predict(prompt: string, inputs: Record<string, any>): Promise<PredictResult> {
    const { id, reason } = await this.find(prompt);
    if (!id) return { ok: false, filtered: false, message: reason || "no prompt" };
    const t0 = Date.now();
    const body = { version: "2.0", source: PREDICT_SOURCE, requestv2: { "@odata.type": "#Microsoft.Dynamics.CRM.expando", ...inputs } };
    try {
      let r = await this.fetchFn(this.base + "/api/data/v9.2/msdyn_aimodels(" + id + ")/Microsoft.Dynamics.CRM.Predict", { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
      let raw = await r.text(), j = readJson(raw), polls = 0;
      while (j && j.overrideHttpStatusCode && j.overrideLocation && polls++ < 40) {
        await this.wait(3000);
        r = await this.fetchFn(j.overrideLocation, { headers: { Accept: "application/json" } }); raw = await r.text(); j = readJson(raw);
      }
      if (!r.ok) return { ok: false, filtered: /InputContentFiltered|content filter|filtered/i.test(raw), message: String((j && j.error && j.error.message) || raw.slice(0, 300)) };
      const po = j && j.responsev2 && j.responsev2.predictionOutput;
      if (!po) return { ok: false, filtered: false, message: "the answer had no prediction output" };
      return { ok: true, output: po.structuredOutput ?? po.text, seconds: Math.round((Date.now() - t0) / 100) / 10 };
    } catch (e: any) { return { ok: false, filtered: false, message: "the call failed: " + (e && e.message ? e.message : String(e)) }; }
  }
}

/** The organisation's URL when the app runs in a model-driven app; "" (the page's own origin) otherwise. */
const clientUrl = () => { try { return String((globalThis as any).Xrm?.Utility?.getGlobalContext?.()?.getClientUrl?.() || ""); } catch { return ""; } };

export class DataverseGateway implements Gateway {
  private ai: PromptCaller;
  constructor(private web: ComponentFramework.WebApi, fetchFn: Fetch = (u, i) => (globalThis as any).fetch(u, { credentials: "same-origin", ...i })) {
    this.ai = new PromptCaller(fetchFn, clientUrl());
  }
  async query(table: string, options: string): Promise<Row[]> {
    let page = await this.web.retrieveMultipleRecords(table, options, 5000);
    let rows: Row[] = page.entities;
    while (page.nextLink) {
      page = await this.web.retrieveMultipleRecords(table, page.nextLink.substring(page.nextLink.indexOf("?")), 5000);
      rows = rows.concat(page.entities);
    }
    return rows;
  }
  async insert(table: string, data: Row): Promise<string> { return (await this.web.createRecord(table, data)).id as unknown as string; }
  async patch(table: string, id: string, data: Row): Promise<void> { await this.web.updateRecord(table, id, data); }
  async drop(table: string, id: string): Promise<void> { await this.web.deleteRecord(table, id); }
  promptReady(prompt: string) { return this.ai.ready(prompt); }
  predict(prompt: string, inputs: Record<string, any>) { return this.ai.predict(prompt, inputs); }
}

/** Entity set names, used for lookup binding. */
export const SETS: Record<string, string> = {
  emph_workspace: "emph_workspaces", emph_processitem: "emph_processitems", emph_system: "emph_systems", emph_role: "emph_roles", emph_itemrole: "emph_itemroles",
  emph_processflow: "emph_processflows", emph_flowactivity: "emph_flowactivities", emph_configdecision: "emph_configdecisions",
  emph_requirement: "emph_requirements", emph_raid: "emph_raids", emph_history: "emph_histories", emph_proposal: "emph_proposals",
  emph_workshop: "emph_workshops", emph_signoff: "emph_signoffs", emph_signoffitem: "emph_signoffitems",
  annotation: "annotations", emph_comment: "emph_comments",
};
export const ref = (table: string, id: string) => "/" + SETS[table] + "(" + id + ")";
