// The data the app works with, one interface per table. Names follow the Microsoft Business Process Catalog and Microsoft's
// Azure DevOps template for Dynamics 365 projects: one process item table holds levels 1 to 4
// (end-to-end process > process area > business process > scenario). Choice fields hold the option value (codes.ts).
import type { SessionState } from "./session";

/** A dated list price (per user or device per month) the person enters in Settings, with where it comes from. */
export interface LicencePrice { product: string; kind: PriceKind; price: number; currency: string; validFrom: string; source: string }
export type PriceKind = "Base" | "Attach" | "Team Members" | "Operations - Activity" | "Device";
/** Settings kept as JSON on the workspace row (emph_settings). */
export interface WorkspaceSettings { prices: LicencePrice[] }
export interface Workspace { id: string | null; organisation: string; settings: WorkspaceSettings }

/** A level 1-4 item of the catalog, or our own (Author Project, Catalog status 50 - Custom). */
export interface ProcessItem {
  id: string; level: number; parentId: string | null;
  /** Process sequence ID: Microsoft's catalog ID (80, 80.20, 80.20.010, 80.20.010.100) or our own X-number */
  code: string; name: string; catalogName: string; summary: string; rank: number;
  scope: number | null; scopeReason: string; scopeApproach: string;
  fitGap: number | null; gapApproach: number | null; fitGapReason: string;
  owner: string; workstreamLead: string; sme: string;
  complexity: number | null; priority: number | null; processType: number | null;
  isOwn: boolean; author: number | null; catalogStatus: number | null;
  /** Products (comma separated, Microsoft's names); on a scenario it is the software that runs it */
  products: string;
  /** Software solutions: the software of our own scenario when Products is "Other" (SAP S/4HANA, DATEV) */
  softwareSolution: string;
  setHow: number | null; setBy: string; setOn: string | null; present: string; workshopName: string;
  /** level 1 only: the colour on the map */
  accent: string; comments: string;
}
/** Software the organisation uses today in a process area (or one business process), and what happens to it. */
export interface CurrentSystem { id: string; itemId: string | null; name: string; vendor: string; decision: number | null; retireOn: string | null; users: string; hosting: string; note: string }
export interface Role {
  id: string; name: string; summary: string; rank: number; headcount: number | null;
  responsibleRole?: number | null; licenceType?: number | null; baseProduct?: number | null; attachProducts?: string; licenceNote?: string;
}
/** A remark on a process item, or on one activity of its flow (activityId and activityCode). */
export interface Comment { id: string; itemId: string | null; activityId: string | null; activityCode: string; workshopId: string | null; author: string; text: string; source: string; createdOn: string }
export interface ItemRole { id: string; itemId: string; roleId: string }

export interface FlowLink { to: string; label: string }
/** A flow hangs on a business process (level 3). */
export interface ProcessFlow { id: string; itemId: string; name: string; type: number; state: number; code: string; sourceLink: string; comments: string; referenceId: string | null }
export interface Activity {
  id: string; flowId: string; code: string; name: string; shape: number; lane: string; stage: string; links: FlowLink[];
  summary: string; delta: number; rank: number; rationale?: string; pos?: { x: number; y: number } | null;
}

export interface ConfigDecision {
  id: string; itemId: string | null; product: string; code: string; question: string; answerType: number; choices: string[];
  guidance: string; menuPath: string; steps: string; expected: string; sourceLink: string; sourceLabel: string; rank: number;
  answer: string; state: number; comments: string;
}

/** Microsoft's Requirement work item, plus where it came from (origin) for EMPH's flow and review rules. */
export interface Requirement {
  id: string; reqId: string; name: string; description: string;
  /** the lowest level process item it belongs to */
  itemId: string | null;
  origin: number; originRef: string; originFlowId: string | null; review: boolean;
  type: number | null; fitGap: number | null; gapApproach: number | null; scopeApproach: string; acceptanceCriteria: string; mapping: string;
  priority: number | null; approval: number | null; author: number | null; complexity: number | null; owner: string; approvedBy: string; approvedOn: string | null;
  /** "Deferred", "Duplicate", ... : a closed requirement no longer counts */
  closedReason: string;
  /** where it was heard: source type ("Workshop transcript") and the quoted line */
  sourceType: string; sourceText: string; raisedBy: string;
  workshopId: string | null; evidenceFlowId: string | null;
  /** the flow activity it was raised on, e.g. while walking the flow in a workshop */
  activityId?: string | null;
}
/** Microsoft's Risk, Assumption, Issue, Decision, Action item and Change request. Open questions are action items marked as a question. */
export interface Raid {
  id: string; name: string; type: number; description: string; itemId: string | null; workshopId: string | null; owner: string; priority: number | null; targetDate: string | null;
  status: number; isQuestion: boolean; source: string; resolution: string; decisionMaker: string; createdOn: string;
  /** Risk */ riskImpactAssessment: string; triggers: string; contingencyPlan: string; probability: number | null; impactSeverity: number | null; riskCategory: number | null; riskResponse: number | null;
  /** Issue and Decision */ impact: string; issueType: number | null; severity: number | null; reportedBy: string;
  /** Action item */ responsibleParty: number | null; responsibleRole: number | null;
  /** Change request */ justification: string; impactAssessment: string; alternativeSolution: string; changeRequestType: number | null; requestor: string;
  /** the approved sign-off a change request changes, and the frozen item (type:key) */ signOffId: string | null; frozenKey: string;
}
/** One changed value (emph_history, insert only). Values are as shown: labels for choices, ids for lookups. */
export interface HistoryRow { id: string; table: string; rowId: string; field: string; oldValue: string; newValue: string; how: number | null; by: string; workshopName: string; createdOn: string }
export interface Workshop {
  id: string; name: string; heldOn: string | null; facilitator: string; participants: string; minutes: string; phase: number; status: number; itemId: string | null;
  msType: number | null; sbdPhase: number | null; kind: number | null; order: number | null; units: string; childTasks: string;
  session: SessionState; transcript: string;
}
export interface Screenshot { id: string; subject: string; createdOn: string }
export interface SignOff { id: string; name: string; version: number; scopeNote: string; state: number; approver: string; approvedOn: string | null }

export interface Model {
  workspace: Workspace;
  items: ProcessItem[]; systems: CurrentSystem[]; roles: Role[]; itemRoles: ItemRole[];
  flows: ProcessFlow[]; decisions: ConfigDecision[];
  requirements: Requirement[]; raids: Raid[]; workshops: Workshop[]; signOffs: SignOff[];
  comments: Comment[]; history: HistoryRow[];
}
