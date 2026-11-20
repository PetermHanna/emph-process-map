// Loads the model from Dataverse and makes every write. Each write returns the updated model.
// Changes to Microsoft's fields on process items and requirements also write a row to emph_history (insert only).
import { Gateway, Row, ref } from "../data/api";
import {
  FLOW_TYPE, FLOW_STATE, DELTA, SHAPE, DECISION_STATE, REQ_ORIGIN, SIGNOFF, ITEM, SESSION, ANSWER, SCOPE, APPROVAL, AUTHOR, CATALOG_CUSTOM,
  HOW, RAID, RAID_STATUS, WORKSHOP_KIND, labelOf, ListName,
} from "./codes";
import {
  isActive, freeze, FrozenItem, titleOf, requirementProblem, flowDeltas, coveredBy, deltaText, touchedByHand, canApprove, nextOwnCode, starterActivities,
  inScope, childrenOf, ancestorsOf, descendantsOf, levelUp, fitGapProblem, scopeDecided,
} from "./rules";
import { newSession, readSession } from "./session";
import type { Model, ProcessItem, CurrentSystem, Role, ProcessFlow, Activity, ConfigDecision, Requirement, Raid, Workshop, SignOff, FlowLink, Screenshot, Comment } from "./types";

const txt = (v: unknown) => (v == null ? "" : String(v));
const json = <T>(v: unknown, fallback: T): T => { try { return v ? JSON.parse(String(v)) : fallback; } catch { return fallback; } };
const id = (v: unknown) => (v ? String(v) : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);
const day = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const byRank = <T extends { rank: number }>(a: T, b: T) => a.rank - b.rank;
const lines = (v: unknown) => txt(v).split("\n").map(x => x.trim()).filter(Boolean);
const optional = <T>(p: Promise<T[]>) => p.catch(() => [] as T[]);
const today = () => new Date().toISOString().slice(0, 10);

const COLS = {
  workspace: "emph_workspaceid,emph_organisation",
  item: "emph_processitemid,emph_name,emph_level,emph_catalogcode,emph_catalogname,emph_summary,emph_rank,emph_scope,emph_scopereason,emph_scopeapproach,emph_fitgapstatus,emph_gapsolutionapproach,"
    + "emph_fitgapreason,emph_businessprocessowner,emph_workstreamlead,emph_subjectmatterexpert,emph_baselinecomplexity,emph_priority,emph_processtype,emph_isown,emph_author,emph_catalogstatus,"
    + "emph_products,emph_sethow,emph_setby,emph_seton,emph_present,emph_workshopname,emph_accent,emph_comments,_emph_parent_value",
  system: "emph_systemid,emph_name,emph_vendor,emph_decision,emph_retireon,emph_users,emph_hosting,emph_note,_emph_item_value",
  role: "emph_roleid,emph_name,emph_summary,emph_rank,emph_headcount,emph_responsiblerole,emph_licencetype,emph_baseproduct,emph_attachproducts,emph_licencenote",
  itemRole: "emph_itemroleid,_emph_item_value,_emph_role_value",
  comment: "emph_commentid,emph_name,emph_activitycode,emph_author,emph_text,emph_source,createdon,_emph_item_value,_emph_flowactivity_value,_emph_workshop_value",
  flow: "emph_processflowid,emph_name,emph_flowtype,emph_state,emph_catalogcode,emph_sourcelink,emph_comments,_emph_item_value,_emph_referenceflow_value",
  decision: "emph_configdecisionid,emph_name,emph_code,emph_product,emph_answertype,emph_choices,emph_guidance,emph_menupath,emph_steps,emph_expected,emph_sourcelink,emph_sourcelabel,emph_rank,emph_answer,emph_state,emph_comments,_emph_item_value",
  requirement: "emph_requirementid,emph_reqid,emph_name,emph_description,emph_requirementtype,emph_fitgapstatus,emph_gapsolutionapproach,emph_scopeapproach,emph_acceptancecriteria,emph_requirementmapping,"
    + "emph_priority,emph_approvalstate,emph_author,emph_estimatedcomplexity,emph_owner,emph_approvedby,emph_approvedon,emph_closedreason,emph_sourcetype,emph_sourcetext,emph_raisedby,"
    + "emph_origin,emph_originref,emph_review,_emph_item_value,_emph_originflow_value,_emph_evidenceflow_value,_emph_workshop_value,_emph_flowactivity_value",
  raid: "emph_raidid,emph_name,emph_raidtype,emph_description,emph_owner,emph_priority,emph_targetdate,emph_status,emph_isquestion,emph_sourcetext,emph_resolution,emph_decisionmaker,createdon,_emph_item_value,_emph_workshop_value",
  workshop: "emph_workshopid,emph_name,emph_heldon,emph_facilitator,emph_participants,emph_minutes,emph_phase,emph_status,emph_sessiondata,emph_transcript,emph_microsoftworkshoptype,emph_sbdphase,"
    + "emph_kind,emph_sessionorder,emph_units,emph_childtasks,_emph_item_value",
  signOff: "emph_signoffid,emph_name,emph_version,emph_scopenote,emph_state,emph_approvedon,_emph_approver_value",
  activity: "emph_flowactivityid,emph_name,emph_activitycode,emph_shape,emph_lane,emph_stage,emph_links,emph_summary,emph_delta,emph_rationale,emph_rank,emph_x,emph_y,_emph_processflow_value",
};

export async function loadModel(g: Gateway): Promise<Model> {
  const q = (t: string, cols: string) => g.query(t, "?$select=" + cols);
  const [ws, it, sy, ro, ir, fl, dc, rq, ra, wk, so, cm] = await Promise.all([
    q("emph_workspace", COLS.workspace + "&$top=1"), q("emph_processitem", COLS.item), q("emph_system", COLS.system), q("emph_role", COLS.role), q("emph_itemrole", COLS.itemRole),
    optional(q("emph_processflow", COLS.flow)), optional(q("emph_configdecision", COLS.decision)), optional(q("emph_requirement", COLS.requirement)), optional(q("emph_raid", COLS.raid)),
    optional(q("emph_workshop", COLS.workshop)), optional(q("emph_signoff", COLS.signOff)), optional(q("emph_comment", COLS.comment)),
  ]);
  return {
    workspace: { id: id(ws[0]?.emph_workspaceid), organisation: txt(ws[0]?.emph_organisation) },
    items: it.map(itemFrom).sort((a, b) => a.level - b.level || a.rank - b.rank),
    systems: sy.map(r => ({ id: r.emph_systemid, itemId: id(r._emph_item_value), name: txt(r.emph_name), vendor: txt(r.emph_vendor), decision: num(r.emph_decision), retireOn: day(r.emph_retireon),
      users: txt(r.emph_users), hosting: txt(r.emph_hosting), note: txt(r.emph_note) })).sort((a, b) => a.name.localeCompare(b.name)),
    roles: ro.map(r => ({ id: r.emph_roleid, name: txt(r.emph_name), summary: txt(r.emph_summary), rank: r.emph_rank ?? 0, headcount: r.emph_headcount ?? null, responsibleRole: num(r.emph_responsiblerole),
      licenceType: num(r.emph_licencetype), baseProduct: num(r.emph_baseproduct), attachProducts: txt(r.emph_attachproducts), licenceNote: txt(r.emph_licencenote) })).sort(byRank),
    comments: cm.map(r => ({ id: r.emph_commentid, itemId: id(r._emph_item_value), activityId: id(r._emph_flowactivity_value), activityCode: txt(r.emph_activitycode),
      workshopId: id(r._emph_workshop_value), author: txt(r.emph_author), text: txt(r.emph_text), source: txt(r.emph_source), createdOn: r.createdon || "" })),
    itemRoles: ir.map(r => ({ id: r.emph_itemroleid, itemId: r._emph_item_value, roleId: r._emph_role_value })),
    flows: fl.map(r => ({ id: r.emph_processflowid, itemId: r._emph_item_value, name: txt(r.emph_name), type: r.emph_flowtype ?? FLOW_TYPE.reference, state: r.emph_state ?? FLOW_STATE.draft, code: txt(r.emph_catalogcode), sourceLink: txt(r.emph_sourcelink), comments: txt(r.emph_comments), referenceId: id(r._emph_referenceflow_value) })),
    decisions: dc.map(decisionFrom).sort(byRank),
    requirements: rq.map(requirementFrom),
    raids: ra.map(raidFrom).sort((a, b) => (a.createdOn || "").localeCompare(b.createdOn || "")),
    workshops: wk.map(r => ({ id: r.emph_workshopid, name: txt(r.emph_name), heldOn: day(r.emph_heldon), facilitator: txt(r.emph_facilitator), participants: txt(r.emph_participants), minutes: txt(r.emph_minutes),
      phase: Math.min(6, Math.max(0, r.emph_phase ?? 0)), status: r.emph_status ?? SESSION.open, itemId: id(r._emph_item_value), msType: num(r.emph_microsoftworkshoptype), sbdPhase: num(r.emph_sbdphase),
      kind: num(r.emph_kind), order: num(r.emph_sessionorder), units: txt(r.emph_units), childTasks: txt(r.emph_childtasks), session: readSession(r.emph_sessiondata), transcript: txt(r.emph_transcript) }))
      .sort((a, b) => (b.heldOn || "").localeCompare(a.heldOn || "")),
    signOffs: so.map(r => ({ id: r.emph_signoffid, name: txt(r.emph_name), version: r.emph_version ?? 0, scopeNote: txt(r.emph_scopenote), state: r.emph_state ?? SIGNOFF.draft, approver: txt(r["_emph_approver_value@OData.Community.Display.V1.FormattedValue"]), approvedOn: r.emph_approvedon || null }))
      .sort((a, b) => b.version - a.version),
  };
}

const itemFrom = (r: Row): ProcessItem => ({
  id: r.emph_processitemid, level: r.emph_level ?? 3, parentId: id(r._emph_parent_value), code: txt(r.emph_catalogcode), name: txt(r.emph_name), catalogName: txt(r.emph_catalogname), summary: txt(r.emph_summary),
  rank: r.emph_rank ?? 0, scope: num(r.emph_scope), scopeReason: txt(r.emph_scopereason), scopeApproach: txt(r.emph_scopeapproach),
  fitGap: num(r.emph_fitgapstatus), gapApproach: num(r.emph_gapsolutionapproach), fitGapReason: txt(r.emph_fitgapreason),
  owner: txt(r.emph_businessprocessowner), workstreamLead: txt(r.emph_workstreamlead), sme: txt(r.emph_subjectmatterexpert),
  complexity: num(r.emph_baselinecomplexity), priority: num(r.emph_priority), processType: num(r.emph_processtype), isOwn: !!r.emph_isown, author: num(r.emph_author), catalogStatus: num(r.emph_catalogstatus),
  products: txt(r.emph_products), setHow: num(r.emph_sethow), setBy: txt(r.emph_setby), setOn: day(r.emph_seton), present: txt(r.emph_present), workshopName: txt(r.emph_workshopname),
  accent: txt(r.emph_accent), comments: txt(r.emph_comments),
});
const itemColumns = (n: ProcessItem): Row => ({
  emph_name: n.name, emph_level: n.level, emph_catalogcode: n.code || null, emph_catalogname: n.catalogName || null, emph_summary: n.summary || null, emph_rank: n.rank,
  emph_scope: n.scope, emph_scopereason: n.scopeReason || null, emph_scopeapproach: n.scopeApproach || null, emph_fitgapstatus: n.fitGap, emph_gapsolutionapproach: n.gapApproach,
  emph_fitgapreason: n.fitGapReason || null, emph_businessprocessowner: n.owner || null, emph_workstreamlead: n.workstreamLead || null, emph_subjectmatterexpert: n.sme || null,
  emph_baselinecomplexity: n.complexity, emph_priority: n.priority, emph_processtype: n.processType, emph_isown: n.isOwn, emph_author: n.author, emph_catalogstatus: n.catalogStatus,
  emph_products: n.products || null, emph_sethow: n.setHow, emph_setby: n.setBy || null, emph_seton: n.setOn, emph_present: n.present || null, emph_workshopname: n.workshopName || null,
  emph_accent: n.accent || null, emph_comments: n.comments || null,
});
const decisionFrom = (r: Row): ConfigDecision => ({
  id: r.emph_configdecisionid, itemId: id(r._emph_item_value), product: txt(r.emph_product), code: txt(r.emph_code), question: txt(r.emph_name), answerType: r.emph_answertype ?? ANSWER.text,
  choices: lines(r.emph_choices), guidance: txt(r.emph_guidance), menuPath: txt(r.emph_menupath), steps: txt(r.emph_steps), expected: txt(r.emph_expected), sourceLink: txt(r.emph_sourcelink), sourceLabel: txt(r.emph_sourcelabel),
  rank: r.emph_rank ?? 0, answer: txt(r.emph_answer), state: r.emph_state ?? DECISION_STATE.open, comments: txt(r.emph_comments),
});
const requirementFrom = (r: Row): Requirement => ({
  id: r.emph_requirementid, reqId: txt(r.emph_reqid), name: txt(r.emph_name), description: txt(r.emph_description), itemId: id(r._emph_item_value),
  origin: r.emph_origin ?? REQ_ORIGIN.captured, originRef: txt(r.emph_originref), originFlowId: id(r._emph_originflow_value), review: !!r.emph_review,
  type: num(r.emph_requirementtype), fitGap: num(r.emph_fitgapstatus), gapApproach: num(r.emph_gapsolutionapproach), scopeApproach: txt(r.emph_scopeapproach), acceptanceCriteria: txt(r.emph_acceptancecriteria),
  mapping: txt(r.emph_requirementmapping), priority: num(r.emph_priority), approval: num(r.emph_approvalstate), author: num(r.emph_author), complexity: num(r.emph_estimatedcomplexity),
  owner: txt(r.emph_owner), approvedBy: txt(r.emph_approvedby), approvedOn: day(r.emph_approvedon), closedReason: txt(r.emph_closedreason),
  sourceType: txt(r.emph_sourcetype), sourceText: txt(r.emph_sourcetext), raisedBy: txt(r.emph_raisedby),
  workshopId: id(r._emph_workshop_value), evidenceFlowId: id(r._emph_evidenceflow_value), activityId: id(r._emph_flowactivity_value),
});
const requirementColumns = (r: Requirement): Row => ({
  emph_name: r.name, emph_description: r.description || null, emph_requirementtype: r.type, emph_fitgapstatus: r.fitGap, emph_gapsolutionapproach: r.gapApproach,
  emph_scopeapproach: r.scopeApproach || null, emph_acceptancecriteria: r.acceptanceCriteria || null, emph_requirementmapping: r.mapping || null, emph_priority: r.priority,
  emph_approvalstate: r.approval, emph_author: r.author, emph_estimatedcomplexity: r.complexity, emph_owner: r.owner || null, emph_approvedby: r.approvedBy || null, emph_approvedon: r.approvedOn,
  emph_closedreason: r.closedReason || null, emph_sourcetype: r.sourceType || null, emph_sourcetext: r.sourceText || null, emph_raisedby: r.raisedBy || null,
  emph_origin: r.origin, emph_originref: r.originRef || null, emph_review: r.review,
});
const raidFrom = (r: Row): Raid => ({
  id: r.emph_raidid, name: txt(r.emph_name), type: r.emph_raidtype ?? RAID.action, description: txt(r.emph_description), itemId: id(r._emph_item_value), workshopId: id(r._emph_workshop_value),
  owner: txt(r.emph_owner), priority: num(r.emph_priority), targetDate: day(r.emph_targetdate), status: r.emph_status ?? RAID_STATUS.open, isQuestion: !!r.emph_isquestion, source: txt(r.emph_sourcetext),
  resolution: txt(r.emph_resolution), decisionMaker: txt(r.emph_decisionmaker), createdOn: r.createdon || "",
});
const activityColumns = (a: Activity) => ({
  emph_name: (a.name || "Activity").slice(0, 300), emph_activitycode: a.code, emph_shape: a.shape, emph_lane: a.lane || null, emph_stage: a.stage || null,
  emph_links: JSON.stringify(a.links || []), emph_summary: a.summary || null, emph_delta: a.delta, emph_rationale: a.rationale || null, emph_rank: a.rank,
  emph_x: a.pos ? Math.round(a.pos.x) : null, emph_y: a.pos ? Math.round(a.pos.y) : null,
});

/** A blank item; `level` 1-4. */
export const blankItem = (p: Partial<ProcessItem> & { level: number }): ProcessItem => ({
  id: "", parentId: null, code: "", name: "", catalogName: "", summary: "", rank: 0, scope: SCOPE.unspecified, scopeReason: "", scopeApproach: "", fitGap: null, gapApproach: null, fitGapReason: "",
  owner: "", workstreamLead: "", sme: "", complexity: null, priority: null, processType: null, isOwn: false, author: null, catalogStatus: null, products: "",
  setHow: null, setBy: "", setOn: null, present: "", workshopName: "", accent: "", comments: "", ...p,
});
export const blankRequirement = (p: Partial<Requirement> = {}): Requirement => ({
  id: "", reqId: "", name: "", description: "", itemId: null, origin: REQ_ORIGIN.captured, originRef: "", originFlowId: null, review: false,
  type: null, fitGap: null, gapApproach: null, scopeApproach: "", acceptanceCriteria: "", mapping: "", priority: null, approval: APPROVAL.new, author: AUTHOR.project, complexity: null,
  owner: "", approvedBy: "", approvedOn: null, closedReason: "", sourceType: "", sourceText: "", raisedBy: "", workshopId: null, evidenceFlowId: null, ...p,
});

export async function loadActivities(g: Gateway, flowId: string): Promise<Activity[]> {
  const rows = await g.query("emph_flowactivity", "?$select=" + COLS.activity + "&$filter=_emph_processflow_value eq " + flowId);
  return rows.map(r => ({
    id: r.emph_flowactivityid, flowId, code: txt(r.emph_activitycode), name: txt(r.emph_name), shape: r.emph_shape ?? SHAPE.activity, lane: txt(r.emph_lane), stage: txt(r.emph_stage),
    links: json<FlowLink[]>(r.emph_links, []), summary: txt(r.emph_summary), delta: r.emph_delta ?? DELTA.same, rank: r.emph_rank ?? 0, rationale: txt(r.emph_rationale),
    pos: r.emph_x != null && r.emph_y != null ? { x: r.emph_x, y: r.emph_y } : null,
  })).sort(byRank);
}

/** Everything a sign-off freezes today. Confirmed flows are read for their activities. Scope: levels 1 to 3, and scenarios whose scope is decided. */
export async function signOffContents(g: Gateway, m: Model): Promise<FrozenItem[]> {
  const out: FrozenItem[] = [];
  m.requirements.filter(isActive).forEach(r => out.push({ type: ITEM.requirement, key: r.id, name: r.name, description: r.description, snapshot: { reqId: r.reqId, origin: r.origin, ...freeze(r) } }));
  for (const f of m.flows.filter(x => x.type === FLOW_TYPE.ours && x.state === FLOW_STATE.confirmed)) {
    const acts = await loadActivities(g, f.id);
    out.push({ type: ITEM.flow, key: f.id, name: f.name, description: "", snapshot: { activities: acts.map(a => ({ code: a.code, name: a.name, lane: a.lane, delta: a.delta, links: a.links, rationale: a.rationale || "" })) } });
  }
  const iname = (iid: string | null) => m.items.find(p => p.id === iid)?.name || "";
  m.decisions.filter(d => d.answer.trim()).forEach(d => out.push({ type: ITEM.decision, key: d.id, name: d.code, description: d.question, snapshot: { answer: d.answer, state: d.state, process: iname(d.itemId) } }));
  m.items.filter(p => p.level < 4 || scopeDecided(p.scope)).forEach(p => out.push({ type: ITEM.scope, key: p.id, name: p.name, description: "",
    snapshot: { code: p.code, level: p.level, parent: iname(p.parentId), scope: p.scope, inScope: inScope(m.items, p), fitGap: p.fitGap, gapApproach: p.gapApproach } }));
  return out;
}

export async function loadSignOffItems(g: Gateway, signOffId: string): Promise<FrozenItem[]> {
  const rows = await g.query("emph_signoffitem", "?$select=emph_itemtype,emph_itemkey,emph_name,emph_description,emph_snapshot&$filter=_emph_signoff_value eq " + signOffId);
  return rows.map(r => ({ type: r.emph_itemtype ?? ITEM.requirement, key: txt(r.emph_itemkey), name: txt(r.emph_name), description: txt(r.emph_description), snapshot: json(r.emph_snapshot, {}) }));
}

/** What "Back to the Microsoft reference" would remove or flag. */
export interface ResetPlan { generated: Requirement[]; touched: number; linked: Requirement[] }

/** How a change was made, for Set how / by / on and the history. */
export interface How { how: number; workshop?: string; present?: string }
const DIRECT: How = { how: HOW.direct };
// fields whose change is written to emph_history: [model field, column, list for labels]
const ITEM_HISTORY: [keyof ProcessItem, string, ListName | null][] = [["name", "emph_name", null], ["scope", "emph_scope", "scope"], ["fitGap", "emph_fitgapstatus", "fitGapStatus"],
  ["gapApproach", "emph_gapsolutionapproach", "gapSolutionApproach"], ["products", "emph_products", null], ["owner", "emph_businessprocessowner", null], ["scopeReason", "emph_scopereason", null], ["fitGapReason", "emph_fitgapreason", null]];
const REQ_HISTORY: [keyof Requirement, string, ListName | null][] = [["description", "emph_description", null], ["fitGap", "emph_fitgapstatus", "fitGapStatus"], ["gapApproach", "emph_gapsolutionapproach", "gapSolutionApproach"],
  ["priority", "emph_priority", "priority"], ["approval", "emph_approvalstate", "businessApprovalState"], ["itemId", "_emph_item_value", null]];

export class Repository {
  constructor(public g: Gateway, public user = "") {}

  private async unlink(table: string, rowId: string, nav: string) {
    try { await this.g.patch(table, rowId, { [nav + "@odata.bind"]: null }); } catch { /* already empty */ }
  }
  /** One emph_history row per changed field (labels for choices). A failed history write never stops the change. */
  private async history<T>(table: string, rowId: string, before: T, after: T, fields: [keyof T, string, ListName | null][], how: How) {
    const show = (v: unknown, list: ListName | null) => (v == null ? "" : list ? labelOf(list, v as number) || String(v) : String(v));
    for (const [f, column, list] of fields) {
      const a = show(before[f], list), b = show(after[f], list);
      if (a === b) continue;
      await this.g.insert("emph_history", { emph_name: (table + " " + column).slice(0, 200), emph_table: table, emph_rowid: rowId, emph_field: column, emph_oldvalue: a.slice(0, 2000) || null,
        emph_newvalue: b.slice(0, 2000) || null, emph_how: how.how, emph_by: this.user || null, emph_workshopname: how.workshop || null }).catch(() => undefined);
    }
  }

  // ---------- workspace ----------
  async setOrganisation(m: Model, organisation: string): Promise<Model> {
    if (m.workspace.id) await this.g.patch("emph_workspace", m.workspace.id, { emph_organisation: organisation || null });
    else m = { ...m, workspace: { ...m.workspace, id: await this.g.insert("emph_workspace", { emph_name: "EMPH Process Map", emph_organisation: organisation || null }) } };
    return { ...m, workspace: { ...m.workspace, organisation } };
  }

  // ---------- process items (levels 1 to 4) ----------
  /** Saves an item (a new one when it has no id). A Gap needs a solution approach. Scope and fit-gap changes record how, by whom and when. */
  async saveItem(m: Model, it: ProcessItem, patch: Partial<ProcessItem>, how: How = DIRECT): Promise<Model> {
    const n: ProcessItem = { ...it, ...patch };
    const problem = fitGapProblem(n);
    if (problem && (patch.fitGap !== undefined || patch.gapApproach !== undefined)) throw new Error(problem);
    if (n.scope !== it.scope || n.fitGap !== it.fitGap || n.gapApproach !== it.gapApproach) Object.assign(n, { setHow: how.how, setBy: this.user, setOn: today(), workshopName: how.workshop || "", present: how.present || "" });
    const data = itemColumns(n);
    if (!it.id) {
      if (n.parentId) data["emph_Parent@odata.bind"] = ref("emph_processitem", n.parentId);
      n.id = await this.g.insert("emph_processitem", data);
      return { ...m, items: m.items.concat(n) };
    }
    await this.g.patch("emph_processitem", it.id, data);
    await this.history("emph_processitem", it.id, it, n, ITEM_HISTORY, how);
    let model: Model = { ...m, items: m.items.map(x => (x.id === it.id ? n : x)) };
    if (n.scope !== it.scope) model = await this.flagOrigin(model, REQ_ORIGIN.scope, it.id);
    if (n.fitGap !== it.fitGap || n.gapApproach !== it.gapApproach || n.comments !== it.comments) model = await this.flagOrigin(model, REQ_ORIGIN.process, it.id);
    return model;
  }

  /**
   * In or out of scope, as on the map. Putting an item in scope brings its parents in too, and the scenarios below it whose
   * scope isn't decided yet. Taking it out leaves the items below as they are: they grey out with it.
   */
  async setScope(m: Model, it: ProcessItem, on: boolean, how: How = DIRECT): Promise<Model> {
    let model = await this.saveItem(m, it, { scope: on ? SCOPE.in : SCOPE.out }, how);
    if (!on) return model;
    for (const a of ancestorsOf(model.items, it)) if (a.scope !== SCOPE.in) model = await this.saveItem(model, a, { scope: SCOPE.in }, how);
    for (const s of descendantsOf(model.items, it.id).filter(x => x.level === 4 && !scopeDecided(x.scope))) model = await this.saveItem(model, s, { scope: SCOPE.in }, how);
    return model;
  }

  /** Our own item under `parentId` (level = the parent's + 1): an X-numbered code, Author Project, Catalog status 50 - Custom, in scope. */
  async addOwnItem(m: Model, parentId: string | null, name: string): Promise<{ model: Model; item: ProcessItem }> {
    const title = name.trim();
    if (!title) throw new Error("A process item needs a name.");
    const parent = m.items.find(x => x.id === parentId);
    const level = parent ? parent.level + 1 : 1;
    if (level > 4) throw new Error("Scenarios (level 4) are the lowest level.");
    const siblings = childrenOf(m.items, parentId);
    const it = blankItem({ level, parentId, code: nextOwnCode(m.items.map(x => x.code)), name: title, rank: Math.max(0, ...siblings.map(x => x.rank)) + 10, scope: SCOPE.in,
      isOwn: true, author: AUTHOR.project, catalogStatus: CATALOG_CUSTOM, accent: level === 1 ? "#0D9488" : "" });
    const model = await this.saveItem(m, it, {});
    return { model, item: model.items[model.items.length - 1] };
  }

  async deleteOwnItem(m: Model, it: ProcessItem): Promise<Model> {
    if (!it.isOwn) throw new Error("Only our own process items can be deleted. Set a catalog item out of scope instead.");
    const gone = [it, ...descendantsOf(m.items, it.id)];
    if (gone.some(x => !x.isOwn)) throw new Error("Catalog items sit under it. Set it out of scope instead.");
    const ids = new Set(gone.map(x => x.id));
    let model = m;
    for (const r of m.requirements.filter(x => x.itemId && ids.has(x.itemId) && !x.review)) model = await this.updateRequirement(model, r, { review: true });
    for (const x of gone.slice().reverse()) await this.g.drop("emph_processitem", x.id);
    return { ...model, items: model.items.filter(x => !ids.has(x.id)), flows: model.flows.filter(f => !ids.has(f.itemId)), itemRoles: model.itemRoles.filter(x => !ids.has(x.itemId)),
      systems: model.systems.map(s => (s.itemId && ids.has(s.itemId) ? { ...s, itemId: null } : s)),
      requirements: model.requirements.map(r => (r.itemId && ids.has(r.itemId) ? { ...r, itemId: null } : r)) };
  }

  async setItemRoles(m: Model, itemId: string, roleIds: string[]): Promise<Model> {
    let list = m.itemRoles;
    for (const x of list.filter(x => x.itemId === itemId && !roleIds.includes(x.roleId))) { await this.g.drop("emph_itemrole", x.id); list = list.filter(y => y !== x); }
    for (const rid of roleIds.filter(r => !list.some(x => x.itemId === itemId && x.roleId === r))) {
      const rowId = await this.g.insert("emph_itemrole", { emph_name: m.roles.find(r => r.id === rid)?.name || "Role", "emph_Item@odata.bind": ref("emph_processitem", itemId), "emph_Role@odata.bind": ref("emph_role", rid) });
      list = list.concat({ id: rowId, itemId, roleId: rid });
    }
    return { ...m, itemRoles: list };
  }

  // ---------- current systems and roles ----------
  async saveSystem(m: Model, s: CurrentSystem, patch: Partial<CurrentSystem>): Promise<Model> {
    const n = { ...s, ...patch };
    const data: Row = { emph_name: n.name, emph_vendor: n.vendor || null, emph_decision: n.decision, emph_retireon: n.retireOn, emph_users: n.users || null, emph_hosting: n.hosting || null, emph_note: n.note || null };
    if (n.itemId && (!s.id || n.itemId !== s.itemId)) data["emph_Item@odata.bind"] = ref("emph_processitem", n.itemId);
    if (!s.id) { n.id = await this.g.insert("emph_system", data); return { ...m, systems: m.systems.concat(n).sort((x, y) => x.name.localeCompare(y.name)) }; }
    await this.g.patch("emph_system", s.id, data);
    if (!n.itemId && s.itemId) await this.unlink("emph_system", s.id, "emph_Item");
    return { ...m, systems: m.systems.map(x => (x.id === s.id ? n : x)) };
  }
  async deleteSystem(m: Model, s: CurrentSystem): Promise<Model> {
    await this.g.drop("emph_system", s.id);
    return { ...m, systems: m.systems.filter(x => x.id !== s.id) };
  }
  async saveRole(m: Model, r: Role, patch: Partial<Role>): Promise<Model> {
    const n = { ...r, ...patch };
    const data = { emph_name: n.name, emph_summary: n.summary || null, emph_rank: n.rank, emph_headcount: n.headcount, emph_responsiblerole: n.responsibleRole ?? null, emph_licencetype: n.licenceType ?? null,
      emph_baseproduct: n.baseProduct ?? null, emph_attachproducts: n.attachProducts || null, emph_licencenote: n.licenceNote || null };
    if (!r.id) { n.id = await this.g.insert("emph_role", data); return { ...m, roles: m.roles.concat(n).sort(byRank) }; }
    await this.g.patch("emph_role", r.id, data);
    return { ...m, roles: m.roles.map(x => (x.id === r.id ? n : x)) };
  }
  async deleteRole(m: Model, r: Role): Promise<Model> {
    await this.g.drop("emph_role", r.id);
    return { ...m, roles: m.roles.filter(x => x.id !== r.id), itemRoles: m.itemRoles.filter(x => x.roleId !== r.id) };
  }

  // ---------- configuration decisions ----------
  async addDecision(m: Model, itemId: string | null, question: string, answerType: number): Promise<Model> {
    const text = question.trim();
    if (!text) throw new Error("A configuration decision needs a question.");
    const n = m.decisions.filter(d => /^CD-\d+$/.test(d.code)).map(d => Number(d.code.slice(3)));
    const code = "CD-" + String(Math.max(0, ...n) + 1).padStart(3, "0");
    const rank = Math.max(0, ...m.decisions.map(d => d.rank)) + 10;
    const data: Row = { emph_name: text.slice(0, 400), emph_code: code, emph_answertype: answerType, emph_rank: rank, emph_state: DECISION_STATE.open };
    if (itemId) data["emph_Item@odata.bind"] = ref("emph_processitem", itemId);
    const rowId = await this.g.insert("emph_configdecision", data);
    const d: ConfigDecision = { id: rowId, itemId, product: "", code, question: text, answerType, choices: [], guidance: "", menuPath: "", steps: "", expected: "", sourceLink: "", sourceLabel: "", rank, answer: "", state: DECISION_STATE.open, comments: "" };
    return { ...m, decisions: m.decisions.concat(d) };
  }
  async saveDecision(m: Model, d: ConfigDecision, patch: Partial<ConfigDecision>): Promise<Model> {
    const n = { ...d, ...patch };
    await this.g.patch("emph_configdecision", d.id, { emph_answer: n.answer || null, emph_state: n.state, emph_comments: n.comments || null, emph_name: n.question, emph_product: n.product || null });
    const model = { ...m, decisions: m.decisions.map(x => (x.id === d.id ? n : x)) };
    return n.answer !== d.answer ? this.flagOrigin(model, REQ_ORIGIN.decision, d.id) : model;
  }
  async deleteDecision(m: Model, d: ConfigDecision): Promise<Model> {
    await this.g.drop("emph_configdecision", d.id);
    return { ...m, decisions: m.decisions.filter(x => x.id !== d.id) };
  }

  // ---------- requirements ----------
  async addRequirement(m: Model, description: string, extra: Partial<Requirement> = {}): Promise<{ model: Model; requirement: Requirement }> {
    const r = blankRequirement({ name: titleOf(description), description: description.trim(), ...extra });
    const problem = requirementProblem(r);
    if (problem) throw new Error(problem);
    const data: Row = requirementColumns(r);
    if (r.itemId) data["emph_Item@odata.bind"] = ref("emph_processitem", r.itemId);
    if (r.workshopId) data["emph_Workshop@odata.bind"] = ref("emph_workshop", r.workshopId);
    if (r.activityId) data["emph_FlowActivity@odata.bind"] = ref("emph_flowactivity", r.activityId);
    if (r.originFlowId) data["emph_OriginFlow@odata.bind"] = ref("emph_processflow", r.originFlowId);
    r.id = await this.g.insert("emph_requirement", data);
    // Dataverse numbers it, so read the number back.
    const back = await this.g.query("emph_requirement", `?$select=emph_reqid&$filter=emph_requirementid eq ${r.id}`);
    r.reqId = txt(back[0]?.emph_reqid);
    return { model: { ...m, requirements: m.requirements.concat(r) }, requirement: r };
  }
  async updateRequirement(m: Model, r: Requirement, patch: Partial<Requirement>, how: How = DIRECT): Promise<Model> {
    const n = { ...r, ...patch };
    const problem = requirementProblem(n);
    if (problem) throw new Error(problem);
    n.description = n.description.trim();
    n.name = titleOf(n.description);
    if (n.approval === APPROVAL.approved && r.approval !== APPROVAL.approved) { n.approvedBy = n.approvedBy || this.user; n.approvedOn = n.approvedOn || today(); }
    const data: Row = requirementColumns(n);
    if (n.evidenceFlowId) data["emph_EvidenceFlow@odata.bind"] = ref("emph_processflow", n.evidenceFlowId);
    if (n.itemId && n.itemId !== r.itemId) data["emph_Item@odata.bind"] = ref("emph_processitem", n.itemId);
    await this.g.patch("emph_requirement", r.id, data);
    if (!n.evidenceFlowId && r.evidenceFlowId) await this.unlink("emph_requirement", r.id, "emph_EvidenceFlow");
    if (!n.itemId && r.itemId) await this.unlink("emph_requirement", r.id, "emph_Item");
    await this.history("emph_requirement", r.id, r, n, REQ_HISTORY, how);
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

  // ---------- RAID ----------
  /** A RAID item; a workshop's open points are Action items. */
  async addRaid(m: Model, p: Partial<Raid> & { description: string }): Promise<Model> {
    const text = p.description.trim();
    if (!text) throw new Error("A RAID item needs a description.");
    const r: Raid = { id: "", name: titleOf(text), type: RAID.action, itemId: null, workshopId: null, owner: "", priority: null, targetDate: null, status: RAID_STATUS.open, isQuestion: false, source: "",
      resolution: "", decisionMaker: "", createdOn: new Date().toISOString(), ...p, description: text };
    const data: Row = { emph_name: r.name, emph_raidtype: r.type, emph_description: r.description, emph_owner: r.owner || null, emph_priority: r.priority, emph_targetdate: r.targetDate,
      emph_status: r.status, emph_isquestion: r.isQuestion, emph_sourcetext: r.source || null };
    if (r.itemId) data["emph_Item@odata.bind"] = ref("emph_processitem", r.itemId);
    if (r.workshopId) data["emph_Workshop@odata.bind"] = ref("emph_workshop", r.workshopId);
    r.id = await this.g.insert("emph_raid", data);
    return { ...m, raids: m.raids.concat(r) };
  }
  async saveRaid(m: Model, r: Raid, patch: Partial<Raid>): Promise<Model> {
    const n = { ...r, ...patch };
    await this.g.patch("emph_raid", r.id, { emph_name: titleOf(n.description), emph_description: n.description, emph_owner: n.owner || null, emph_priority: n.priority, emph_targetdate: n.targetDate,
      emph_status: n.status, emph_isquestion: n.isQuestion, emph_resolution: n.resolution || null, emph_decisionmaker: n.decisionMaker || null });
    return { ...m, raids: m.raids.map(x => (x.id === r.id ? n : x)) };
  }
  async deleteRaid(m: Model, r: Raid): Promise<Model> {
    await this.g.drop("emph_raid", r.id);
    return { ...m, raids: m.raids.filter(x => x.id !== r.id) };
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
  async createOurFlow(m: Model, p: ProcessItem, reference: ProcessFlow | null, refActivities: Activity[]): Promise<{ model: Model; flow: ProcessFlow; activities: Activity[] }> {
    const data: Row = {
      emph_name: (p.code + " " + p.name + ": our process").slice(0, 300), emph_flowtype: FLOW_TYPE.ours, emph_state: FLOW_STATE.draft, emph_catalogcode: p.code || null,
      emph_sourcelink: reference?.sourceLink || null, "emph_Item@odata.bind": ref("emph_processitem", p.id),
    };
    if (reference) data["emph_ReferenceFlow@odata.bind"] = ref("emph_processflow", reference.id);
    const flowId = await this.g.insert("emph_processflow", data);
    const flow: ProcessFlow = { id: flowId, itemId: p.id, name: data.emph_name, type: FLOW_TYPE.ours, state: FLOW_STATE.draft, code: p.code, sourceLink: reference?.sourceLink || "", comments: "", referenceId: reference?.id || null };
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
      if (!ex) model = (await this.addRequirement(model, text, { itemId: f.itemId, origin: REQ_ORIGIN.flow, originRef: d.code, originFlowId: f.id, sourceType: "Process flow" })).model;
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
    let touched = 0;
    for (const r of generated) {
      const d = deltas.find(x => x.code === r.originRef);
      if (touchedByHand(r, d ? deltaText(d) : null)) touched++;
    }
    return { generated, touched, linked: m.requirements.filter(r => r.evidenceFlowId === f.id && !generated.includes(r)) };
  }

  /** Back to the Microsoft reference: generated requirements go with the flow; hand-captured ones stay, flagged. Sign-offs keep their own copies. */
  async resetFlow(m: Model, f: ProcessFlow, plan: ResetPlan): Promise<Model> {
    let model = m;
    for (const r of plan.linked) model = await this.updateRequirement(model, r, { review: true, evidenceFlowId: null, originRef: "" });
    for (const r of plan.generated) model = await this.deleteRequirement(model, r);
    await this.g.drop("emph_processflow", f.id);
    return { ...model, flows: model.flows.filter(x => x.id !== f.id) };
  }

  // ---------- workshops ----------
  /** A discovery workshop over the business processes (level 3) in scope, under one end-to-end process or all of them. */
  async addWorkshop(m: Model, endToEndId: string | null): Promise<{ model: Model; workshop: Workshop }> {
    const heldOn = today();
    const e2e = m.items.find(e => e.id === endToEndId);
    const name = ((e2e ? e2e.name + " " : "") + "workshop " + heldOn).slice(0, 200);
    const session = newSession(m.items.filter(p => p.level === 3 && inScope(m.items, p) && (!endToEndId || levelUp(m.items, p, 1)?.id === endToEndId)).map(p => p.id));
    const order = Math.max(0, ...m.workshops.map(w => w.order ?? 0)) + 1;
    const data: Row = { emph_name: name, emph_heldon: heldOn, emph_phase: 0, emph_status: SESSION.open, emph_sessiondata: JSON.stringify(session), emph_kind: WORKSHOP_KIND.discovery, emph_sessionorder: order };
    if (endToEndId) data["emph_Item@odata.bind"] = ref("emph_processitem", endToEndId);
    const workshop: Workshop = { id: await this.g.insert("emph_workshop", data), name, heldOn, facilitator: "", participants: "", minutes: "", phase: 0, status: SESSION.open, itemId: endToEndId,
      msType: null, sbdPhase: null, kind: WORKSHOP_KIND.discovery, order, units: "", childTasks: "", session, transcript: "" };
    return { model: { ...m, workshops: [workshop, ...m.workshops] }, workshop };
  }
  async saveWorkshop(m: Model, w: Workshop, patch: Partial<Workshop>): Promise<Model> {
    const n = { ...w, ...patch };
    await this.g.patch("emph_workshop", w.id, { emph_name: n.name, emph_heldon: n.heldOn, emph_facilitator: n.facilitator || null, emph_participants: n.participants || null, emph_minutes: n.minutes || null, emph_phase: n.phase,
      emph_status: n.status, emph_sessiondata: JSON.stringify(n.session), emph_microsoftworkshoptype: n.msType, emph_sbdphase: n.sbdPhase, emph_kind: n.kind, emph_sessionorder: n.order,
      emph_units: n.units || null, emph_childtasks: n.childTasks || null, ...("transcript" in patch ? { emph_transcript: n.transcript || null } : {}) });
    return { ...m, workshops: m.workshops.map(x => (x.id === w.id ? n : x)) };
  }
  // ---------- comments ----------
  async addComment(m: Model, c: Omit<Comment, "id" | "createdOn">): Promise<Model> {
    const data: Row = { emph_name: (c.text || "Comment").slice(0, 300), emph_activitycode: c.activityCode || null, emph_author: c.author || null, emph_text: c.text, emph_source: c.source || null };
    if (c.itemId) data["emph_Item@odata.bind"] = ref("emph_processitem", c.itemId);
    if (c.activityId) data["emph_FlowActivity@odata.bind"] = ref("emph_flowactivity", c.activityId);
    if (c.workshopId) data["emph_Workshop@odata.bind"] = ref("emph_workshop", c.workshopId);
    const n: Comment = { ...c, id: await this.g.insert("emph_comment", data), createdOn: new Date().toISOString() };
    return { ...m, comments: m.comments.concat(n) };
  }
  async deleteComment(m: Model, c: Comment): Promise<Model> {
    await this.g.drop("emph_comment", c.id);
    return { ...m, comments: m.comments.filter(x => x.id !== c.id) };
  }

  /** A screenshot taken during a workshop, kept as a note (annotation) on it. `jpeg` is base64 without the data: prefix. */
  async addScreenshot(w: Workshop, subject: string, jpeg: string): Promise<Screenshot> {
    const at = new Date().toISOString();
    const id = await this.g.insert("annotation", { subject: subject.slice(0, 500), filename: "screenshot-" + at.slice(0, 19).replace(/[:T]/g, "-") + ".jpg", mimetype: "image/jpeg",
      documentbody: jpeg, isdocument: true, "objectid_emph_workshop@odata.bind": ref("emph_workshop", w.id) });
    return { id, subject, createdOn: at };
  }
  async screenshots(w: Workshop): Promise<Screenshot[]> {
    const rows = await this.g.query("annotation", "?$select=annotationid,subject,createdon&$filter=_objectid_value eq " + w.id + "&$orderby=createdon desc");
    return rows.map(r => ({ id: r.annotationid, subject: txt(r.subject), createdOn: r.createdon || "" }));
  }
  async screenshotImage(id: string): Promise<string> {
    const rows = await this.g.query("annotation", "?$select=documentbody,mimetype&$filter=annotationid eq " + id);
    return rows[0] ? "data:" + (rows[0].mimetype || "image/jpeg") + ";base64," + rows[0].documentbody : "";
  }
  async deleteWorkshop(m: Model, w: Workshop): Promise<Model> {
    await this.g.drop("emph_workshop", w.id);
    return { ...m, workshops: m.workshops.filter(x => x.id !== w.id), requirements: m.requirements.map(r => (r.workshopId === w.id ? { ...r, workshopId: null } : r)),
      raids: m.raids.map(r => (r.workshopId === w.id ? { ...r, workshopId: null } : r)) };
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
export const itemsAt = (m: Model, level: number) => m.items.filter(x => x.level === level);
export const childItems = (m: Model, id: string | null) => childrenOf(m.items, id).sort(byRank);
export const rolesOf = (m: Model, itemId: string) => { const ids = new Set(m.itemRoles.filter(x => x.itemId === itemId).map(x => x.roleId)); return m.roles.filter(r => ids.has(r.id)); };
export const flowsOf = (m: Model, itemId: string) => ({
  reference: m.flows.find(f => f.itemId === itemId && f.type === FLOW_TYPE.reference),
  ours: m.flows.find(f => f.itemId === itemId && f.type === FLOW_TYPE.ours),
});
/** In scope: the item and every item above it are 20 - In scope. */
export const effectiveScope = (m: Model, it: ProcessItem) => inScope(m.items, it);
/** "80.20.010 Name" */
export const itemLabel = (it: ProcessItem | undefined) => (it ? (it.code ? it.code + " " : "") + it.name : "");
