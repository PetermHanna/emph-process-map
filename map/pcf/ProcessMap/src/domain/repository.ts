// Loads the model from Dataverse and makes every write. Each write returns the updated model.
// Changes to Microsoft's fields on process items and requirements also write a row to emph_history (insert only).
import { Gateway, Row, ref } from "../data/api";
import {
  FLOW_TYPE, FLOW_STATE, DELTA, SHAPE, DECISION_STATE, REQ_ORIGIN, SIGNOFF, ITEM, SESSION, ANSWER, SCOPE, APPROVAL, AUTHOR, CATALOG_CUSTOM,
  HOW, RAID, RAID_STATUS, PRODUCT_OTHER, LICENCE, PROPOSAL, FIT_GAP, labelOf, option,
} from "./codes";
import {
  isActive, freeze, FrozenItem, titleOf, requirementProblem, flowDeltas, coveredBy, deltaText, touchedByHand, canApprove, nextOwnCode, ownCode, ownItemProblem, OWN_RULE, starterActivities,
  inScope, childrenOf, ancestorsOf, descendantsOf, levelUp, fitGapProblem, scopeDecided, scopeProblem, fitGapLevel, isOff, HISTORY_FIELDS, HistoryField, historyText,
  restorePatch, raidProblem, raidStart, changeRequestFor, Difference, nextActivityCode,
} from "./rules";
import { newSession, readSession } from "./session";
import { WorkshopKindName, MsTemplate, kindValue, emptyRun, newAgenda, childTasksOf, WORKSHOP_TYPE_OF_KIND, SBD_PHASE_OF_KIND, Change, Written, beforeOf, RunState, ChildTask } from "./workshop";
import type { Model, ProcessItem, CurrentSystem, Role, ProcessFlow, Activity, ConfigDecision, Requirement, Raid, Workshop, SignOff, FlowLink, Screenshot, Comment, HistoryRow, WorkspaceSettings, Proposal, ProposalDetails, AiEvidence, AiRun } from "./types";
import { ProposalDraft, fitValue, approachValue, priorityValue, reqTypeValue, licenceValue, headcountValue, systemDecisionValue, raidOf } from "./ai";

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
  workspace: "emph_workspaceid,emph_organisation,emph_settings",
  item: "emph_processitemid,emph_name,emph_level,emph_catalogcode,emph_catalogname,emph_summary,emph_rank,emph_scope,emph_scopereason,emph_scopeapproach,emph_fitgapstatus,emph_gapsolutionapproach,"
    + "emph_fitgapreason,emph_businessprocessowner,emph_workstreamlead,emph_subjectmatterexpert,emph_baselinecomplexity,emph_priority,emph_processtype,emph_isown,emph_author,emph_catalogstatus,"
    + "emph_products,emph_softwaresolutions,emph_sethow,emph_setby,emph_seton,emph_present,emph_workshopname,emph_accent,emph_comments,_emph_parent_value",
  system: "emph_systemid,emph_name,emph_vendor,emph_decision,emph_retireon,emph_users,emph_hosting,emph_note,_emph_item_value",
  role: "emph_roleid,emph_name,emph_summary,emph_rank,emph_headcount,emph_responsiblerole,emph_licencetype,emph_baseproduct,emph_attachproducts,emph_licencenote",
  itemRole: "emph_itemroleid,_emph_item_value,_emph_role_value",
  comment: "emph_commentid,emph_name,emph_activitycode,emph_author,emph_text,emph_source,createdon,_emph_item_value,_emph_flowactivity_value,_emph_workshop_value",
  flow: "emph_processflowid,emph_name,emph_flowtype,emph_state,emph_catalogcode,emph_sourcelink,emph_comments,_emph_item_value,_emph_referenceflow_value",
  decision: "emph_configdecisionid,emph_name,emph_code,emph_product,emph_answertype,emph_choices,emph_guidance,emph_menupath,emph_steps,emph_expected,emph_sourcelink,emph_sourcelabel,emph_rank,emph_answer,emph_state,emph_comments,_emph_item_value",
  requirement: "emph_requirementid,emph_reqid,emph_name,emph_description,emph_requirementtype,emph_fitgapstatus,emph_gapsolutionapproach,emph_scopeapproach,emph_acceptancecriteria,emph_requirementmapping,"
    + "emph_priority,emph_approvalstate,emph_author,emph_estimatedcomplexity,emph_owner,emph_approvedby,emph_approvedon,emph_closedreason,emph_sourcetype,emph_sourcetext,emph_raisedby,"
    + "emph_origin,emph_originref,emph_review,_emph_item_value,_emph_originflow_value,_emph_evidenceflow_value,_emph_workshop_value,_emph_flowactivity_value",
  raid: "emph_raidid,emph_name,emph_raidtype,emph_description,emph_owner,emph_priority,emph_targetdate,emph_status,emph_isquestion,emph_sourcetext,emph_resolution,emph_decisionmaker,createdon,"
    + "emph_riskimpactassessment,emph_triggers,emph_contingencyplan,emph_probability,emph_impactseverity,emph_riskcategory,emph_riskresponse,emph_impact,emph_issuetype,emph_severity,emph_reportedby,"
    + "emph_responsibleparty,emph_responsiblerole,emph_justification,emph_impactassessment,emph_alternativesolution,emph_changerequesttype,emph_requestor,emph_frozenkey,_emph_item_value,_emph_workshop_value,_emph_signoff_value",
  history: "emph_historyid,emph_table,emph_rowid,emph_field,emph_oldvalue,emph_newvalue,emph_how,emph_by,emph_workshopname,createdon",
  workshop: "emph_workshopid,emph_name,emph_heldon,emph_facilitator,emph_participants,emph_minutes,emph_phase,emph_status,emph_sessiondata,emph_transcript,emph_drawings,emph_microsoftworkshoptype,emph_sbdphase,"
    + "emph_kind,emph_sessionorder,emph_units,emph_childtasks,_emph_item_value",
  signOff: "emph_signoffid,emph_name,emph_version,emph_scopenote,emph_state,emph_approvedon,_emph_approver_value",
  proposal: "emph_proposalid,emph_name,emph_run,emph_targettable,emph_targetrowid,emph_field,emph_currentvalue,emph_proposedvalue,emph_quotes,emph_source,emph_status,emph_reason,emph_decidedby,emph_decidedon,emph_confidence,emph_details,createdon,_emph_item_value,_emph_workshop_value",
  activity: "emph_flowactivityid,emph_name,emph_activitycode,emph_shape,emph_lane,emph_stage,emph_links,emph_summary,emph_delta,emph_rationale,emph_rank,emph_x,emph_y,_emph_processflow_value",
};

export async function loadModel(g: Gateway): Promise<Model> {
  const q = (t: string, cols: string) => g.query(t, "?$select=" + cols);
  const [ws, it, sy, ro, ir, fl, dc, rq, ra, wk, so, cm, hi, pr] = await Promise.all([
    q("emph_workspace", COLS.workspace + "&$top=1"), q("emph_processitem", COLS.item), q("emph_system", COLS.system), q("emph_role", COLS.role), q("emph_itemrole", COLS.itemRole),
    optional(q("emph_processflow", COLS.flow)), optional(q("emph_configdecision", COLS.decision)), optional(q("emph_requirement", COLS.requirement)), optional(q("emph_raid", COLS.raid)),
    optional(q("emph_workshop", COLS.workshop)), optional(q("emph_signoff", COLS.signOff)), optional(q("emph_comment", COLS.comment)), optional(q("emph_history", COLS.history)),
    optional(q("emph_proposal", COLS.proposal)),
  ]);
  return {
    workspace: { id: id(ws[0]?.emph_workspaceid), organisation: txt(ws[0]?.emph_organisation), settings: settingsFrom(ws[0]?.emph_settings) },
    history: hi.map(historyFrom),
    proposals: pr.map(proposalFrom).sort((a, b) => a.createdOn.localeCompare(b.createdOn)),
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
      phase: Math.min(4, Math.max(0, r.emph_phase ?? 0)), status: r.emph_status ?? SESSION.open, itemId: id(r._emph_item_value), msType: num(r.emph_microsoftworkshoptype), sbdPhase: num(r.emph_sbdphase),
      kind: num(r.emph_kind), order: num(r.emph_sessionorder), units: txt(r.emph_units), childTasks: txt(r.emph_childtasks), session: readSession(r.emph_sessiondata), transcript: txt(r.emph_transcript), drawings: txt(r.emph_drawings) }))
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
  products: txt(r.emph_products), softwareSolution: txt(r.emph_softwaresolutions), setHow: num(r.emph_sethow), setBy: txt(r.emph_setby), setOn: day(r.emph_seton), present: txt(r.emph_present), workshopName: txt(r.emph_workshopname),
  accent: txt(r.emph_accent), comments: txt(r.emph_comments),
});
const itemColumns = (n: ProcessItem): Row => ({
  emph_name: n.name, emph_level: n.level, emph_catalogcode: n.code || null, emph_catalogname: n.catalogName || null, emph_summary: n.summary || null, emph_rank: n.rank,
  emph_scope: n.scope, emph_scopereason: n.scopeReason || null, emph_scopeapproach: n.scopeApproach || null, emph_fitgapstatus: n.fitGap, emph_gapsolutionapproach: n.gapApproach,
  emph_fitgapreason: n.fitGapReason || null, emph_businessprocessowner: n.owner || null, emph_workstreamlead: n.workstreamLead || null, emph_subjectmatterexpert: n.sme || null,
  emph_baselinecomplexity: n.complexity, emph_priority: n.priority, emph_processtype: n.processType, emph_isown: n.isOwn, emph_author: n.author, emph_catalogstatus: n.catalogStatus,
  emph_products: n.products || null, emph_softwaresolutions: n.softwareSolution || null, emph_sethow: n.setHow, emph_setby: n.setBy || null, emph_seton: n.setOn, emph_present: n.present || null, emph_workshopname: n.workshopName || null,
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
  riskImpactAssessment: txt(r.emph_riskimpactassessment), triggers: txt(r.emph_triggers), contingencyPlan: txt(r.emph_contingencyplan), probability: num(r.emph_probability),
  impactSeverity: num(r.emph_impactseverity), riskCategory: num(r.emph_riskcategory), riskResponse: num(r.emph_riskresponse), impact: txt(r.emph_impact), issueType: num(r.emph_issuetype),
  severity: num(r.emph_severity), reportedBy: txt(r.emph_reportedby), responsibleParty: num(r.emph_responsibleparty), responsibleRole: num(r.emph_responsiblerole),
  justification: txt(r.emph_justification), impactAssessment: txt(r.emph_impactassessment), alternativeSolution: txt(r.emph_alternativesolution), changeRequestType: num(r.emph_changerequesttype),
  requestor: txt(r.emph_requestor), signOffId: id(r._emph_signoff_value), frozenKey: txt(r.emph_frozenkey),
});
const raidColumns = (r: Raid): Row => ({
  emph_name: titleOf(r.description), emph_raidtype: r.type, emph_description: r.description, emph_owner: r.owner || null, emph_priority: r.priority, emph_targetdate: r.targetDate,
  emph_status: r.status, emph_isquestion: r.isQuestion, emph_sourcetext: r.source || null, emph_resolution: r.resolution || null, emph_decisionmaker: r.decisionMaker || null,
  emph_riskimpactassessment: r.riskImpactAssessment || null, emph_triggers: r.triggers || null, emph_contingencyplan: r.contingencyPlan || null, emph_probability: r.probability,
  emph_impactseverity: r.impactSeverity, emph_riskcategory: r.riskCategory, emph_riskresponse: r.riskResponse, emph_impact: r.impact || null, emph_issuetype: r.issueType, emph_severity: r.severity,
  emph_reportedby: r.reportedBy || null, emph_responsibleparty: r.responsibleParty, emph_responsiblerole: r.responsibleRole, emph_justification: r.justification || null,
  emph_impactassessment: r.impactAssessment || null, emph_alternativesolution: r.alternativeSolution || null, emph_changerequesttype: r.changeRequestType, emph_requestor: r.requestor || null,
  emph_frozenkey: r.frozenKey || null,
});
export const blankRaid = (p: Partial<Raid> = {}): Raid => {
  const type = p.type ?? RAID.action;
  return { id: "", name: "", type, description: "", itemId: null, workshopId: null, owner: "", priority: null, targetDate: null, status: raidStart(type), isQuestion: false, source: "",
    resolution: "", decisionMaker: "", createdOn: new Date().toISOString(), riskImpactAssessment: "", triggers: "", contingencyPlan: "", probability: null, impactSeverity: null, riskCategory: null,
    riskResponse: null, impact: "", issueType: null, severity: null, reportedBy: "", responsibleParty: null, responsibleRole: null, justification: "", impactAssessment: "", alternativeSolution: "",
    changeRequestType: null, requestor: "", signOffId: null, frozenKey: "", ...p };
};
const historyFrom = (r: Row): HistoryRow => ({ id: r.emph_historyid, table: txt(r.emph_table), rowId: txt(r.emph_rowid), field: txt(r.emph_field), oldValue: txt(r.emph_oldvalue), newValue: txt(r.emph_newvalue),
  how: num(r.emph_how), by: txt(r.emph_by), workshopName: txt(r.emph_workshopname), createdOn: r.createdon || "" });
const settingsFrom = (v: unknown): WorkspaceSettings => {
  const s = json<Partial<WorkspaceSettings>>(v, {});
  return { prices: Array.isArray(s.prices) ? s.prices.filter(p => p && typeof p.price === "number") : [],
    demoLinks: Array.isArray(s.demoLinks) ? s.demoLinks.filter(d => d && typeof d.code === "string" && typeof d.url === "string") : [],
    ...(s.aiPrompts && typeof s.aiPrompts === "object" ? { aiPrompts: s.aiPrompts } : {}),
    ...(Array.isArray(s.aiRuns) ? { aiRuns: s.aiRuns.filter(r => r && typeof r.run === "string") } : {}) };
};
const BLANK_DETAILS: ProposalDetails = { ref: "", object: "observation", op: "create", target: "", parent: "", fields: {}, level: "", segment: "org", segmentTitle: "Organisation and notes", confidence: "medium", quotesChecked: 0, quotesUnchecked: 0 };
const proposalFrom = (r: Row): Proposal => {
  const details = { ...BLANK_DETAILS, ...json<Partial<ProposalDetails>>(r.emph_details, {}) };
  return { id: r.emph_proposalid, name: txt(r.emph_name), run: txt(r.emph_run), workshopId: id(r._emph_workshop_value), itemId: id(r._emph_item_value), targetTable: txt(r.emph_targettable), targetRowId: txt(r.emph_targetrowid),
    field: txt(r.emph_field), current: txt(r.emph_currentvalue), proposed: txt(r.emph_proposedvalue), evidence: json<AiEvidence[]>(r.emph_quotes, []), source: num(r.emph_source), status: r.emph_status ?? PROPOSAL.suggested,
    reason: txt(r.emph_reason), decidedBy: txt(r.emph_decidedby), decidedOn: r.emph_decidedon || null, confidence: num(r.emph_confidence), details: { ...details, fields: details.fields || {} }, createdOn: r.createdon || "" };
};
const proposalColumns = (p: ProposalDraft | Proposal): Row => ({
  emph_name: (p.name || "Suggestion").slice(0, 200), emph_run: p.run, emph_targettable: p.targetTable || null, emph_targetrowid: p.targetRowId || null, emph_field: (p.field || "").slice(0, 100) || null,
  emph_currentvalue: (p.current || "").slice(0, 4000) || null, emph_proposedvalue: (p.proposed || "").slice(0, 4000) || null, emph_quotes: JSON.stringify(p.evidence).slice(0, 20000), emph_source: p.source,
  emph_status: p.status, emph_reason: (p.reason || "").slice(0, 4000) || null, emph_confidence: p.confidence, emph_details: JSON.stringify(p.details).slice(0, 100000),
});
const activityColumns = (a: Activity) => ({
  emph_name: (a.name || "Activity").slice(0, 300), emph_activitycode: a.code, emph_shape: a.shape, emph_lane: a.lane || null, emph_stage: a.stage || null,
  emph_links: JSON.stringify(a.links || []), emph_summary: a.summary || null, emph_delta: a.delta, emph_rationale: a.rationale || null, emph_rank: a.rank,
  emph_x: a.pos ? Math.round(a.pos.x) : null, emph_y: a.pos ? Math.round(a.pos.y) : null,
});

/** A blank item; `level` 1-4. */
export const blankItem = (p: Partial<ProcessItem> & { level: number }): ProcessItem => ({
  id: "", parentId: null, code: "", name: "", catalogName: "", summary: "", rank: 0, scope: SCOPE.unspecified, scopeReason: "", scopeApproach: "", fitGap: null, gapApproach: null, fitGapReason: "",
  owner: "", workstreamLead: "", sme: "", complexity: null, priority: null, processType: null, isOwn: false, author: null, catalogStatus: null, products: "", softwareSolution: "",
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
/** `on`: the date it was set (a workshop's date); today when not given. */
export interface How { how: number; workshop?: string; present?: string; on?: string | null }
const DIRECT: How = { how: HOW.direct };
const RESTORE: How = { how: HOW.restore };
/** The history field of a read-back answer on a requirement. */
export const READ_BACK_FIELD = "Read back";

export class Repository {
  constructor(public g: Gateway, public user = "") {}

  private async unlink(table: string, rowId: string, nav: string) {
    try { await this.g.patch(table, rowId, { [nav + "@odata.bind"]: null }); } catch { /* already empty */ }
  }
  /** One emph_history row per changed field (labels for choices), returned for the model. A failed history write never stops the change. */
  private async history<T>(table: string, rowId: string, before: T, after: T, how: How): Promise<HistoryRow[]> {
    const out: HistoryRow[] = [];
    for (const { field, column, list } of HISTORY_FIELDS[table] as HistoryField[]) {
      const a = historyText((before as any)[field], list).slice(0, 2000), b = historyText((after as any)[field], list).slice(0, 2000);
      if (a === b) continue;
      const row: HistoryRow = { id: "", table, rowId, field: column, oldValue: a, newValue: b, how: how.how, by: this.user, workshopName: how.workshop || "", createdOn: new Date().toISOString() };
      try {
        row.id = await this.g.insert("emph_history", { emph_name: (table + " " + column).slice(0, 200), emph_table: table, emph_rowid: rowId, emph_field: column, emph_oldvalue: a || null,
          emph_newvalue: b || null, emph_how: how.how, emph_by: this.user || null, emph_workshopname: how.workshop || null });
        out.push(row);
      } catch { /* the change itself stands */ }
    }
    return out;
  }

  /** Puts a field back to the value a history row had before; the restore is itself a change, so it writes a new history row. */
  async restore(m: Model, h: HistoryRow): Promise<Model> {
    const r = restorePatch(h, m.history);
    if ("problem" in r) throw new Error(r.problem);
    if (h.table === "emph_processitem") {
      const it = m.items.find(x => x.id === h.rowId);
      if (!it) throw new Error("That process item is gone.");
      return this.saveItem(m, it, r.patch as Partial<ProcessItem>, RESTORE);
    }
    const q = m.requirements.find(x => x.id === h.rowId);
    if (!q) throw new Error("That requirement is gone.");
    return this.updateRequirement(m, q, r.patch as Partial<Requirement>, RESTORE);
  }

  // ---------- settings (the licence price table) ----------
  async saveSettings(m: Model, settings: WorkspaceSettings): Promise<Model> {
    const data = { emph_settings: JSON.stringify(settings) };
    if (m.workspace.id) { await this.g.patch("emph_workspace", m.workspace.id, data); return { ...m, workspace: { ...m.workspace, settings } }; }
    const wid = await this.g.insert("emph_workspace", { emph_name: "EMPH Process Map", emph_organisation: m.workspace.organisation || null, ...data });
    return { ...m, workspace: { ...m.workspace, id: wid, settings } };
  }

  // ---------- workspace ----------
  async setOrganisation(m: Model, organisation: string): Promise<Model> {
    if (m.workspace.id) await this.g.patch("emph_workspace", m.workspace.id, { emph_organisation: organisation || null });
    else m = { ...m, workspace: { ...m.workspace, id: await this.g.insert("emph_workspace", { emph_name: "EMPH Process Map", emph_organisation: organisation || null }) } };
    return { ...m, workspace: { ...m.workspace, organisation } };
  }

  // ---------- process items (levels 1 to 4) ----------
  /**
   * Saves an item (a new one when it has no id). Scope takes the values of the item's level (level 3 only Not applicable);
   * fit-gap is set on levels 3 and 4, and a Gap needs a solution approach. Scope and fit-gap changes record how, by whom and when.
   */
  async saveItem(m: Model, it: ProcessItem, patch: Partial<ProcessItem>, how: How = DIRECT): Promise<Model> {
    const n: ProcessItem = { ...it, ...patch };
    if (patch.scope !== undefined) { const p = scopeProblem(n.level, n.scope); if (p) throw new Error(p); }
    if (!fitGapLevel(n.level) && ((patch.fitGap ?? null) !== null || (patch.gapApproach ?? null) !== null)) throw new Error("Fit gap status is set on business processes (level 3) and scenarios (level 4) only.");
    const problem = fitGapProblem(n);
    if (problem && (patch.fitGap !== undefined || patch.gapApproach !== undefined)) throw new Error(problem);
    if (n.scope !== it.scope || n.fitGap !== it.fitGap || n.gapApproach !== it.gapApproach) Object.assign(n, { setHow: how.how, setBy: this.user, setOn: how.on || today(), workshopName: how.workshop || "", present: how.present || "" });
    const data = itemColumns(n);
    if (!it.id) {
      if (n.parentId) data["emph_Parent@odata.bind"] = ref("emph_processitem", n.parentId);
      n.id = await this.g.insert("emph_processitem", data);
      return { ...m, items: m.items.concat(n) };
    }
    await this.g.patch("emph_processitem", it.id, data);
    const logged = await this.history("emph_processitem", it.id, it, n, how);
    let model: Model = { ...m, items: m.items.map(x => (x.id === it.id ? n : x)), history: m.history.concat(logged) };
    if (n.scope !== it.scope) model = await this.flagOrigin(model, REQ_ORIGIN.scope, it.id);
    if (n.fitGap !== it.fitGap || n.gapApproach !== it.gapApproach || n.comments !== it.comments) model = await this.flagOrigin(model, REQ_ORIGIN.process, it.id);
    return model;
  }

  /**
   * In or out of scope, as on the map. Levels 1, 2 and 4 go 20 - In scope or 30 - Out of scope; a business process (level 3)
   * goes 10 - Unspecified (it runs) or 40 - Not applicable. Putting an item in brings the items above it in too; an area that
   * comes in this way keeps its other undecided business processes out (Not applicable), so the tick means this one.
   * A business process put in brings its undecided scenarios in. Taking an item out greys the items below; they keep their values.
   */
  async setScope(m: Model, it: ProcessItem, on: boolean, how: How = DIRECT, reason?: string): Promise<Model> {
    const level3 = it.level === 3;
    const value = on ? (level3 ? (isOff(it.scope) ? SCOPE.unspecified : it.scope) : SCOPE.in) : level3 ? SCOPE.na : SCOPE.out;
    let model = await this.saveItem(m, it, { scope: value, ...(reason !== undefined ? { scopeReason: reason } : {}) }, how);
    if (!on) return model;
    let child: ProcessItem = it;
    for (const a of ancestorsOf(model.items, it)) {
      const cur = model.items.find(x => x.id === a.id) || a;
      if (cur.level === 3 ? isOff(cur.scope) : cur.scope !== SCOPE.in) {
        model = await this.saveItem(model, cur, { scope: cur.level === 3 ? SCOPE.unspecified : SCOPE.in }, how);
        if (cur.level === 2)
          for (const s of childrenOf(model.items, cur.id).filter(x => x.level === 3 && x.id !== child.id && !scopeDecided(x.scope)))
            model = await this.saveItem(model, s, { scope: SCOPE.na, scopeReason: s.scopeReason || "Not chosen when the process area came into scope" }, how);
      }
      child = cur;
    }
    if (level3) for (const s of descendantsOf(model.items, it.id).filter(x => x.level === 4 && !scopeDecided(x.scope))) model = await this.saveItem(model, s, { scope: SCOPE.in }, how);
    return model;
  }

  /**
   * Our own item under `parentId` (level = the parent's + 1): an X-numbered code, Author Project, Catalog status 50 - Custom,
   * in scope. Our own scenario (level 4) runs on other software: Products "Other" and its Software solutions.
   */
  async addOwnItem(m: Model, parentId: string | null, name: string, softwareSolution = "", reason = ""): Promise<{ model: Model; item: ProcessItem }> {
    const title = name.trim();
    const parent = m.items.find(x => x.id === parentId);
    const level = parent ? parent.level + 1 : 1;
    const problem = ownItemProblem(level, title, reason);
    if (problem) throw new Error(problem);
    const siblings = childrenOf(m.items, parentId);
    // Microsoft's rules for own items: numbered under the parent, the reason kept in the description
    const it = blankItem({ level, parentId, code: ownCode(parent?.code || "", level, m.items.map(x => x.code)), name: title, summary: reason.trim() ? (OWN_RULE[level]?.reason || "Reason") + ": " + reason.trim() : "", rank: Math.max(0, ...siblings.map(x => x.rank)) + 10, scope: level === 3 ? SCOPE.unspecified : SCOPE.in,
      isOwn: true, author: AUTHOR.project, catalogStatus: CATALOG_CUSTOM, accent: level === 1 ? "#0D9488" : "",
      ...(level === 4 ? { products: labelOf("products", PRODUCT_OTHER), softwareSolution: softwareSolution.trim() } : {}) });
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
  /** Saves a role. Base and attach products belong to a Full licence only, so another type clears them. */
  async saveRole(m: Model, r: Role, patch: Partial<Role>): Promise<Model> {
    const n = { ...r, ...patch };
    if (n.licenceType !== LICENCE.full) { n.baseProduct = null; n.attachProducts = ""; }
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
    const logged = await this.history("emph_requirement", r.id, r, n, how);
    return { ...m, requirements: m.requirements.map(x => (x.id === r.id ? n : x)), history: m.history.concat(logged) };
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
  /** A RAID item, starting in its type's first status; a workshop's open points are Action items (open questions marked as a question). */
  async addRaid(m: Model, p: Partial<Raid> & { description: string }): Promise<Model> {
    const r = blankRaid({ ...p, description: p.description.trim() });
    if (p.status === undefined) r.status = raidStart(r.type);
    const problem = raidProblem(r);
    if (problem) throw new Error(problem);
    r.name = titleOf(r.description);
    const data: Row = raidColumns(r);
    if (r.itemId) data["emph_Item@odata.bind"] = ref("emph_processitem", r.itemId);
    if (r.workshopId) data["emph_Workshop@odata.bind"] = ref("emph_workshop", r.workshopId);
    if (r.signOffId) data["emph_SignOff@odata.bind"] = ref("emph_signoff", r.signOffId);
    r.id = await this.g.insert("emph_raid", data);
    return { ...m, raids: m.raids.concat(r) };
  }
  /** Saves a RAID item. A new type moves the status to that type's first one when the old status doesn't belong to it. */
  async saveRaid(m: Model, r: Raid, patch: Partial<Raid>): Promise<Model> {
    const n = { ...r, ...patch };
    if (patch.type !== undefined && patch.status === undefined && raidProblem({ ...n, description: n.description || "x" })?.startsWith("That status")) n.status = raidStart(n.type);
    const problem = raidProblem(n);
    if (problem) throw new Error(problem);
    n.description = n.description.trim(); n.name = titleOf(n.description);
    const data: Row = raidColumns(n);
    if (n.itemId && n.itemId !== r.itemId) data["emph_Item@odata.bind"] = ref("emph_processitem", n.itemId);
    await this.g.patch("emph_raid", r.id, data);
    if (!n.itemId && r.itemId) await this.unlink("emph_raid", r.id, "emph_Item");
    return { ...m, raids: m.raids.map(x => (x.id === r.id ? n : x)) };
  }
  /** After a sign-off is approved, a change to what it froze can be raised as a Change request (once per frozen item and sign-off). */
  async raiseChangeRequest(m: Model, s: SignOff, d: Difference): Promise<Model> {
    const cr = changeRequestFor(d, s);
    if (m.raids.some(x => x.type === RAID.change && x.signOffId === s.id && x.frozenKey === cr.frozenKey)) throw new Error("A change request for this is already raised.");
    const itemId = d.item.type === ITEM.scope ? d.item.key : null;
    return this.addRaid(m, { type: RAID.change, description: cr.description, justification: cr.justification, frozenKey: cr.frozenKey, signOffId: s.id, requestor: this.user,
      changeRequestType: option("changeRequestType", cr.changeRequestType), itemId: m.items.some(x => x.id === itemId) ? itemId : null });
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
  /**
   * A workshop under one end-to-end process (or all of them). Discovery (EMPH's own): the business processes (level 3) in
   * scope on the agenda. Made from Microsoft's template: its agenda lines, Microsoft workshop type and Success by Design
   * phase, its unit and Microsoft's child tasks. The session order runs Prepare, Run the agenda, Analyse, Conclusion, Close.
   */
  async addWorkshop(m: Model, endToEndId: string | null, opts: { kind?: WorkshopKindName; template?: MsTemplate | null; name?: string } = {}): Promise<{ model: Model; workshop: Workshop }> {
    const kind: WorkshopKindName = opts.template ? opts.template.kind : opts.kind || "discovery";
    const t = kind === "discovery" ? null : opts.template || null;
    const heldOn = today();
    const e2e = m.items.find(e => e.id === endToEndId) || (t ? m.items.find(e => e.level === 1 && e.code === t.unit.slice(0, 2)) : undefined);
    const e2eId = e2e?.id ?? endToEndId;
    const name = (opts.name || (t ? t.title.replace(/\s+workshop$/i, "") + " " + heldOn : (e2e ? e2e.name + " " : "") + "workshop " + heldOn)).slice(0, 200);
    const processes = kind === "discovery" ? m.items.filter(p => p.level === 3 && inScope(m.items, p) && (!e2eId || levelUp(m.items, p, 1)?.id === e2eId)) : [];
    const session = newSession(processes.map(p => p.id));
    session.run = { ...emptyRun(kind, t?.id || "", t?.unit || e2e?.code || ""), agenda: newAgenda(kind, t, processes) };
    const order = Math.max(0, ...m.workshops.map(w => w.order ?? 0)) + 1;
    const tasks = childTasksOf(kind, t?.id || "", e2e ? e2e.catalogName || e2e.name : "");
    const msType = t ? option("microsoftWorkshopType", WORKSHOP_TYPE_OF_KIND[t.kind]) : null, sbdPhase = t ? option("sbdPhase", SBD_PHASE_OF_KIND[t.kind]) : null;
    const units = t?.unit || e2e?.code || "", childTasks = tasks.length ? JSON.stringify(tasks) : "";
    const data: Row = { emph_name: name, emph_heldon: heldOn, emph_phase: 0, emph_status: SESSION.open, emph_sessiondata: JSON.stringify(session), emph_kind: kindValue(kind), emph_sessionorder: order,
      emph_microsoftworkshoptype: msType, emph_sbdphase: sbdPhase, emph_units: units || null, emph_childtasks: childTasks || null };
    if (e2eId) data["emph_Item@odata.bind"] = ref("emph_processitem", e2eId);
    const workshop: Workshop = { id: await this.g.insert("emph_workshop", data), name, heldOn, facilitator: "", participants: "", minutes: "", phase: 0, status: SESSION.open, itemId: e2eId || null,
      msType, sbdPhase, kind: kindValue(kind), order, units, childTasks, session, transcript: "", drawings: "" };
    return { model: { ...m, workshops: [workshop, ...m.workshops] }, workshop };
  }
  /**
   * Close: writes what the room agreed to the process items, each change as set in this workshop (How Workshop, the
   * workshop's name and date, who was present) with history, keeps what each item was before (for undo), ticks the child
   * tasks, and closes the workshop.
   */
  async closeWorkshop(m: Model, w: Workshop, changes: Change[], how: How, tasks: ChildTask[]): Promise<Model> {
    let model = m;
    const written: Written[] = [];
    for (const c of changes) {
      const it = model.items.find(x => x.id === c.itemId);
      if (!it) continue;
      const before = beforeOf(it);
      model = await this.saveItem(model, it, c.patch, how);
      written.push({ itemId: it.id, label: c.label, before });
    }
    const cur = model.workshops.find(x => x.id === w.id) || w;
    const run = { ...(cur.session.run as RunState), written, closedOn: new Date().toISOString() };
    return this.saveWorkshop(model, cur, { status: SESSION.closed, session: { ...cur.session, run }, childTasks: tasks.length ? JSON.stringify(tasks) : cur.childTasks });
  }
  /** Undo Close: every item Close wrote gets its values back (How Restore, with history); the workshop opens again in the Conclusion. */
  async undoClose(m: Model, w: Workshop): Promise<Model> {
    let model = m;
    const run = w.session.run as RunState | undefined;
    for (const x of (run?.written || []).slice().reverse()) {
      const it = model.items.find(i => i.id === x.itemId);
      if (it) model = await this.saveItem(model, it, x.before, RESTORE);
    }
    const cur = model.workshops.find(i => i.id === w.id) || w;
    const { written, closedOn, ...rest } = (cur.session.run || {}) as RunState;
    return this.saveWorkshop(model, cur, { status: SESSION.open, phase: 3, session: { ...cur.session, run: rest as RunState } });
  }
  /**
   * What the room answered when a requirement was read back (Confirmed, Changed: what changed, Open), kept in history as a
   * row on the requirement with field "Read back" (Business Map D1: confirmations are part of an item's history). Not restorable.
   */
  async recordReadBack(m: Model, answers: { rowId: string; answer: string }[], how: How): Promise<Model> {
    const rows: HistoryRow[] = [];
    for (const a of answers) {
      const row: HistoryRow = { id: "", table: "emph_requirement", rowId: a.rowId, field: READ_BACK_FIELD, oldValue: "", newValue: a.answer.slice(0, 2000), how: how.how, by: this.user, workshopName: how.workshop || "", createdOn: new Date().toISOString() };
      try {
        row.id = await this.g.insert("emph_history", { emph_name: "emph_requirement " + READ_BACK_FIELD, emph_table: row.table, emph_rowid: row.rowId, emph_field: READ_BACK_FIELD, emph_newvalue: row.newValue || null,
          emph_how: how.how, emph_by: this.user || null, emph_workshopname: how.workshop || null });
        rows.push(row);
      } catch { /* the workshop closes all the same */ }
    }
    return { ...m, history: rows.concat(m.history) };
  }
  async saveWorkshop(m: Model, w: Workshop, patch: Partial<Workshop>): Promise<Model> {
    const n = { ...w, ...patch };
    await this.g.patch("emph_workshop", w.id, { emph_name: n.name, emph_heldon: n.heldOn, emph_facilitator: n.facilitator || null, emph_participants: n.participants || null, emph_minutes: n.minutes || null, emph_phase: n.phase,
      emph_status: n.status, emph_sessiondata: JSON.stringify(n.session), emph_microsoftworkshoptype: n.msType, emph_sbdphase: n.sbdPhase, emph_kind: n.kind, emph_sessionorder: n.order,
      emph_units: n.units || null, emph_childtasks: n.childTasks || null, ...("transcript" in patch ? { emph_transcript: n.transcript || null } : {}), ...("drawings" in patch ? { emph_drawings: n.drawings || null } : {}) });
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
  /** `note`: the note's text, with the marks drawn on the picture after a fixed line (drawing.ts noteWithMarks). */
  async addScreenshot(w: Workshop, subject: string, jpeg: string, note = ""): Promise<Screenshot> {
    const at = new Date().toISOString();
    const id = await this.g.insert("annotation", { subject: subject.slice(0, 500), filename: "screenshot-" + at.slice(0, 19).replace(/[:T]/g, "-") + ".jpg", mimetype: "image/jpeg",
      documentbody: jpeg, isdocument: true, ...(note ? { notetext: note.slice(0, 100000) } : {}), "objectid_emph_workshop@odata.bind": ref("emph_workshop", w.id) });
    return { id, subject, createdOn: at, note };
  }
  async screenshots(w: Workshop): Promise<Screenshot[]> {
    const rows = await this.g.query("annotation", "?$select=annotationid,subject,notetext,createdon&$filter=_objectid_value eq " + w.id + "&$orderby=createdon desc");
    return rows.map(r => ({ id: r.annotationid, subject: txt(r.subject), createdOn: r.createdon || "", note: txt(r.notetext) }));
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

  // ---------- AI analysis: suggestions (emph_proposal) ----------
  /** A row of history for what the history fields don't cover (a row made, a closed reason, a licence), as the How says. */
  private async logRow(table: string, rowId: string, field: string, oldValue: string, newValue: string, how: How): Promise<HistoryRow | null> {
    const row: HistoryRow = { id: "", table, rowId, field, oldValue: oldValue.slice(0, 2000), newValue: newValue.slice(0, 2000), how: how.how, by: this.user, workshopName: how.workshop || "", createdOn: new Date().toISOString() };
    try {
      row.id = await this.g.insert("emph_history", { emph_name: (table + " " + field).slice(0, 200), emph_table: table, emph_rowid: rowId, emph_field: field, emph_oldvalue: row.oldValue || null,
        emph_newvalue: row.newValue || null, emph_how: how.how, emph_by: this.user || null, emph_workshopname: how.workshop || null });
      return row;
    } catch { return null; }
  }
  private async logRows(m: Model, rows: [string, string, string, string, string][], how: How): Promise<Model> {
    const out: HistoryRow[] = [];
    for (const [table, rowId, field, a, b] of rows) { if (a === b) continue; const r = await this.logRow(table, rowId, field, a, b, how); if (r) out.push(r); }
    return out.length ? { ...m, history: m.history.concat(out) } : m;
  }

  /**
   * One AI run: its suggestions as Suggested rows, and its log (what was sent, dropped, already so, the questions) on the
   * workshop's session, or for a run without a workshop in the workspace settings (the last ten).
   */
  async saveRun(m: Model, drafts: ProposalDraft[], log: AiRun): Promise<Model> {
    const made: Proposal[] = [];
    for (const d of drafts) {
      const data: Row = proposalColumns(d);
      if (d.itemId) data["emph_Item@odata.bind"] = ref("emph_processitem", d.itemId);
      if (d.workshopId) data["emph_Workshop@odata.bind"] = ref("emph_workshop", d.workshopId);
      const pid = await this.g.insert("emph_proposal", data);
      made.push({ ...d, id: pid, decidedBy: "", decidedOn: null, createdOn: new Date().toISOString() });
    }
    let model: Model = { ...m, proposals: m.proposals.concat(made) };
    const w = log.workshopId ? model.workshops.find(x => x.id === log.workshopId) : undefined;
    if (w) model = await this.saveWorkshop(model, w, { session: { ...w.session, ai: [log, ...(w.session.ai || [])].slice(0, 20) } });
    else model = await this.saveSettings(model, { ...model.workspace.settings, aiRuns: [log, ...(model.workspace.settings.aiRuns || [])].slice(0, 10) });
    return model;
  }
  private async decided(m: Model, p: Proposal, status: number, patch: Partial<Proposal> = {}): Promise<Model> {
    const n: Proposal = { ...p, ...patch, status, decidedBy: this.user, decidedOn: new Date().toISOString() };
    await this.g.patch("emph_proposal", p.id, { emph_status: status, emph_decidedby: this.user || null, emph_decidedon: n.decidedOn, emph_targetrowid: n.targetRowId || null, emph_details: JSON.stringify(n.details).slice(0, 100000) });
    return { ...m, proposals: m.proposals.map(x => (x.id === p.id ? n : x)) };
  }
  async rejectProposal(m: Model, p: Proposal): Promise<Model> {
    if (p.status !== PROPOSAL.suggested) return m;
    return this.decided(m, p, PROPOSAL.rejected);
  }
  /** Clear this run: the suggestions nobody decided go; accepted, edited and rejected ones stay as the record. */
  async clearRun(m: Model, run: string): Promise<Model> {
    const gone = m.proposals.filter(p => p.run === run && p.status === PROPOSAL.suggested);
    for (const p of gone) await this.g.drop("emph_proposal", p.id);
    const ids = new Set(gone.map(p => p.id));
    return { ...m, proposals: m.proposals.filter(p => !ids.has(p.id)) };
  }

  /**
   * Accept an AI suggestion: it is applied through the same saves as a change made by hand, each change written to history
   * with How "AI accepted" (and the workshop's name for a workshop's run). `edited` is the reviewer's own words for its
   * main text: the suggestion is then Edited, not Accepted. A decided suggestion is never applied again.
   */
  async acceptProposal(m: Model, p: Proposal, edited?: string): Promise<Model> {
    if (p.status !== PROPOSAL.suggested) throw new Error("This suggestion is decided already.");
    const w = p.workshopId ? m.workshops.find(x => x.id === p.workshopId) : undefined;
    const how: How = { how: HOW.ai, workshop: w?.name, on: today() };
    const d = p.details, f = d.fields;
    const words = edited != null && edited.trim() ? edited.trim() : undefined;
    const text = words ?? (f.text || f.name || p.proposed);
    const quote = p.evidence[0] ? p.evidence[0].quote : "";
    const heard = quote ? "AI analysis" + (p.evidence[0].sourceName ? " of " + p.evidence[0].sourceName : "") + ": “" + quote + "”" : "AI analysis";
    let model = m, rowId = p.targetRowId;
    const item = (rid: string | null | undefined) => model.items.find(x => x.id === rid);
    /** the process a create goes under: the item it names, or the process this run made for its parent ref */
    const parentId = (): string | null => {
      if (d.parentRef) {
        const made = model.proposals.find(x => x.run === p.run && x.details.ref.toLowerCase() === d.parentRef!.toLowerCase());
        if (!made || made.status === PROPOSAL.rejected) throw new Error("It goes under a new process that was not accepted: accept that one first, or reject this.");
        if (made.status === PROPOSAL.suggested || !made.targetRowId) throw new Error("It goes under the new process “" + (made.details.fields.name || made.proposed) + "”: accept that one first.");
        return made.targetRowId;
      }
      return p.itemId;
    };
    switch (d.object) {
      case "scope": {
        const it = item(p.targetRowId);
        if (!it) throw new Error("That process item is gone.");
        model = await this.setScope(model, it, d.op === "create", how, f.reason || undefined);
        break;
      }
      case "fit_gap": {
        const it = item(p.targetRowId);
        if (!it) throw new Error("That process item is gone.");
        const fit = fitValue(f.fit);
        model = await this.saveItem(model, it, { fitGap: fit, gapApproach: fit === FIT_GAP.gap ? approachValue(f.approach) : null, fitGapReason: words ?? (f.reason || it.fitGapReason) }, how);
        break;
      }
      case "process": {
        if (d.op === "create") {
          const r = await this.addOwnItem(model, parentId(), words ?? (f.name || f.text), "", (f.reason || p.reason || "") + (quote ? " (" + heard + ")" : ""));
          model = r.model; rowId = r.item.id;
          const extra: Partial<ProcessItem> = { ...(f.name && f.text ? { summary: f.text } : {}), ...(f.owner ? { owner: f.owner } : {}), ...(f.sme ? { sme: f.sme } : {}) };
          if (Object.keys(extra).length) model = await this.saveItem(model, r.item, extra, how);
          model = await this.logRows(model, [["emph_processitem", rowId, "Created", "", r.item.code + " " + r.item.name + " (" + heard + ")"]], how);
        } else {
          const it = item(p.targetRowId);
          if (!it) throw new Error("That process item is gone.");
          const main = f.name ? "name" : f.text ? "text" : f.owner ? "owner" : "sme";
          const v = (k: string) => (words != null && k === main ? words : f[k]);
          model = await this.saveItem(model, it, { ...(v("name") ? { name: v("name") } : {}), ...(v("text") ? { summary: v("text") } : {}), ...(v("owner") ? { owner: v("owner") } : {}), ...(v("sme") ? { sme: v("sme") } : {}) }, how);
        }
        break;
      }
      case "step": {
        const r = await this.applyStep(model, p, words, how, heard);
        model = r.model; rowId = r.rowId;
        break;
      }
      case "requirement": {
        if (d.op === "create") {
          const fit = fitValue(f.fit || "");
          const r = await this.addRequirement(model, text, { itemId: parentId(), workshopId: p.workshopId, type: reqTypeValue(f.type || ""), priority: priorityValue(f.priority || ""), owner: f.owner || "",
            fitGap: fit, gapApproach: fit === FIT_GAP.gap ? approachValue(f.approach) : null, sourceType: "AI analysis (accepted)", sourceText: quote, raisedBy: f.speaker || "", review: false });
          model = r.model; rowId = r.requirement.id;
          model = await this.logRows(model, [["emph_requirement", rowId, "Created", "", (r.requirement.reqId ? r.requirement.reqId + ": " : "") + text]], how);
        } else {
          const q = model.requirements.find(x => x.id === p.targetRowId);
          if (!q) throw new Error("That requirement is gone.");
          if (d.op === "remove") {
            model = await this.updateRequirement(model, q, { closedReason: "Withdrawn" }, how);
            model = await this.logRows(model, [["emph_requirement", q.id, "Closed reason", q.closedReason, "Withdrawn"]], how);
          } else {
            const fit = f.fit ? fitValue(f.fit) : undefined;
            const desc = words ?? f.text;
            model = await this.updateRequirement(model, q, { ...(desc ? { description: desc } : {}), ...(f.priority ? { priority: priorityValue(f.priority) } : {}), ...(f.owner ? { owner: f.owner } : {}),
              ...(fit !== undefined ? { fitGap: fit, gapApproach: fit === FIT_GAP.gap ? approachValue(f.approach) : null } : {}) }, how);
          }
        }
        break;
      }
      case "risk": case "assumption": case "issue": case "decision": case "action": case "open_question": {
        if (d.op === "create") {
          const before = model.raids.length;
          model = await this.addRaid(model, { ...raidOf(d, text), source: quote ? heard : "", workshopId: p.workshopId, itemId: parentId() });
          const r = model.raids[before];
          rowId = r?.id || "";
          if (r) model = await this.logRows(model, [["emph_raid", r.id, "Created", "", labelOf("raidType", r.type) + ": " + r.description]], how);
        } else {
          const ra = model.raids.find(x => x.id === p.targetRowId);
          if (!ra) throw new Error("That RAID item is gone.");
          const desc = words ?? f.text;
          const patch: Partial<Raid> = { ...(desc ? { description: desc } : {}), ...(f.owner ? { owner: f.owner } : {}), ...(f.resolution ? { resolution: f.resolution } : {}), ...(f.decided_by ? { decisionMaker: f.decided_by } : {}) };
          model = await this.saveRaid(model, ra, patch);
          model = await this.logRows(model, [["emph_raid", ra.id, "Description", ra.description, patch.description ?? ra.description], ["emph_raid", ra.id, "Owner", ra.owner, patch.owner ?? ra.owner],
            ["emph_raid", ra.id, "Resolution", ra.resolution, patch.resolution ?? ra.resolution], ["emph_raid", ra.id, "Decision maker", ra.decisionMaker, patch.decisionMaker ?? ra.decisionMaker]], how);
        }
        break;
      }
      case "licence": {
        const r = model.roles.find(x => x.id === p.targetRowId);
        if (!r) throw new Error("That role is gone.");
        const lv = licenceValue(f.licence || ""), hc = f.headcount ? headcountValue(f.headcount) : null;
        model = await this.saveRole(model, r, { ...(lv != null ? { licenceType: lv } : {}), ...(hc != null ? { headcount: hc } : {}), licenceNote: (r.licenceNote ? r.licenceNote + "\n" : "") + heard });
        const n = model.roles.find(x => x.id === r.id) || r;
        model = await this.logRows(model, [["emph_role", r.id, "Licence type", labelOf("licenceType", r.licenceType), labelOf("licenceType", n.licenceType)],
          ["emph_role", r.id, "Headcount", r.headcount == null ? "" : String(r.headcount), n.headcount == null ? "" : String(n.headcount)]], how);
        break;
      }
      case "system": {
        const dv = systemDecisionValue(f.decision || "");
        if (d.op === "create") {
          const before = new Set(model.systems.map(x => x.id));
          model = await this.saveSystem(model, { id: "", itemId: p.itemId, name: words ?? f.name, vendor: f.vendor || "", decision: dv, retireOn: null, users: f.users || "", hosting: "", note: [f.text, heard].filter(Boolean).join("\n") }, {});
          const s = model.systems.find(x => !before.has(x.id));
          rowId = s?.id || "";
          if (s) model = await this.logRows(model, [["emph_system", s.id, "Created", "", s.name + (dv != null ? " (" + labelOf("systemDecision", dv) + ")" : "")]], how);
        } else {
          const s = model.systems.find(x => x.id === p.targetRowId);
          if (!s) throw new Error("That system is gone.");
          model = await this.saveSystem(model, s, { ...(dv != null ? { decision: dv } : {}), ...(f.users ? { users: f.users } : {}), note: (s.note ? s.note + "\n" : "") + heard });
          model = await this.logRows(model, [["emph_system", s.id, "Decision", labelOf("systemDecision", s.decision), labelOf("systemDecision", dv ?? s.decision)], ["emph_system", s.id, "Users", s.users, f.users || s.users]], how);
        }
        break;
      }
      case "organisation":
        if (p.targetTable === "emph_workspace") {
          const before = model.workspace.organisation;
          model = await this.setOrganisation(model, words ?? f.name);
          model = await this.logRows(model, [["emph_workspace", model.workspace.id || "", "Organisation", before, model.workspace.organisation]], how);
          break;
        }
      // falls through: a note about the organisation is a comment
      default: {
        let activityId: string | null = null;
        if (d.flowId && d.stepCode) activityId = (await loadActivities(this.g, d.flowId)).find(a => a.code === d.stepCode)?.id || null;
        model = await this.addComment(model, { itemId: p.itemId, activityId, activityCode: activityId ? d.stepCode || "" : "", workshopId: p.workshopId, author: "AI analysis, accepted by " + (this.user || "a reviewer"), text, source: quote ? heard : "" });
        rowId = model.comments[model.comments.length - 1]?.id || "";
      }
    }
    const cur = model.proposals.find(x => x.id === p.id) || p;
    return this.decided(model, cur, words != null ? PROPOSAL.edited : PROPOSAL.accepted, { targetRowId: rowId, details: { ...cur.details, ...(words != null ? { edited: words } : {}) } });
  }

  /** A flow step suggestion on our process (copied from Microsoft's reference first when there is none), as the flow studio edits it. */
  private async applyStep(m: Model, p: Proposal, words: string | undefined, how: How, heard: string): Promise<{ model: Model; rowId: string }> {
    const d = p.details, f = d.fields;
    const proc = m.items.find(x => x.id === d.processId);
    if (!proc) throw new Error("That business process is gone.");
    let model = m;
    const both = flowsOf(model, proc.id);
    let ours = both.ours, acts: Activity[];
    if (!ours) {
      const r = await this.createOurFlow(model, proc, both.reference || null, both.reference ? await loadActivities(this.g, both.reference.id) : []);
      model = r.model; ours = r.flow; acts = r.activities;
    } else acts = await loadActivities(this.g, ours.id);
    if (ours.state === FLOW_STATE.confirmed) model = await this.setFlowState(model, ours, FLOW_STATE.draft);
    const rationale = (p.reason ? p.reason + " " : "") + heard;
    if (d.op === "create") {
      const after = acts.find(a => a.code.toLowerCase() === (f.after || "").split(" ")[0].toLowerCase());
      if (!after) throw new Error("Step " + f.after + " is no longer in the flow.");
      const code = nextActivityCode(acts);
      const made = await this.saveActivity({ id: "", flowId: ours.id, code, name: (words ?? f.name).slice(0, 300), shape: SHAPE.activity, lane: f.lane || after.lane, stage: after.stage, links: after.links, summary: f.text || "", delta: DELTA.added, rank: after.rank + 1, rationale, pos: null });
      for (const a of acts.filter(x => x.rank > after.rank)) await this.saveActivity({ ...a, rank: a.rank + 1 });
      await this.saveActivity({ ...after, links: [{ to: code, label: "" }], delta: after.delta === DELTA.same ? DELTA.changed : after.delta });
      model = await this.logRows(model, [["emph_flowactivity", made.id, "Created", "", code + " " + made.name + " after " + after.code]], how);
      return { model, rowId: made.id };
    }
    const a = acts.find(x => x.code === d.stepCode);
    if (!a) throw new Error("Step " + d.stepCode + " is no longer in the flow.");
    if (d.op === "remove") {
      for (const o of acts.filter(x => x.id !== a.id && x.links.some(k => k.to === a.code)))
        await this.saveActivity({ ...o, links: o.links.flatMap(k => (k.to === a.code ? a.links.map(x => ({ to: x.to, label: k.label })) : [k])), delta: o.delta === DELTA.same ? DELTA.changed : o.delta });
      if (a.delta === DELTA.added) await this.dropActivity(a); else await this.saveActivity({ ...a, delta: DELTA.removed, rationale });
      model = await this.logRows(model, [["emph_flowactivity", a.id, "Change", "In the flow", "Dropped: " + a.code + " " + a.name]], how);
      return { model, rowId: a.id };
    }
    const name = (words ?? f.name ?? a.name).slice(0, 300), lane = f.lane || a.lane;
    await this.saveActivity({ ...a, name, lane, delta: a.delta === DELTA.same ? DELTA.changed : a.delta, rationale });
    model = await this.logRows(model, [["emph_flowactivity", a.id, "Name", a.name, name], ["emph_flowactivity", a.id, "Lane", a.lane, lane]], how);
    return { model, rowId: a.id };
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
