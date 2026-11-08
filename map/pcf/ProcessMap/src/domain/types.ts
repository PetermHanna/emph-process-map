// The data the app works with, one interface per table. Names follow the Microsoft Business Process Catalog:
// end-to-end process > process area > business process.
import type { SessionState } from "./session";

export interface Workspace { id: string | null; organisation: string }
export interface EndToEnd { id: string; code: string; name: string; catalogName: string; summary: string; rank: number; inScope: boolean; accent: string }
export interface ProcessArea { id: string; endToEndId: string; code: string; name: string; catalogName: string; summary: string; rank: number; inScope: boolean }
export interface BusinessProcess {
  id: string; areaId: string; code: string; name: string; catalogName: string; summary: string; rank: number; inScope: boolean; origin: number;
  review: number; disposition: number | null; currentAppId: string | null; targetAppId: string | null; ownerRoleId: string | null;
  users: string; comments: string;
}
export interface Application { id: string; name: string; category: number | null; publisher: string; microsoft: boolean; target: boolean; status: number | null; hosting: string; summary: string }
export interface Role { id: string; name: string; summary: string; rank: number; headcount: number | null }
export interface ProcessRole { id: string; processId: string; roleId: string }

export interface FlowLink { to: string; label: string }
export interface ProcessFlow { id: string; processId: string; name: string; type: number; state: number; code: string; sourceLink: string; comments: string; referenceId: string | null }
export interface Activity {
  id: string; flowId: string; code: string; name: string; shape: number; lane: string; stage: string; links: FlowLink[];
  summary: string; delta: number; rank: number; rationale?: string; pos?: { x: number; y: number } | null;
}

export interface ConfigDecision {
  id: string; processId: string | null; appId: string | null; code: string; question: string; answerType: number; choices: string[];
  guidance: string; menuPath: string; steps: string; expected: string; sourceLink: string; sourceLabel: string; rank: number;
  answer: string; state: number; comments: string;
}

export interface Requirement {
  id: string; reqId: string; name: string; description: string; processId: string | null;
  origin: number; originRef: string; originFlowId: string | null; review: boolean;
  moscow: number | null; category: number | null; raisedBy: string; verbatim: string; owner: string; state: number | null;
  coverage: number | null; size: number | null; evidenceFlowId: string | null; resolution: string; resolvedBy: string; resolvedOn: string | null;
  workshopId: string | null; parentId: string | null; duplicateOfId: string | null;
}
export interface Workshop { id: string; name: string; heldOn: string | null; facilitator: string; participants: string; minutes: string; phase: number; status: number; endToEndId: string | null; session: SessionState }
export interface SignOff { id: string; name: string; version: number; scopeNote: string; state: number; approver: string; approvedOn: string | null }

export interface Model {
  workspace: Workspace;
  endToEnds: EndToEnd[]; areas: ProcessArea[]; processes: BusinessProcess[];
  apps: Application[]; roles: Role[]; processRoles: ProcessRole[];
  flows: ProcessFlow[]; decisions: ConfigDecision[];
  requirements: Requirement[]; workshops: Workshop[]; signOffs: SignOff[];
}
