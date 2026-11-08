// Option set values. They must match map/schema/install.js, which creates the choices in the same order.
export const BASE = 582100000;
const set = (...labels: string[]) => Object.fromEntries(labels.map((l, i) => [BASE + i, l])) as Record<number, string>;
const keys = <K extends string>(...k: K[]) => Object.fromEntries(k.map((x, i) => [x, BASE + i])) as Record<K, number>;

export const ORIGIN = keys("catalog", "own");
export const ORIGIN_LABEL = set("Microsoft catalog", "Our own");

export const REVIEW = keys("open", "confirmed", "notUsed");
export const REVIEW_LABEL = set("Not reviewed", "Confirmed", "Not used");

export const DISPOSITION = keys("retain", "transition", "retire", "gap");
export const DISPOSITION_LABEL = set("Retain", "Transition", "Retire", "Gap");

export const APP_CATEGORY_LABEL = set("Finance", "Projects", "Field service", "Supply chain", "Customer service", "Sales", "HR and payroll", "Engineering", "Collaboration", "Analytics", "Other");
export const APP_STATUS = keys("inUse", "planned", "retiring");
export const APP_STATUS_LABEL = set("In use", "Planned", "Retiring");

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

export const MOSCOW_LABEL = set("Must", "Should", "Could", "Won't");
export const CATEGORY_LABEL = set("Functional", "Non-functional", "Integration", "Data", "Reporting", "Compliance");
export const REQ_STATE = keys("draft", "review", "agreed", "rejected", "deferred", "duplicate");
export const REQ_STATE_LABEL = set("Draft", "In review", "Agreed", "Rejected", "Deferred", "Duplicate");
export const COVERAGE = keys("standard", "configuration", "extension", "gap");
export const COVERAGE_LABEL = set("Standard", "Configuration", "Extension", "Gap");
export const SIZE_LABEL = set("XS", "S", "M", "L", "XL");
export const REQ_ORIGIN = keys("captured", "flow", "decision", "scope", "process");
export const REQ_ORIGIN_LABEL = set("Captured", "Flow change", "Configuration decision", "Scope change", "Process decision");

export const SESSION = keys("open", "closed");
export const SIGNOFF = keys("draft", "review", "approved", "superseded");
export const SIGNOFF_LABEL = set("Draft", "In review", "Approved", "Superseded");
export const ITEM = keys("requirement", "flow", "decision", "scope");
export const ITEM_LABEL = set("Requirement", "Process flow", "Configuration decision", "Scope");
export const OUTCOME_LABEL = set("Passed", "Failed", "Blocked");
