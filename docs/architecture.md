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
| `src/data/api.ts` | `Gateway` interface and the Dataverse implementation; entity set names |
| `src/domain/codes.ts` | Microsoft's picklists (verbatim) and ours; choice value = 582100000 + position |
| `src/domain/types.ts` | One interface per table |
| `src/domain/rules.ts` | The process item tree, scope, products read up from scenarios, fit-gap, flow changes, sign-off comparison, with no UI or Dataverse |
| `src/domain/session.ts` | Workshop phases, visits and the read-back summary |
| `src/domain/documents.ts` | Excel, Word and PDF export, with no library |
| `src/domain/repository.ts` | Loads the model and makes every write (and the history rows) |
| `src/ui/Shell.tsx`, `look.ts`, `kit.tsx` | Navigation rail, theme and shared controls |
| `src/ui/pages/*` | One file per page |
| `src/ui/flow/*` | Flow studio and the swimlane canvas engine |

Rules modules have no React or Dataverse, so the tests run them directly.

## Data model

Version 2 follows Microsoft's Azure DevOps template for Dynamics 365 projects: one process item table for catalog levels 1 to 4, Microsoft's field names, and Microsoft's picklists exactly as the template workbook ("ADO template guidelines - OCT 2026", sheet Picklists). Every choice value is 582100000 + the label's position in its list. `src/domain/codes.ts` holds the lists (`MS_PICKLISTS` for Microsoft's, `OURS` for EMPH's own); `install.js` and `sample-data.js` carry copies, and the unit tests check that all three match (and, where the Business Map project sits next to this one, that `MS_PICKLISTS` matches its `msTemplate.ts`).

### Catalog and organisation

| Table | Purpose | Main columns |
|---|---|---|
| `emph_workspace` | Hosts the component | Organisation, HostData, Settings |
| `emph_processitem` | Catalog level 1-4 (End to end, Process area, Process, Scenario) or our own (X001…) | Level, CatalogCode (Process sequence ID), CatalogName (Microsoft's name, kept when renamed), Rank, Description, **Scope** (10 - Unspecified, 20 - In scope, 30 - Out of scope, 40 - Not applicable), Scope reason, Scope approach, **Fit gap status** (Fit, Gap, Unspecified), **Gap solution approach** (10 - Unspecified … 70 - ISV Extension; required for a Gap), Fit gap rationale, Business process owner, Workstream lead, Subject matter expert, Baseline complexity, Priority (1-5), Process type, IsOwn, Author (Project for our own), Catalog status (50 - Custom for our own), **Products** (on a scenario: the software that runs it), Set how / by / on, Present, Agreed in workshop, Accent (level 1), Comments, → Parent |
| `emph_system` | Software used today in a process area (or one business process) | Vendor, Decision (Keep, Migrate, Retire), Retire on, Users, Hosting, Note, → Item |
| `emph_role` | Lane in flows, with headcount and licence | Summary, Rank, Headcount, Responsible role (Microsoft's list), Licence type (Full, Team Members, Operations - Activity, Device, None), Base product, Attach products, Note (quoted transcript lines) |
| `emph_itemrole` | Role involved in a process item | → Item, → Role |

Scope counts only when the item and every item above it are 20 - In scope: an area out of scope greys its business processes and scenarios. The target is not a list of applications: it is the **products of the scenarios in scope**, read up to business processes, areas and end-to-end processes.

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
| `emph_raid` | Microsoft's Risk, Assumption, Issue, Decision, Action item, Change request | Type, Description, Owner, Priority, Target date, Status (Open, In progress, Closed), Open question, Source text, and Microsoft's fields per type (risk impact, probability, impact severity, risk category and response, decision maker, issue type, responsible party and role, change request type, justification…), → Item, → Workshop |
| `emph_history` | One row per changed value, insert only | Table, Row, Field, Old value, New value, How (Workshop, Direct, Migration, Proposal), By, Agreed in workshop |
| `emph_proposal` | A suggested change waiting for a person (AI analysis, later) | Table, Row, Field, Current value, Proposed value, Quotes, Source, Status (Proposed, Accepted, Edited, Rejected), Reason, Decided by / on, → Item, → Workshop |
| `emph_comment` | A remark on a process item or one of its flow activities | ActivityCode, Author, Text, Source (quoted transcript line), → Item, → FlowActivity, → Workshop |
| `emph_workshop` | Workshop; screenshots are notes on it | HeldOn, Facilitator, Participants, Phase, Status, Microsoft workshop type (Storyboard, Storyline design review, Detailed design, FastTrack), Success by Design phase, Kind, Session order, Units, Child tasks (JSON), SessionData (JSON: agenda, visits, transcript start, captured lines), Transcript, → Item (end-to-end process) |
| `emph_signoff` | Frozen, approved version | Version, State (Draft, In review, Approved, Superseded), ApprovedOn, → Approver |
| `emph_signoffitem` | Frozen copy of one item | ItemType, ItemKey, Snapshot (JSON), → SignOff |

A workshop's open points are RAID **Action items** (marked as a question when the line asks one). Changes to scope, fit-gap, products, owner and name on process items, and to description, fit-gap, priority, approval and item on requirements, each write an `emph_history` row; scope and fit-gap changes also set Set how / by / on on the item (Workshop when made in a workshop).

## How "our process" works

Our process starts as a copy of the Microsoft reference (or from a blank Start and End). Each edit marks the activity Added, Changed or Dropped. Confirming compares it with the reference, leaving out activities whose only change is being rewired around an added or dropped neighbour. It asks for a rationale or a linked requirement for each real change; rationales become draft requirements with origin "Flow change". Going back to the reference deletes our flow and its generated requirements, and flags hand-captured ones for review.
