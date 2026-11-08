// Loads the model from Dataverse and makes every write. Each write returns the updated model.
import { Gateway, Row, ref } from "../data/api";
import { ORIGIN, REVIEW, FLOW_TYPE, FLOW_STATE, DELTA, SHAPE, DECISION_STATE, REQ_STATE, REQ_ORIGIN, SIGNOFF, ITEM, SESSION, ANSWER } from "./codes";
import { isActive, freeze, FrozenItem, titleOf, requirementProblem, flowDeltas, coveredBy, deltaText, touchedByHand, canApprove, nextOwnCode, starterActivities } from "./rules";
import { newSession, readSession } from "./session";
import type { Model, EndToEnd, ProcessArea, BusinessProcess, Application, Role, ProcessFlow, Activity, ConfigDecision, Requirement, Workshop, SignOff, FlowLink } from "./types";

const txt = (v: unknown) => (v == null ? "" : String(v));
const json = <T>(v: unknown, fallback: T): T => { try { return v ? JSON.parse(String(v)) : fallback; } catch { return fallback; } };
const id = (v: unknown) => (v ? String(v) : null);
const byRank = <T extends { rank: number }>(a: T, b: T) => a.rank - b.rank;
const lines = (v: unknown) => txt(v).split("\n").map(x => x.trim()).filter(Boolean);
const optional = <T>(p: Promise<T[]>) => p.catch(() => [] as T[]);

const COLS = {
  workspace: "emph_workspaceid,emph_organisation",
  e2e: "emph_endtoendprocessid,emph_name,emph_catalogname,emph_catalogcode,emph_summary,emph_rank,emph_inscope,emph_accent",
  area: "emph_processareaid,emph_name,emph_catalogname,emph_catalogcode,emph_summary,emph_rank,emph_inscope,_emph_endtoendprocess_value",
  process: "emph_businessprocessid,emph_name,emph_catalogname,emph_catalogcode,emph_summary,emph_rank,emph_inscope,emph_origin,emph_reviewstate,emph_disposition,emph_usercount,emph_comments,_emph_processarea_value,_emph_currentapplication_value,_emph_targetapplication_value,_emph_processowner_value",
  app: "emph_applicationid,emph_name,emph_category,emph_publisher,emph_ismicrosoft,emph_istarget,emph_status,emph_hosting,emph_summary",
  role: "emph_roleid,emph_name,emph_summary,emph_rank,emph_headcount",
  processRole: "emph_processroleid,_emph_businessprocess_value,_emph_role_value",
  flow: "emph_processflowid,emph_name,emph_flowtype,emph_state,emph_catalogcode,emph_sourcelink,emph_comments,_emph_businessprocess_value,_emph_referenceflow_value",
  decision: "emph_configdecisionid,emph_name,emph_code,emph_answertype,emph_choices,emph_guidance,emph_menupath,emph_steps,emph_expected,emph_sourcelink,emph_sourcelabel,emph_rank,emph_answer,emph_state,emph_comments,_emph_businessprocess_value,_emph_application_value",
  requirement: "emph_requirementid,emph_reqid,emph_name,emph_description,emph_moscow,emph_category,emph_raisedby,emph_verbatim,emph_owner,emph_state,emph_coverage,emph_size,emph_resolution,emph_resolvedby,emph_resolvedon,emph_origin,emph_originref,emph_review,_emph_businessprocess_value,_emph_originflow_value,_emph_evidenceflow_value,_emph_workshop_value,_emph_parentrequirement_value,_emph_duplicateof_value",
  workshop: "emph_workshopid,emph_name,emph_heldon,emph_facilitator,emph_participants,emph_minutes,emph_phase,emph_status,emph_sessiondata,_emph_endtoendprocess_value",
  signOff: "emph_signoffid,emph_name,emph_version,emph_scopenote,emph_state,emph_approvedon,_emph_approver_value",
  activity: "emph_flowactivityid,emph_name,emph_activitycode,emph_shape,emph_lane,emph_stage,emph_links,emph_summary,emph_delta,emph_rationale,emph_rank,emph_x,emph_y,_emph_processflow_value",
};

export async function loadModel(g: Gateway): Promise<Model> {
  const q = (t: string, cols: string) => g.query(t, "?$select=" + cols);
  const [ws, e2e, ar, bp, ap, ro, pr, fl, dc, rq, wk, so] = await Promise.all([
    q("emph_workspace", COLS.workspace + "&$top=1"), q("emph_endtoendprocess", COLS.e2e), q("emph_processarea", COLS.area), q("emph_businessprocess", COLS.process),
    q("emph_application", COLS.app), q("emph_role", COLS.role), q("emph_processrole", COLS.processRole), optional(q("emph_processflow", COLS.flow)),
    optional(q("emph_configdecision", COLS.decision)), optional(q("emph_requirement", COLS.requirement)), optional(q("emph_workshop", COLS.workshop)), optional(q("emph_signoff", COLS.signOff)),
  ]);
  return {
    workspace: { id: id(ws[0]?.emph_workspaceid), organisation: txt(ws[0]?.emph_organisation) },
    endToEnds: e2e.map(r => ({ id: r.emph_endtoendprocessid, code: txt(r.emph_catalogcode), name: txt(r.emph_name), catalogName: txt(r.emph_catalogname), summary: txt(r.emph_summary), rank: r.emph_rank ?? 0, inScope: r.emph_inscope !== false, accent: txt(r.emph_accent) || "#0D9488" })).sort(byRank),
    areas: ar.map(r => ({ id: r.emph_processareaid, endToEndId: r._emph_endtoendprocess_value, code: txt(r.emph_catalogcode), name: txt(r.emph_name), catalogName: txt(r.emph_catalogname), summary: txt(r.emph_summary), rank: r.emph_rank ?? 0, inScope: r.emph_inscope !== false })).sort(byRank),
    processes: bp.map(processFrom).sort(byRank),
    apps: ap.map(r => ({ id: r.emph_applicationid, name: txt(r.emph_name), category: r.emph_category ?? null, publisher: txt(r.emph_publisher), microsoft: !!r.emph_ismicrosoft, target: !!r.emph_istarget, status: r.emph_status ?? null, hosting: txt(r.emph_hosting), summary: txt(r.emph_summary) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    roles: ro.map(r => ({ id: r.emph_roleid, name: txt(r.emph_name), summary: txt(r.emph_summary), rank: r.emph_rank ?? 0, headcount: r.emph_headcount ?? null })).sort(byRank),
    processRoles: pr.map(r => ({ id: r.emph_processroleid, processId: r._emph_businessprocess_value, roleId: r._emph_role_value })),
    flows: fl.map(r => ({ id: r.emph_processflowid, processId: r._emph_businessprocess_value, name: txt(r.emph_name), type: r.emph_flowtype ?? FLOW_TYPE.reference, state: r.emph_state ?? FLOW_STATE.draft, code: txt(r.emph_catalogcode), sourceLink: txt(r.emph_sourcelink), comments: txt(r.emph_comments), referenceId: id(r._emph_referenceflow_value) })),
    decisions: dc.map(decisionFrom).sort(byRank),
    requirements: rq.map(requirementFrom),
    workshops: wk.map(r => ({ id: r.emph_workshopid, name: txt(r.emph_name), heldOn: r.emph_heldon || null, facilitator: txt(r.emph_facilitator), participants: txt(r.emph_participants), minutes: txt(r.emph_minutes), phase: Math.min(6, Math.max(0, r.emph_phase ?? 0)), status: r.emph_status ?? SESSION.open, endToEndId: id(r._emph_endtoendprocess_value), session: readSession(r.emph_sessiondata) }))
      .sort((a, b) => (b.heldOn || "").localeCompare(a.heldOn || "")),
    signOffs: so.map(r => ({ id: r.emph_signoffid, name: txt(r.emph_name), version: r.emph_version ?? 0, scopeNote: txt(r.emph_scopenote), state: r.emph_state ?? SIGNOFF.draft, approver: txt(r["_emph_approver_value@OData.Community.Display.V1.FormattedValue"]), approvedOn: r.emph_approvedon || null }))
      .sort((a, b) => b.version - a.version),
  };
}

const processFrom = (r: Row): BusinessProcess => ({
  id: r.emph_businessprocessid, areaId: r._emph_processarea_value, code: txt(r.emph_catalogcode), name: txt(r.emph_name), catalogName: txt(r.emph_catalogname), summary: txt(r.emph_summary), rank: r.emph_rank ?? 0,
  inScope: r.emph_inscope !== false, origin: r.emph_origin ?? ORIGIN.catalog, review: r.emph_reviewstate ?? REVIEW.open, disposition: r.emph_disposition ?? null,
  currentAppId: id(r._emph_currentapplication_value), targetAppId: id(r._emph_targetapplication_value), ownerRoleId: id(r._emph_processowner_value), users: txt(r.emph_usercount), comments: txt(r.emph_comments),
});
const decisionFrom = (r: Row): ConfigDecision => ({
  id: r.emph_configdecisionid, processId: id(r._emph_businessprocess_value), appId: id(r._emph_application_value), code: txt(r.emph_code), question: txt(r.emph_name), answerType: r.emph_answertype ?? ANSWER.text,
  choices: lines(r.emph_choices), guidance: txt(r.emph_guidance), menuPath: txt(r.emph_menupath), steps: txt(r.emph_steps), expected: txt(r.emph_expected), sourceLink: txt(r.emph_sourcelink), sourceLabel: txt(r.emph_sourcelabel),
  rank: r.emph_rank ?? 0, answer: txt(r.emph_answer), state: r.emph_state ?? DECISION_STATE.open, comments: txt(r.emph_comments),
});
const requirementFrom = (r: Row): Requirement => ({
  id: r.emph_requirementid, reqId: txt(r.emph_reqid), name: txt(r.emph_name), description: txt(r.emph_description), processId: id(r._emph_businessprocess_value),
  origin: r.emph_origin ?? REQ_ORIGIN.captured, originRef: txt(r.emph_originref), originFlowId: id(r._emph_originflow_value), review: !!r.emph_review,
  moscow: r.emph_moscow ?? null, category: r.emph_category ?? null, raisedBy: txt(r.emph_raisedby), verbatim: txt(r.emph_verbatim), owner: txt(r.emph_owner), state: r.emph_state ?? null,
  coverage: r.emph_coverage ?? null, size: r.emph_size ?? null, evidenceFlowId: id(r._emph_evidenceflow_value), resolution: txt(r.emph_resolution), resolvedBy: txt(r.emph_resolvedby), resolvedOn: r.emph_resolvedon || null,
  workshopId: id(r._emph_workshop_value), parentId: id(r._emph_parentrequirement_value), duplicateOfId: id(r._emph_duplicateof_value),
});

export async function loadActivities(g: Gateway, flowId: string): Promise<Activity[]> {
  const rows = await g.query("emph_flowactivity", "?$select=" + COLS.activity + "&$filter=_emph_processflow_value eq " + flowId);
  return rows.map(r => ({
    id: r.emph_flowactivityid, flowId, code: txt(r.emph_activitycode), name: txt(r.emph_name), shape: r.emph_shape ?? SHAPE.activity, lane: txt(r.emph_lane), stage: txt(r.emph_stage),
    links: json<FlowLink[]>(r.emph_links, []), summary: txt(r.emph_summary), delta: r.emph_delta ?? DELTA.same, rank: r.emph_rank ?? 0, rationale: txt(r.emph_rationale),
    pos: r.emph_x != null && r.emph_y != null ? { x: r.emph_x, y: r.emph_y } : null,
  })).sort(byRank);
}

/** Everything a sign-off freezes today. Confirmed flows are read for their activities. */
export async function signOffContents(g: Gateway, m: Model): Promise<FrozenItem[]> {
  const out: FrozenItem[] = [];
  m.requirements.filter(isActive).forEach(r => out.push({ type: ITEM.requirement, key: r.id, name: r.name, description: r.description, snapshot: { reqId: r.reqId, origin: r.origin, ...freeze(r) } }));
  for (const f of m.flows.filter(x => x.type === FLOW_TYPE.ours && x.state === FLOW_STATE.confirmed)) {
    const acts = await loadActivities(g, f.id);
    out.push({ type: ITEM.flow, key: f.id, name: f.name, description: "", snapshot: { activities: acts.map(a => ({ code: a.code, name: a.name, lane: a.lane, delta: a.delta, links: a.links, rationale: a.rationale || "" })) } });
  }
  const pname = (pid: string | null) => m.processes.find(p => p.id === pid)?.name || "";
  m.decisions.filter(d => d.answer.trim()).forEach(d => out.push({ type: ITEM.decision, key: d.id, name: d.code, description: d.question, snapshot: { answer: d.answer, state: d.state, process: pname(d.processId) } }));
  m.processes.forEach(p => out.push({ type: ITEM.scope, key: p.id, name: p.name, description: "", snapshot: { code: p.code, area: m.areas.find(a => a.id === p.areaId)?.name || "", inScope: p.inScope } }));
  return out;
}

export async function loadSignOffItems(g: Gateway, signOffId: string): Promise<FrozenItem[]> {
  const rows = await g.query("emph_signoffitem", "?$select=emph_itemtype,emph_itemkey,emph_name,emph_description,emph_snapshot&$filter=_emph_signoff_value eq " + signOffId);
  return rows.map(r => ({ type: r.emph_itemtype ?? ITEM.requirement, key: txt(r.emph_itemkey), name: txt(r.emph_name), description: txt(r.emph_description), snapshot: json(r.emph_snapshot, {}) }));
}

/** What "Back to the Microsoft reference" would remove or flag. */
export interface ResetPlan { generated: Requirement[]; touched: number; testRuns: string[]; notes: string[]; linked: Requirement[] }

const requirementColumns = (r: Requirement) => ({
  emph_name: r.name, emph_description: r.description || null, emph_moscow: r.moscow, emph_category: r.category, emph_raisedby: r.raisedBy || null, emph_verbatim: r.verbatim || null,
  emph_owner: r.owner || null, emph_state: r.state, emph_coverage: r.coverage, emph_size: r.size, emph_resolution: r.resolution || null, emph_resolvedby: r.resolvedBy || null, emph_resolvedon: r.resolvedOn,
  emph_origin: r.origin, emph_originref: r.originRef || null, emph_review: r.review,
});
const activityColumns = (a: Activity) => ({
  emph_name: (a.name || "Activity").slice(0, 300), emph_activitycode: a.code, emph_shape: a.shape, emph_lane: a.lane || null, emph_stage: a.stage || null,
  emph_links: JSON.stringify(a.links || []), emph_summary: a.summary || null, emph_delta: a.delta, emph_rationale: a.rationale || null, emph_rank: a.rank,
  emph_x: a.pos ? Math.round(a.pos.x) : null, emph_y: a.pos ? Math.round(a.pos.y) : null,
});

export class Repository {
  constructor(public g: Gateway) {}

  private async unlink(table: string, rowId: string, nav: string) {
    try { await this.g.patch(table, rowId, { [nav + "@odata.bind"]: null }); } catch { /* already empty */ }
  }

  // ---------- workspace ----------
  async setOrganisation(m: Model, organisation: string): Promise<Model> {
    if (m.workspace.id) await this.g.patch("emph_workspace", m.workspace.id, { emph_organisation: organisation || null });
    else m = { ...m, workspace: { ...m.workspace, id: await this.g.insert("emph_workspace", { emph_name: "EMPH Process Map", emph_organisation: organisation || null }) } };
    return { ...m, workspace: { ...m.workspace, organisation } };
  }

  // ---------- catalog hierarchy ----------
  async saveEndToEnd(m: Model, e: EndToEnd, patch: Partial<EndToEnd>): Promise<Model> {
    const n = { ...e, ...patch };
    const data = { emph_name: n.name, emph_catalogname: n.catalogName || null, emph_catalogcode: n.code || null, emph_summary: n.summary || null, emph_rank: n.rank, emph_inscope: n.inScope, emph_accent: n.accent || null };
    if (!e.id) { n.id = await this.g.insert("emph_endtoendprocess", data); return { ...m, endToEnds: m.endToEnds.concat(n).sort(byRank) }; }
    await this.g.patch("emph_endtoendprocess", e.id, data);
    return { ...m, endToEnds: m.endToEnds.map(x => (x.id === e.id ? n : x)) };
  }

  async saveArea(m: Model, a: ProcessArea, patch: Partial<ProcessArea>): Promise<Model> {
    const n = { ...a, ...patch };
    const data: Row = { emph_name: n.name, emph_catalogname: n.catalogName || null, emph_catalogcode: n.code || null, emph_summary: n.summary || null, emph_rank: n.rank, emph_inscope: n.inScope };
    if (!a.id) {
      data["emph_EndToEndProcess@odata.bind"] = ref("emph_endtoendprocess", n.endToEndId);
      n.id = await this.g.insert("emph_processarea", data);
      return { ...m, areas: m.areas.concat(n).sort(byRank) };
    }
    await this.g.patch("emph_processarea", a.id, data);
    return { ...m, areas: m.areas.map(x => (x.id === a.id ? n : x)) };
  }

  /** Our own business process: an X-numbered code, apart from the Microsoft catalog's. */
  async addOwnProcess(m: Model, areaId: string, name: string): Promise<{ model: Model; process: BusinessProcess }> {
    const title = name.trim();
    if (!title) throw new Error("A business process needs a name.");
    const p: BusinessProcess = {
      id: "", areaId, code: nextOwnCode(m.processes.map(x => x.code)), name: title, catalogName: "", summary: "", rank: Math.max(0, ...m.processes.filter(x => x.areaId === areaId).map(x => x.rank)) + 10,
      inScope: true, origin: ORIGIN.own, review: REVIEW.open, disposition: null, currentAppId: null, targetAppId: null, ownerRoleId: null, users: "", comments: "",
    };
    const model = await this.saveProcess(m, p, {});
    return { model, process: model.processes[model.processes.length - 1] };
  }

  async saveProcess(m: Model, p: BusinessProcess, patch: Partial<BusinessProcess>): Promise<Model> {
    const n = { ...p, ...patch };
    const data: Row = {
      emph_name: n.name, emph_catalogname: n.catalogName || null, emph_catalogcode: n.code || null, emph_summary: n.summary || null, emph_rank: n.rank, emph_inscope: n.inScope, emph_origin: n.origin,
      emph_reviewstate: n.review, emph_disposition: n.disposition, emph_usercount: n.users || null, emph_comments: n.comments || null,
    };
    const lookups: [keyof BusinessProcess, string, string][] = [["currentAppId", "emph_CurrentApplication", "emph_application"], ["targetAppId", "emph_TargetApplication", "emph_application"], ["ownerRoleId", "emph_ProcessOwner", "emph_role"]];
    for (const [k, nav, t] of lookups) if (n[k]) data[nav + "@odata.bind"] = ref(t, n[k] as string);
    if (!p.id) {
      data["emph_ProcessArea@odata.bind"] = ref("emph_processarea", n.areaId);
      n.id = await this.g.insert("emph_businessprocess", data);
      return { ...m, processes: m.processes.concat(n) };
    }
    await this.g.patch("emph_businessprocess", p.id, data);
    for (const [k, nav] of lookups) if (!n[k] && p[k]) await this.unlink("emph_businessprocess", p.id, nav);
    let model: Model = { ...m, processes: m.processes.map(x => (x.id === p.id ? n : x)) };
    if (n.inScope !== p.inScope) model = await this.flagOrigin(model, REQ_ORIGIN.scope, p.id);
    if (n.disposition !== p.disposition || n.comments !== p.comments) model = await this.flagOrigin(model, REQ_ORIGIN.process, p.id);
    return model;
  }

  async deleteOwnProcess(m: Model, p: BusinessProcess): Promise<Model> {
    if (p.origin !== ORIGIN.own) throw new Error("Only our own business processes can be deleted. Set a catalog process out of scope instead.");
    let model = m;
    for (const r of m.requirements.filter(x => x.processId === p.id && !x.review)) model = await this.updateRequirement(model, r, { review: true });
    await this.g.drop("emph_businessprocess", p.id);
    return { ...model, processes: model.processes.filter(x => x.id !== p.id), flows: model.flows.filter(f => f.processId !== p.id), processRoles: model.processRoles.filter(x => x.processId !== p.id),
      requirements: model.requirements.map(r => (r.processId === p.id ? { ...r, processId: null } : r)) };
  }

  async setProcessRoles(m: Model, processId: string, roleIds: string[]): Promise<Model> {
    let list = m.processRoles;
    for (const x of list.filter(x => x.processId === processId && !roleIds.includes(x.roleId))) { await this.g.drop("emph_processrole", x.id); list = list.filter(y => y !== x); }
    for (const rid of roleIds.filter(r => !list.some(x => x.processId === processId && x.roleId === r))) {
      const rowId = await this.g.insert("emph_processrole", { emph_name: m.roles.find(r => r.id === rid)?.name || "Role", "emph_BusinessProcess@odata.bind": ref("emph_businessprocess", processId), "emph_Role@odata.bind": ref("emph_role", rid) });
      list = list.concat({ id: rowId, processId, roleId: rid });
    }
    return { ...m, processRoles: list };
  }

  // ---------- applications and roles ----------
  async saveApp(m: Model, a: Application, patch: Partial<Application>): Promise<Model> {
    const n = { ...a, ...patch };
    const data = { emph_name: n.name, emph_category: n.category, emph_publisher: n.publisher || null, emph_ismicrosoft: n.microsoft, emph_istarget: n.target, emph_status: n.status, emph_hosting: n.hosting || null, emph_summary: n.summary || null };
    if (!a.id) { n.id = await this.g.insert("emph_application", data); return { ...m, apps: m.apps.concat(n).sort((x, y) => x.name.localeCompare(y.name)) }; }
    await this.g.patch("emph_application", a.id, data);
    return { ...m, apps: m.apps.map(x => (x.id === a.id ? n : x)) };
  }
  async deleteApp(m: Model, a: Application): Promise<Model> {
    await this.g.drop("emph_application", a.id);
    const clear = (v: string | null) => (v === a.id ? null : v);
    return { ...m, apps: m.apps.filter(x => x.id !== a.id), processes: m.processes.map(p => ({ ...p, currentAppId: clear(p.currentAppId), targetAppId: clear(p.targetAppId) })) };
  }
  async saveRole(m: Model, r: Role, patch: Partial<Role>): Promise<Model> {
    const n = { ...r, ...patch };
    const data = { emph_name: n.name, emph_summary: n.summary || null, emph_rank: n.rank, emph_headcount: n.headcount };
    if (!r.id) { n.id = await this.g.insert("emph_role", data); return { ...m, roles: m.roles.concat(n).sort(byRank) }; }
    await this.g.patch("emph_role", r.id, data);
    return { ...m, roles: m.roles.map(x => (x.id === r.id ? n : x)) };
  }
  async deleteRole(m: Model, r: Role): Promise<Model> {
    await this.g.drop("emph_role", r.id);
    return { ...m, roles: m.roles.filter(x => x.id !== r.id), processRoles: m.processRoles.filter(x => x.roleId !== r.id), processes: m.processes.map(p => (p.ownerRoleId === r.id ? { ...p, ownerRoleId: null } : p)) };
  }

  // ---------- configuration decisions ----------
  async addDecision(m: Model, processId: string | null, question: string, answerType: number): Promise<Model> {
    const text = question.trim();
    if (!text) throw new Error("A configuration decision needs a question.");
    const n = m.decisions.filter(d => /^CD-\d+$/.test(d.code)).map(d => Number(d.code.slice(3)));
    const code = "CD-" + String(Math.max(0, ...n) + 1).padStart(3, "0");
    const rank = Math.max(0, ...m.decisions.map(d => d.rank)) + 10;
    const data: Row = { emph_name: text.slice(0, 400), emph_code: code, emph_answertype: answerType, emph_rank: rank, emph_state: DECISION_STATE.open };
    if (processId) data["emph_BusinessProcess@odata.bind"] = ref("emph_businessprocess", processId);
    const rowId = await this.g.insert("emph_configdecision", data);
    const d: ConfigDecision = { id: rowId, processId, appId: null, code, question: text, answerType, choices: [], guidance: "", menuPath: "", steps: "", expected: "", sourceLink: "", sourceLabel: "", rank, answer: "", state: DECISION_STATE.open, comments: "" };
    return { ...m, decisions: m.decisions.concat(d) };
  }
  async saveDecision(m: Model, d: ConfigDecision, patch: Partial<ConfigDecision>): Promise<Model> {
    const n = { ...d, ...patch };
    await this.g.patch("emph_configdecision", d.id, { emph_answer: n.answer || null, emph_state: n.state, emph_comments: n.comments || null, emph_name: n.question });
    const model = { ...m, decisions: m.decisions.map(x => (x.id === d.id ? n : x)) };
    return n.answer !== d.answer ? this.flagOrigin(model, REQ_ORIGIN.decision, d.id) : model;
  }
  async deleteDecision(m: Model, d: ConfigDecision): Promise<Model> {
    await this.g.drop("emph_configdecision", d.id);
    return { ...m, decisions: m.decisions.filter(x => x.id !== d.id) };
  }

  // ---------- requirements ----------
  async addRequirement(m: Model, description: string, extra: Partial<Requirement> = {}): Promise<{ model: Model; requirement: Requirement }> {
    const problem = requirementProblem({ description });
    if (problem) throw new Error(problem);
    const r: Requirement = {
      id: "", reqId: "", name: titleOf(description), description: description.trim(), processId: null, origin: REQ_ORIGIN.captured, originRef: "", originFlowId: null, review: false,
      moscow: null, category: null, raisedBy: "", verbatim: "", owner: "", state: REQ_STATE.draft, coverage: null, size: null, evidenceFlowId: null, resolution: "", resolvedBy: "", resolvedOn: null,
      workshopId: null, parentId: null, duplicateOfId: null, ...extra,
    };
    const data: Row = requirementColumns(r);
    if (r.processId) data["emph_BusinessProcess@odata.bind"] = ref("emph_businessprocess", r.processId);
    if (r.workshopId) data["emph_Workshop@odata.bind"] = ref("emph_workshop", r.workshopId);
    if (r.originFlowId) data["emph_OriginFlow@odata.bind"] = ref("emph_processflow", r.originFlowId);
    r.id = await this.g.insert("emph_requirement", data);
    // Dataverse numbers it, so read the number back.
    const back = await this.g.query("emph_requirement", `?$select=emph_reqid&$filter=emph_requirementid eq ${r.id}`);
    r.reqId = txt(back[0]?.emph_reqid);
    return { model: { ...m, requirements: m.requirements.concat(r) }, requirement: r };
  }
  async updateRequirement(m: Model, r: Requirement, patch: Partial<Requirement>): Promise<Model> {
    const n = { ...r, ...patch };
    const problem = requirementProblem(n);
    if (problem) throw new Error(problem);
    n.description = n.description.trim();
    n.name = titleOf(n.description);
    const data: Row = requirementColumns(n);
    if (n.evidenceFlowId) data["emph_EvidenceFlow@odata.bind"] = ref("emph_processflow", n.evidenceFlowId);
    if (n.processId && n.processId !== r.processId) data["emph_BusinessProcess@odata.bind"] = ref("emph_businessprocess", n.processId);
    await this.g.patch("emph_requirement", r.id, data);
    if (!n.evidenceFlowId && r.evidenceFlowId) await this.unlink("emph_requirement", r.id, "emph_EvidenceFlow");
    if (!n.processId && r.processId) await this.unlink("emph_requirement", r.id, "emph_BusinessProcess");
    return { ...m, requirements: m.requirements.map(x => (x.id === r.id ? n : x)) };
  }
  async deleteRequirement(m: Model, r: Requirement): Promise<Model> {
    await this.g.drop("emph_requirement", r.id);
    return { ...m, requirements: m.requirements.filter(x => x.id !== r.id) };
  }
  /** What a requirement came from has changed: mark it for review. */
  private async flagOrigin(m: Model, origin: number, originRef: string): Promise<Model> {
    let model = m;
    for (const r of m.requirements.filter(x => x.origin === origin && x.originRef === originRef && !x.review)) model = await this.updateRequirement(model, r, { review: true });
    return model;
  }

  // ---------- flows ----------
  async saveActivity(a: Activity): Promise<Activity> {
    const data: Row = activityColumns(a);
    if (!a.id) { data["emph_ProcessFlow@odata.bind"] = ref("emph_processflow", a.flowId); return { ...a, id: await this.g.insert("emph_flowactivity", data) }; }
    await this.g.patch("emph_flowactivity", a.id, data);
    return a;
  }
  async dropActivity(a: Activity) { if (a.id) await this.g.drop("emph_flowactivity", a.id); }

  /** Our process: a copy of the Microsoft reference, or a blank flow when there is none. */
  async createOurFlow(m: Model, p: BusinessProcess, reference: ProcessFlow | null, refActivities: Activity[]): Promise<{ model: Model; flow: ProcessFlow; activities: Activity[] }> {
    const data: Row = {
      emph_name: (p.code + " " + p.name + ": our process").slice(0, 300), emph_flowtype: FLOW_TYPE.ours, emph_state: FLOW_STATE.draft, emph_catalogcode: p.code || null,
      emph_sourcelink: reference?.sourceLink || null, "emph_BusinessProcess@odata.bind": ref("emph_businessprocess", p.id),
    };
    if (reference) data["emph_ReferenceFlow@odata.bind"] = ref("emph_processflow", reference.id);
    const flowId = await this.g.insert("emph_processflow", data);
    const flow: ProcessFlow = { id: flowId, processId: p.id, name: data.emph_name, type: FLOW_TYPE.ours, state: FLOW_STATE.draft, code: p.code, sourceLink: reference?.sourceLink || "", comments: "", referenceId: reference?.id || null };
    const source: Activity[] = reference ? refActivities : starterActivities(m.roles[0]?.name || "").map(s => ({ id: "", flowId, code: s.code, name: s.name, shape: s.shape, lane: s.lane, stage: "", links: s.links, summary: "", delta: reference ? DELTA.same : DELTA.added, rank: s.rank }));
    const activities: Activity[] = [];
    for (const a of source) activities.push(await this.saveActivity({ ...a, id: "", flowId, delta: reference ? DELTA.same : a.delta }));
    return { model: { ...m, flows: m.flows.concat(flow) }, flow, activities };
  }

  async setFlowState(m: Model, f: ProcessFlow, state: number): Promise<Model> {
    await this.g.patch("emph_processflow", f.id, { emph_state: state });
    return { ...m, flows: m.flows.map(x => (x.id === f.id ? { ...x, state } : x)) };
  }

  /**
   * Confirm our process. Each real change needs a rationale or a linked requirement. Rationales become draft
   * requirements; confirming again refreshes untouched ones and flags those whose change has gone.
   */
  async confirmFlow(m: Model, f: ProcessFlow, ours: Activity[], reference: Activity[], links: Record<string, string>): Promise<Model> {
    const deltas = f.referenceId ? flowDeltas(ours, reference) : [];
    const missing = deltas.filter(d => !d.rationale.trim() && !links[d.code]);
    if (missing.length) throw new Error("Give a rationale or link a requirement for: " + missing.map(d => d.name).join(", "));
    let model = m;
    const linked = Object.values(links).filter(Boolean);
    for (const r of model.requirements.filter(x => x.origin === REQ_ORIGIN.captured && (linked.includes(x.id) || (x.evidenceFlowId === f.id && !!x.originRef)))) {
      const originRef = coveredBy(deltas, links, r.id);
      const evidenceFlowId = originRef ? f.id : null;
      if (originRef !== r.originRef || evidenceFlowId !== r.evidenceFlowId) model = await this.updateRequirement(model, r, { originRef, evidenceFlowId });
    }
    for (const d of deltas) {
      if (links[d.code]) continue;
      const text = deltaText(d);
      const ex = model.requirements.find(r => r.origin === REQ_ORIGIN.flow && r.originFlowId === f.id && r.originRef === d.code);
      if (!ex) model = (await this.addRequirement(model, text, { processId: f.processId, origin: REQ_ORIGIN.flow, originRef: d.code, originFlowId: f.id })).model;
      else if (ex.description !== text) model = await this.updateRequirement(model, ex, touchedByHand(ex, null) ? { review: true } : { description: text });
    }
    const codes = new Set(deltas.map(d => d.code));
    for (const r of model.requirements.filter(x => x.origin === REQ_ORIGIN.flow && x.originFlowId === f.id && !codes.has(x.originRef) && !x.review))
      model = await this.updateRequirement(model, r, { review: true });
    return this.setFlowState(model, f, FLOW_STATE.confirmed);
  }

  async resetPlan(m: Model, f: ProcessFlow, ours: Activity[], reference: Activity[]): Promise<ResetPlan> {
    const generated = m.requirements.filter(r => r.origin === REQ_ORIGIN.flow && r.originFlowId === f.id);
    const deltas = flowDeltas(ours, reference);
    const testRuns: string[] = [], notes: string[] = [];
    let touched = 0;
    for (const r of generated) {
      testRuns.push(...(await this.g.query("emph_testrun", "?$select=emph_testrunid&$filter=_emph_requirement_value eq " + r.id)).map(x => x.emph_testrunid));
      notes.push(...(await this.g.query("emph_reviewnote", "?$select=emph_reviewnoteid&$filter=_emph_requirement_value eq " + r.id)).map(x => x.emph_reviewnoteid));
      const d = deltas.find(x => x.code === r.originRef);
      if (touchedByHand(r, d ? deltaText(d) : null)) touched++;
    }
    return { generated, touched, testRuns, notes, linked: m.requirements.filter(r => r.evidenceFlowId === f.id && !generated.includes(r)) };
  }

  /** Back to the Microsoft reference: generated requirements go with the flow; hand-captured ones stay, flagged. Sign-offs keep their own copies. */
  async resetFlow(m: Model, f: ProcessFlow, plan: ResetPlan): Promise<Model> {
    let model = m;
    for (const r of plan.linked) model = await this.updateRequirement(model, r, { review: true, evidenceFlowId: null, originRef: "" });
    for (const x of plan.testRuns) await this.g.drop("emph_testrun", x);
    for (const x of plan.notes) await this.g.drop("emph_reviewnote", x);
    for (const r of plan.generated) model = await this.deleteRequirement(model, r);
    await this.g.drop("emph_processflow", f.id);
    return { ...model, flows: model.flows.filter(x => x.id !== f.id) };
  }

  // ---------- workshops ----------
  async addWorkshop(m: Model, endToEndId: string | null): Promise<{ model: Model; workshop: Workshop }> {
    const heldOn = new Date().toISOString().slice(0, 10);
    const e2e = m.endToEnds.find(e => e.id === endToEndId);
    const name = ((e2e ? e2e.name + " " : "") + "workshop " + heldOn).slice(0, 200);
    const areaIds = new Set(m.areas.filter(a => !endToEndId || a.endToEndId === endToEndId).map(a => a.id));
    const session = newSession(m.processes.filter(p => p.inScope && areaIds.has(p.areaId)).map(p => p.id));
    const data: Row = { emph_name: name, emph_heldon: heldOn, emph_phase: 0, emph_status: SESSION.open, emph_sessiondata: JSON.stringify(session) };
    if (endToEndId) data["emph_EndToEndProcess@odata.bind"] = ref("emph_endtoendprocess", endToEndId);
    const workshop: Workshop = { id: await this.g.insert("emph_workshop", data), name, heldOn, facilitator: "", participants: "", minutes: "", phase: 0, status: SESSION.open, endToEndId, session };
    return { model: { ...m, workshops: [workshop, ...m.workshops] }, workshop };
  }
  async saveWorkshop(m: Model, w: Workshop, patch: Partial<Workshop>): Promise<Model> {
    const n = { ...w, ...patch };
    await this.g.patch("emph_workshop", w.id, { emph_heldon: n.heldOn, emph_facilitator: n.facilitator || null, emph_participants: n.participants || null, emph_minutes: n.minutes || null, emph_phase: n.phase, emph_status: n.status, emph_sessiondata: JSON.stringify(n.session) });
    return { ...m, workshops: m.workshops.map(x => (x.id === w.id ? n : x)) };
  }
  async deleteWorkshop(m: Model, w: Workshop): Promise<Model> {
    await this.g.drop("emph_workshop", w.id);
    return { ...m, workshops: m.workshops.filter(x => x.id !== w.id), requirements: m.requirements.map(r => (r.workshopId === w.id ? { ...r, workshopId: null } : r)) };
  }

  // ---------- sign-off ----------
  /** Freeze today's contents as a new sign-off in review. If it can't finish, nothing half-made stays. */
  async freeze(m: Model, scopeNote: string): Promise<Model> {
    const items = await signOffContents(this.g, m);
    const version = Math.max(0, ...m.signOffs.map(s => s.version)) + 1;
    const name = ((m.workspace.organisation || "Process") + " sign-off v" + version).slice(0, 200);
    const so = await this.g.insert("emph_signoff", { emph_name: name, emph_version: version, emph_scopenote: scopeNote || null, emph_state: SIGNOFF.review });
    const made: string[] = [];
    try {
      for (const it of items) made.push(await this.g.insert("emph_signoffitem", {
        emph_name: (it.name || "Item").slice(0, 200), emph_itemtype: it.type, emph_itemkey: it.key, emph_description: it.description || null, emph_snapshot: JSON.stringify(it.snapshot),
        emph_reqid: it.type === ITEM.requirement ? it.snapshot.reqId || null : null, "emph_SignOff@odata.bind": ref("emph_signoff", so),
        ...(it.type === ITEM.requirement ? { "emph_Requirement@odata.bind": ref("emph_requirement", it.key) } : {}),
      }));
    } catch (e) {
      for (const x of made) await this.g.drop("emph_signoffitem", x).catch(() => undefined);
      await this.g.drop("emph_signoff", so).catch(() => undefined);
      throw e;
    }
    const s: SignOff = { id: so, name, version, scopeNote, state: SIGNOFF.review, approver: "", approvedOn: null };
    return { ...m, signOffs: [s, ...m.signOffs] };
  }
  async approve(m: Model, s: SignOff, userId: string | null, userName: string): Promise<Model> {
    if (!canApprove(s, m.signOffs)) throw new Error("Only a sign-off in review, with no newer approved one, can be approved.");
    const approvedOn = new Date().toISOString();
    const data: Row = { emph_state: SIGNOFF.approved, emph_approvedon: approvedOn };
    if (userId) data["emph_Approver@odata.bind"] = "/systemusers(" + userId.replace(/[{}]/g, "") + ")";
    await this.g.patch("emph_signoff", s.id, data);
    const older = m.signOffs.filter(x => x.state === SIGNOFF.approved);
    for (const o of older) await this.g.patch("emph_signoff", o.id, { emph_state: SIGNOFF.superseded });
    return { ...m, signOffs: m.signOffs.map(x => (x.id === s.id ? { ...x, state: SIGNOFF.approved, approvedOn, approver: userName } : older.includes(x) ? { ...x, state: SIGNOFF.superseded } : x)) };
  }
  async discard(m: Model, s: SignOff): Promise<Model> {
    if (s.state === SIGNOFF.approved || s.state === SIGNOFF.superseded) throw new Error("An approved sign-off can't be discarded.");
    for (const r of await this.g.query("emph_signoffitem", "?$select=emph_signoffitemid&$filter=_emph_signoff_value eq " + s.id)) await this.g.drop("emph_signoffitem", r.emph_signoffitemid);
    await this.g.drop("emph_signoff", s.id);
    return { ...m, signOffs: m.signOffs.filter(x => x.id !== s.id) };
  }
}

// ---------- read helpers ----------
export const areasOf = (m: Model, e2eId: string) => m.areas.filter(a => a.endToEndId === e2eId);
export const processesOf = (m: Model, areaId: string) => m.processes.filter(p => p.areaId === areaId);
export const rolesOf = (m: Model, processId: string) => { const ids = new Set(m.processRoles.filter(x => x.processId === processId).map(x => x.roleId)); return m.roles.filter(r => ids.has(r.id)); };
export const flowsOf = (m: Model, processId: string) => ({
  reference: m.flows.find(f => f.processId === processId && f.type === FLOW_TYPE.reference),
  ours: m.flows.find(f => f.processId === processId && f.type === FLOW_TYPE.ours),
});
export const endToEndOf = (m: Model, p: BusinessProcess) => { const a = m.areas.find(x => x.id === p.areaId); return { area: a, e2e: a ? m.endToEnds.find(e => e.id === a.endToEndId) : undefined }; };
/** A process counts as in scope only if its area and end-to-end process are too. */
export const effectiveScope = (m: Model, p: BusinessProcess) => { const { area, e2e } = endToEndOf(m, p); return p.inScope && (area?.inScope ?? true) && (e2e?.inScope ?? true); };
