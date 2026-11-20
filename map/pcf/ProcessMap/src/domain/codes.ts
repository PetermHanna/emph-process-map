// Option set values. They must match map/schema/install.js, which creates the choices in the same order:
// every choice value is 582100000 + the label's position in its list.
//
// MS_PICKLISTS are Microsoft's Azure DevOps template for Dynamics 365 projects (ADO template guidelines - OCT 2026.xlsx,
// sheet "Picklists"), names and values exactly as the workbook, in its order. harness/rules.test.mjs compares them with
// Elevion Business Map's msTemplate.ts, which is checked against the workbook. The other lists are EMPH's own.
export const BASE = 582100000;
const set = (...labels: string[]) => Object.fromEntries(labels.map((l, i) => [BASE + i, l])) as Record<number, string>;
const keys = <K extends string>(...k: K[]) => Object.fromEntries(k.map((x, i) => [x, BASE + i])) as Record<K, number>;

export const MS_PICKLISTS = {
  /** Workbook column "Application family" */
  applicationFamily: ["Azure", "Business Central", "Customer Engagement", "Finance and Operations", "Power Platform", "Productivity"],
  /** Workbook column "Baseline complexity" */
  baselineComplexity: ["L - Large", "M - Medium", "S - Small", "XL - Extra Large", "XS - Extra Small"],
  /** Workbook column "Catalog status" */
  catalogStatus: ["10 - New", "20 - Review", "30 - Updated", "40 - Published", "50 - Custom", "60 - Deprecated", "65 - Deprecated (final)", "70 - Deleted"],
  /** Workbook column "Fit gap status" */
  fitGapStatus: ["Fit", "Gap", "Unspecified"],
  /** Workbook column "Gap solution approach" */
  gapSolutionApproach: ["10 - Unspecified", "20 - Personalization", "30 - Power Platform", "40 - Java/Plug-in", "50 - X++ Extension", "60 - ISV", "70 - ISV Extension"],
  /** Workbook column "Priority" */
  priority: ["1", "2", "3", "4", "5"],
  /** Workbook column "Products" */
  products: ["Agent 365", "Azure", "Business Central", "Commerce", "Contact Center", "Microsoft Copilot Studio", "Customer Insights", "Customer Insights Data", "Customer Insights Journey", "Customer Service", "Customer Voice", "Field Service", "Finance", "Fraud Protection", "Guides", "Human Resources", "Microsoft 365", "Microsoft Cloud for Sustainability", "Other", "Power Apps", "Power Automate", "Power BI", "Power Pages", "Project", "Project Operations", "Remote Assist", "Sales", "Sales Copilot", "SharePoint", "Supply Chain Management", "Teams"],
  /** Workbook column "Scope" */
  scope: ["10 - Unspecified", "20 - In scope", "30 - Out of scope", "40 - Not applicable"],
  /** Workbook column "Success by Design phase" */
  sbdPhase: ["10 - Strategize", "20 - Initiate", "31 - Implement - Analysis", "32 - Implement - Design", "33 - Implement - Development", "34 - Implement - Test", "45 - Prepare - Train", "49 - Prepare - Cutover", "50 - Operate"],
  /** Workbook column "Responsible party" */
  responsibleParty: ["Customer", "Partner"],
  /** Workbook column "Role type" */
  roleType: ["Functional", "Governance", "Technical"],
  /** Workbook column "Responsible role" */
  responsibleRole: ["Application Administrator", "Build Manager", "Business Analyst", "Business Architect", "Business Change Leads", "Business Lead", "Business Process Owner", "Business Subject Matter Experts (SME)", "Business Unit Sponsors", "Change Management Lead", "Communications Lead", "Compliance Manager", "Data Architect", "Data Migration Analyst", "Data Migration Lead", "Database Administrator", "Delivery Lead", "Deployment Lead", "Developer", "Development Lead", "Enterprise Architect", "Executive - Business (CEO/CFO/COO)", "Executive - Technology (VP/Director/CTO/CIO)", "Executive Sponsor", "Infrastructure Lead", "Integration Analyst", "Integration Architect", "Integration Lead", "Network Administrator", "Program Manager", "Project Manager", "Project Sponsor", "Quality Analyst", "Reporting Analyst", "Reporting Lead", "Security Administrator", "Security Analyst", "Security Developer", "Security Lead", "Solution Architect", "Solution Manager", "Solution Specialist", "Support Analyst", "Support Manager", "Technical Architect", "Testing Lead", "Trainer", "Training Lead", "UX Designer", "Workflow Analyst", "Workflow Lead"],
  /** Workbook column "Estimated complexity" */
  estimatedComplexity: ["L - Large", "M - Medium", "S - Small", "XL - Extra Large", "XS - Extra Small"],
  /** Workbook column "Estimated project impact" */
  estimatedProjectImpact: ["Critical", "High", "Low", "Medium"],
  /** Workbook column "Microsoft workshop type" */
  microsoftWorkshopType: ["Storyboard", "Storyline design review", "Detailed design", "FastTrack"],
  /** Workbook column "Severity" */
  severity: ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"],
  /** Workbook column "Issue type" */
  issueType: ["Budget", "General", "Resource", "Scope", "Timeline"],
  /** Workbook column "Impact severity" */
  impactSeverity: ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"],
  /** Workbook column "Risk category" */
  riskCategory: ["External", "Functional", "Management", "Organizational", "Technical"],
  /** Workbook column "Risk response" */
  riskResponse: ["Accept", "Avoid", "Mitigate", "Transfer"],
  /** Workbook column "Change request type" */
  changeRequestType: ["Design Change", "Estimation Change", "Scope Change"],
  /** Workbook column "Author" */
  author: ["Microsoft", "Partner", "Project"],
  /** Workbook column "Business approval state" */
  businessApprovalState: ["New", "Ready for review", "In review", "Approved", "Rejected"],
  /** Workbook column "Process type" */
  processType: ["Setup", "Master data", "Transactional", "Analytical", "Governance"],
} as const;
export type MsPicklist = keyof typeof MS_PICKLISTS;
export type MsValue<K extends MsPicklist> = (typeof MS_PICKLISTS)[K][number];

/** EMPH's own lists (not Microsoft's). The same position rule applies. */
export const OURS = {
  setHow: ["Workshop", "Direct", "Migration", "Proposal", "Restore", "AI accepted"],
  systemDecision: ["Keep", "Migrate", "Retire"],
  raidType: ["Risk", "Assumption", "Issue", "Decision", "Action item", "Change request"],
  raidStatus: ["Open", "In progress", "Closed", "Proposed", "Decided", "Withdrawn"],
  requirementType: ["Functional", "Non-functional", "Integration", "Data", "Reporting", "Compliance", "Business rule"],
  licenceType: ["Full", "Team Members", "Operations - Activity", "Device", "None"],
  requirementOrigin: ["Captured", "Flow change", "Configuration decision", "Scope change", "Process decision"],
  workshopKind: ["Discovery", "Scenario board", "Storyline review", "Deep dive"],
  proposalStatus: ["Suggested", "Accepted", "Edited", "Rejected"],
  proposalSource: ["Transcript", "Screenshot", "Document", "Drawing"],
  aiConfidence: ["High", "Medium", "Low"],
} as const;
export type OurList = keyof typeof OURS;
export type ListName = MsPicklist | OurList;
export const listOf = (n: ListName): readonly string[] => (n in OURS ? (OURS as any)[n] : (MS_PICKLISTS as any)[n]);

/** Choice value of a label (its position in the list), or null when it is not in the list. */
export function option(list: ListName, value: string | null | undefined): number | null {
  const i = listOf(list).indexOf(String(value ?? ""));
  return i < 0 ? null : BASE + i;
}
/** Choice value of a label that must be in the list (the app's own constants). */
const must = (list: ListName, value: string): number => { const v = option(list, value); if (v == null) throw new Error(value + " is not in " + list); return v; };
/** The label of a choice value, or "" when it is not one of the list's options. */
export function labelOf(list: ListName, v: number | null | undefined): string {
  const all = listOf(list);
  return typeof v === "number" && v >= BASE && v < BASE + all.length ? all[v - BASE] : "";
}
/** value -> label, for the Choice drop-down. */
export const labels = (list: ListName): Record<number, string> => set(...listOf(list));

// The values the app names in its rules.
export const SCOPE = { unspecified: must("scope", "10 - Unspecified"), in: must("scope", "20 - In scope"), out: must("scope", "30 - Out of scope"), na: must("scope", "40 - Not applicable") };
export const FIT_GAP = { fit: must("fitGapStatus", "Fit"), gap: must("fitGapStatus", "Gap"), unspecified: must("fitGapStatus", "Unspecified") };
export const GAP_UNSPECIFIED = must("gapSolutionApproach", "10 - Unspecified");
export const APPROVAL = { new: must("businessApprovalState", "New"), ready: must("businessApprovalState", "Ready for review"), inReview: must("businessApprovalState", "In review"),
  approved: must("businessApprovalState", "Approved"), rejected: must("businessApprovalState", "Rejected") };
export const CATALOG_CUSTOM = must("catalogStatus", "50 - Custom");
export const AUTHOR = { microsoft: must("author", "Microsoft"), partner: must("author", "Partner"), project: must("author", "Project") };
export const SYSTEM = { keep: must("systemDecision", "Keep"), migrate: must("systemDecision", "Migrate"), retire: must("systemDecision", "Retire") };
export const RAID = { risk: must("raidType", "Risk"), assumption: must("raidType", "Assumption"), issue: must("raidType", "Issue"), decision: must("raidType", "Decision"), action: must("raidType", "Action item"), change: must("raidType", "Change request") };
export const RAID_STATUS = { open: must("raidStatus", "Open"), progress: must("raidStatus", "In progress"), closed: must("raidStatus", "Closed"),
  proposed: must("raidStatus", "Proposed"), decided: must("raidStatus", "Decided"), withdrawn: must("raidStatus", "Withdrawn") };
export const HOW = { workshop: must("setHow", "Workshop"), direct: must("setHow", "Direct"), migration: must("setHow", "Migration"), proposal: must("setHow", "Proposal"), restore: must("setHow", "Restore"), ai: must("setHow", "AI accepted") };
export const PROPOSAL = { suggested: must("proposalStatus", "Suggested"), accepted: must("proposalStatus", "Accepted"), edited: must("proposalStatus", "Edited"), rejected: must("proposalStatus", "Rejected") };
export const PROPOSAL_SOURCE = { transcript: must("proposalSource", "Transcript"), screenshot: must("proposalSource", "Screenshot"), document: must("proposalSource", "Document"), drawing: must("proposalSource", "Drawing") };
export const AI_CONFIDENCE = { high: must("aiConfidence", "High"), medium: must("aiConfidence", "Medium"), low: must("aiConfidence", "Low") };
export const LICENCE = { full: must("licenceType", "Full"), teamMembers: must("licenceType", "Team Members"), activity: must("licenceType", "Operations - Activity"), device: must("licenceType", "Device"), none: must("licenceType", "None") };
export const LICENCE_LABEL = labels("licenceType");
export const PRODUCT_OTHER = must("products", "Other");
export const REQ_ORIGIN = keys("captured", "flow", "decision", "scope", "process");
export const REQ_ORIGIN_LABEL = labels("requirementOrigin");
export const REQ_TYPE_LABEL = labels("requirementType");
export const WORKSHOP_KIND = { discovery: must("workshopKind", "Discovery") };

/** MoSCoW on screen, Microsoft's priority stored: Must = 1, Should = 2, Could = 3, Won't = 4 (5 shows as "5"). */
export const MOSCOW_LABEL: Record<number, string> = { [must("priority", "1")]: "Must", [must("priority", "2")]: "Should", [must("priority", "3")]: "Could", [must("priority", "4")]: "Won't" };
export const moscowOf = (priority: number | null | undefined) => (priority == null ? "" : MOSCOW_LABEL[priority] || labelOf("priority", priority));
/** Microsoft's level names. */
export const LEVEL_LABEL: Record<number, string> = { 1: "End-to-end process", 2: "Process area", 3: "Business process", 4: "Scenario" };

export const FLOW_TYPE = keys("reference", "ours");
export const FLOW_TYPE_LABEL = set("Microsoft reference", "Our process");
export const FLOW_STATE = keys("draft", "confirmed");
export const FLOW_STATE_LABEL = set("Draft", "Confirmed");

export const SHAPE = keys("start", "activity", "decision", "end", "subprocess");
export const SHAPE_LABEL = set("Start", "Activity", "Decision", "End", "Subprocess");
export const DELTA = keys("same", "added", "changed", "removed");

export const ANSWER = keys("choice", "multi", "yesno", "number", "text", "list");
export const ANSWER_LABEL = set("Choice", "Multiple choice", "Yes or no", "Number", "Text", "List");
export const DECISION_STATE = keys("open", "decided");

export const SESSION = keys("open", "closed");
export const SIGNOFF = keys("draft", "review", "approved", "superseded");
export const SIGNOFF_LABEL = set("Draft", "In review", "Approved", "Superseded");
export const ITEM = keys("requirement", "flow", "decision", "scope");
export const ITEM_LABEL = set("Requirement", "Process flow", "Configuration decision", "Scope");
