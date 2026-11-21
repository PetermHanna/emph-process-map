# Architecture

```
Dataverse environment
├── App "EMPH Process Map"
│   ├── Process map ─> emph_/open.html ─> workspace record ─> PCF component emph_EMPH.ProcessMap
│   └── Standard forms and views for every emph_ table
└── 16 emph_ tables  <── read and written by the component through context.webAPI

Chrome
└── Guide extension  <── reads emph_processflow, emph_flowactivity and level 1 of emph_processitem, plays them over Dynamics 365 pages
```

## Code

`map/pcf/ProcessMap/`:

| Path | Role |
|---|---|
| `index.ts` | Component entry: creates the Dataverse gateway and renders the shell |
| `src/data/api.ts` | `Gateway` interface and the Dataverse implementation (including `predict`: an AI Builder prompt through Predict); entity set names |
| `src/domain/codes.ts` | Microsoft's picklists (verbatim) and ours; choice value = 582100000 + position |
| `src/domain/types.ts` | One interface per table |
| `src/domain/rules.ts` | The process item tree, scope per level, products read up from scenarios, fit-gap, RAID per type, history restore, licence suggestion and summary, change requests, flow changes, sign-off comparison, with no UI or Dataverse |
| `src/domain/session.ts` | Workshop visits; the transcript (Teams shapes, sentences, signals with negated needs, suggested types, line review); the read-back with the room's answers and close checks; the facilitator's agenda; the meeting request and prep pack |
| `src/domain/drawing.ts` | Lines and comments on a screenshot (kept in the note's text) and on a flow (per workshop and flow, tied to the step they are on) |
| `src/domain/workshop.ts` | Workshops like Microsoft's: kinds, Microsoft workshop type, Success by Design phase and child tasks; the five steps; the agenda with Previous/Next; the scenario board (areas matched to the catalog by name); the storyline review (fit per step, demo links); the quick track; the next workshop in Microsoft's order; the conclusion and what Close writes. No UI or Dataverse |
| `src/ui/guidance.ts` | Bundles `map/schema/workshops.json` (Microsoft's workshop templates) |
| `src/domain/documents.ts` | Excel, Word and PDF export and the Azure Boards import file, with no library |
| `src/domain/repository.ts` | Loads the model and makes every write (and the history rows); saves an AI run and applies an accepted suggestion with How *AI accepted* |
| `src/domain/ai.ts` | AI analysis without UI or Dataverse: the workshop timeline (lines, screenshots and drawings at their moment), the current picture with IDs, the request, the change set (contract `emph-1`) and its guard, suggestions with "already so", review segments, the run log, the question generator's checks |
| `src/domain/aiModels.ts`, `aiFiles.ts` | Prompt names and the model choice with its credit and time estimate; which files go as a file, as text or converted, the Pictures PDF, reading Office files' text |
| `src/ui/aiRun.ts`, `pages/AiAnalyse.tsx`, `AiReview.tsx`, `AiQuestions.tsx` | One run in the browser (canvas, files, the calls), the Analyse panel, the review by segment, the question generator |
| `src/ui/Shell.tsx`, `look.ts`, `kit.tsx` | Navigation rail, theme and shared controls |
| `src/ui/pages/*` | One file per page |
| `src/ui/flow/*` | Flow studio and the swimlane canvas engine |

Rules modules have no React or Dataverse, so the tests run them directly.

## Data model

Version 2 follows Microsoft's Azure DevOps template for Dynamics 365 projects: one process item table for catalog levels 1 to 4, Microsoft's field names, and Microsoft's picklists exactly as the template workbook ("ADO template guidelines - OCT 2026", sheet Picklists). Every choice value is 582100000 + the label's position in its list. `src/domain/codes.ts` holds the lists (`MS_PICKLISTS` for Microsoft's, `OURS` for EMPH's own); `install.js` and `sample-data.js` carry copies, and the unit tests check that all three match (and, where the Business Map project sits next to this one, that `MS_PICKLISTS` matches its `msTemplate.ts`).

### Catalog and organisation

| Table | Purpose | Main columns |
|---|---|---|
| `emph_workspace` | Hosts the component | Organisation, HostData, Settings (JSON: the licence price table) |
| `emph_processitem` | Catalog level 1-4 (End to end, Process area, Process, Scenario) or our own (X001…) | Level, CatalogCode (Process sequence ID), CatalogName (Microsoft's name, kept when renamed), Rank, Description, **Scope** (10 - Unspecified, 20 - In scope, 30 - Out of scope, 40 - Not applicable), Scope reason, Scope approach, **Fit gap status** (Fit, Gap, Unspecified), **Gap solution approach** (10 - Unspecified … 70 - ISV Extension; required for a Gap), Fit gap rationale, Business process owner, Workstream lead, Subject matter expert, Baseline complexity, Priority (1-5), Process type, IsOwn, Author (Project for our own), Catalog status (50 - Custom for our own), **Products** (on a scenario: the software that runs it), Software solutions (our own scenario on other software, Products *Other*), Set how / by / on, Present, Agreed in workshop, Accent (level 1), Comments, → Parent |
| `emph_system` | Software used today in a process area (or one business process) | Vendor, Decision (Keep, Migrate, Retire), Retire on, Users, Hosting, Note, → Item |
| `emph_role` | Lane in flows, with headcount and licence | Summary, Rank, Headcount, Responsible role (Microsoft's list), Licence type (Full, Team Members, Operations - Activity, Device, None), Base product, Attach products, Note (quoted transcript lines) |
| `emph_itemrole` | Role involved in a process item | → Item, → Role |

Scope per level follows Business Map's decision 1: end-to-end processes, process areas and scenarios take all four Scope values; a business process (level 3) takes fit/gap instead, so its Scope is only 10 - Unspecified or 40 - Not applicable. Fit gap status and Gap solution approach are set on levels 3 and 4 only. An item counts as in scope when it and every item above it count as in: levels 1, 2 and 4 at 20 - In scope, a business process when not Not applicable. An end-to-end process or area out of scope, not applicable or not decided greys everything below it. The target is not a list of applications: it is the **products of the scenarios in scope** (for our own scenario on other software, its Software solutions), read up to business processes, areas and end-to-end processes. A business process without its own fit-gap reads it up from its scenarios in scope.

Licences per role (as Business Map's C7): the role's items (`emph_itemrole`) → the scenarios in scope below them → their Dynamics 365 products → Full with the highest priced product as base (from the price table in workspace Settings) and the others attached; no product = None.

### Flows and decisions

| Table | Purpose | Main columns |
|---|---|---|
| `emph_processflow` | Flow of a business process (level 3) | FlowType (Microsoft reference, Our process), State (Draft, Confirmed), CatalogCode, SourceLink, → Item, → ReferenceFlow |
| `emph_flowactivity` | Activity in a flow | ActivityCode, Shape (Start, Activity, Decision, End, Subprocess), Lane, Links (JSON), Delta (Unchanged, Added, Changed, Dropped), Rationale, X, Y, guide fields (ScreenPath, ScreenTarget, Narration, SampleValue…) |
| `emph_configdecision` | Configuration question and its answer | Code, Product, AnswerType, Choices, Guidance, MenuPath, Answer, State (Open, Decided), → Item |

### Fit-gap, workshops and sign-off

| Table | Purpose | Main columns |
|---|---|---|
| `emph_requirement` | Microsoft's Requirement work item | ReqId (RQ-00001), Description, Requirement type (Functional … Compliance, Business rule), Fit gap status, Gap solution approach, Scope approach, Acceptance criteria, Requirement mapping, Priority (1-5; MoSCoW on screen: Must 1, Should 2, Could 3, Won't 4), Business approval state (New, Ready for review, In review, Approved, Rejected), Author, Estimated complexity, Owner, Approved by / on, Closed reason, Source type, Source text (the quoted line), Raised by, Origin, Origin reference, Needs review, → Item (lowest level), → FlowActivity, → Workshop, → OriginFlow, → EvidenceFlow |
| `emph_raid` | Microsoft's Risk, Assumption, Issue, Decision, Action item, Change request | Type, Description, Owner, Priority, Target date, Status (Open, In progress, Closed for most types; Proposed, Decided, Withdrawn for decisions and change requests), Open question, Source text, and Microsoft's fields per type (risk impact assessment, triggers, contingency plan, probability, impact severity, risk category and response; issue type, severity, reported by; decision maker, impact, resolution; responsible party and role; change request type, requestor, justification, impact assessment, alternative solution), Signed-off item (the frozen item a change request changes), → Item, → Workshop, → SignOff |
| `emph_history` | One row per changed value, insert only | Table, Row, Field, Old value, New value, How (Workshop, Direct, Migration, Proposal, Restore), By, Agreed in workshop, Created on |
| `emph_proposal` | A change suggested by the AI analysis, waiting for a person | Table, Row, Field, Current value, Proposed value, Quotes (JSON), Source (Transcript, Screenshot, Document, Drawing), Status (Suggested, Accepted, Edited, Rejected), Reason, Decided by / on, AI run, Confidence, Details (JSON: the change-set item), → Item, → Workshop |
| `emph_comment` | A remark on a process item or one of its flow activities | ActivityCode, Author, Text, Source (quoted transcript line), → Item, → FlowActivity, → Workshop |
| `emph_workshop` | Workshop; screenshots are notes on it | HeldOn, Facilitator, Participants, Phase, Status, Microsoft workshop type (Storyboard, Storyline design review, Detailed design, FastTrack), Success by Design phase, Kind, Session order, Units, Child tasks (JSON: Microsoft's task ID, title, done), SessionData (JSON: business processes, visits, transcript start, captured lines (by quoted line), `review` (each transcript line's review: accepted or not relevant, type, edited words), `readBack` (the room's answer per read-back line, who confirmed), and `run`: kind, template, unit, agenda lines with their tools, lines walked, quick track, card marks, scope and fit-gap proposals, step fits, main path, answers, verdicts, present, what Close wrote), Transcript, Drawings (JSON: per flow id, the lines and comments drawn on it in this workshop), → Item (end-to-end process). A screenshot note's text holds its marks after a `--- marks ---` line. Phase holds the step: 0 Prepare, 1 Run the agenda, 2 Analyse, 3 Conclusion, 4 Close |
| `emph_signoff` | Frozen, approved version | Version, State (Draft, In review, Approved, Superseded), ApprovedOn, → Approver |
| `emph_signoffitem` | Frozen copy of one item | ItemType, ItemKey, Snapshot (JSON), → SignOff |

Microsoft's workshop templates are not a table: `map/schema/workshops.json` is bundled with the component (converted by `map/schema/import-workshops.mjs`). Demo links of the storyline review live in the workspace settings JSON (`demoLinks`). A workshop's proposals (scope, struck cards, fit-gap) stay in its session until Close writes the agreed ones to the process items; the values before are kept in the session for undo.

A workshop's open points are RAID **Action items** (marked as a question when the line asks one). The fields in `HISTORY_FIELDS` (rules.ts) each write an `emph_history` row when they change: on process items name, scope, scope reason, fit-gap, gap solution approach, rationale, products, software solutions, owners, complexity and priority; on requirements description, fit-gap, gap solution approach, priority, approval, process item, owner, acceptance criteria and mapping. Values are stored as shown (labels for choices), so restoring maps a label back to its choice value; a restore writes a new row with How *Restore*. Scope and fit-gap changes also set Set how / by / on on the item (Workshop when made in a workshop). After a sign-off is approved, a change to what it froze can be raised as a Change request linked to that sign-off and the frozen item.

## How "our process" works

Our process starts as a copy of the Microsoft reference (or from a blank Start and End). Each edit marks the activity Added, Changed or Dropped. Confirming compares it with the reference, leaving out activities whose only change is being rewired around an added or dropped neighbour. It asks for a rationale or a linked requirement for each real change; rationales become draft requirements with origin "Flow change". Going back to the reference deletes our flow and its generated requirements, and flags hand-captured ones for review.
