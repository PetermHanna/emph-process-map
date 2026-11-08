# Architecture

```
Dataverse environment
├── App "EMPH Process Map"
│   ├── Process map ─> emph_/open.html ─> workspace record ─> PCF component emph_EMPH.ProcessMap
│   └── Standard forms and views for every emph_ table
└── 17 emph_ tables  <── read and written by the component through context.webAPI

Chrome
└── Guide extension  <── reads emph_processflow and emph_flowactivity, plays them over Dynamics 365 pages
```

## Code

`map/pcf/ProcessMap/`:

| Path | Role |
|---|---|
| `index.ts` | Component entry: creates the Dataverse gateway and renders the shell |
| `src/data/api.ts` | `Gateway` interface and the Dataverse implementation; entity set names |
| `src/domain/codes.ts` | Choice values (from 582100000) and their labels |
| `src/domain/types.ts` | One interface per table |
| `src/domain/rules.ts` | Coverage, flow changes, sign-off comparison and other rules, with no UI or Dataverse |
| `src/domain/session.ts` | Workshop phases, visits and the read-back summary |
| `src/domain/documents.ts` | Excel, Word and PDF export, with no library |
| `src/domain/repository.ts` | Loads the model and makes every write |
| `src/ui/Shell.tsx`, `look.ts`, `kit.tsx` | Navigation rail, theme and shared controls |
| `src/ui/pages/*` | One file per page |
| `src/ui/flow/*` | Flow studio and the swimlane canvas engine |

Rules modules have no React or Dataverse, so the tests run them directly.

## Data model

Choice values start at 582100000, in the order listed.

### Catalog

| Table | Purpose | Main columns |
|---|---|---|
| `emph_workspace` | Hosts the component | Organisation, HostData, Settings |
| `emph_endtoendprocess` | Catalog level 1, e.g. Order to cash | CatalogCode, CatalogName (Microsoft's name, kept when renamed), Rank, InScope, Summary, Accent |
| `emph_processarea` | Catalog level 2 | CatalogCode, CatalogName, Rank, InScope, Summary, → EndToEndProcess |
| `emph_businessprocess` | Catalog level 3, or our own (X001…) | CatalogCode, CatalogName, InScope, Origin (Microsoft catalog, Our own), ReviewState (Not reviewed, Confirmed, Not used), Disposition (Retain, Transition, Retire, Gap), UserCount, Comments, → ProcessArea, → CurrentApplication, → TargetApplication, → ProcessOwner |
| `emph_application` | Application in use or planned | Category, Publisher, IsMicrosoft, IsTarget, Status (In use, Planned, Retiring) |
| `emph_role` | Lane in flows, process owner | Summary, Rank, Headcount |
| `emph_processrole` | Role involved in a business process | → BusinessProcess, → Role |

### Flows and decisions

| Table | Purpose | Main columns |
|---|---|---|
| `emph_processflow` | Flow of a business process | FlowType (Microsoft reference, Our process), State (Draft, Confirmed), CatalogCode, SourceLink, → BusinessProcess, → ReferenceFlow |
| `emph_flowactivity` | Activity in a flow | ActivityCode, Shape (Start, Activity, Decision, End, Subprocess), Lane, Links (JSON), Delta (Unchanged, Added, Changed, Dropped), Rationale, X, Y, guide fields (ScreenPath, ScreenTarget, Narration, SampleValue…) |
| `emph_configdecision` | Configuration question and its answer | Code, AnswerType, Choices, Guidance, MenuPath, Answer, State (Open, Decided), → BusinessProcess, → Application |

### Fit-gap

| Table | Purpose | Main columns |
|---|---|---|
| `emph_requirement` | A need standard may not cover | ReqId (RQ-00001), Description, Moscow, Category, State, Coverage (Standard, Configuration, Extension, Gap), Size, Owner, Resolution, Origin, Review, → BusinessProcess, → Workshop, → OriginFlow, → EvidenceFlow |
| `emph_workshop` | Discovery session | HeldOn, Facilitator, Participants, Phase, Status, SessionData (JSON), → EndToEndProcess |
| `emph_signoff` | Frozen, approved version | Version, State (Draft, In review, Approved, Superseded), ApprovedOn, → Approver |
| `emph_signoffitem` | Frozen copy of one item | ItemType, ItemKey, Snapshot (JSON), → SignOff |
| `emph_requirementlink` | Link to a work item or guided flow | LinkType, Target, Url |
| `emph_testrun` | Test of a requirement | Outcome (Passed, Failed, Blocked), Evidence |
| `emph_reviewnote` | Reviewer note | Author, Note, State |

## How "our process" works

Our process starts as a copy of the Microsoft reference (or from a blank Start and End). Each edit marks the activity Added, Changed or Dropped. Confirming compares it with the reference, leaving out activities whose only change is being rewired around an added or dropped neighbour. It asks for a rationale or a linked requirement for each real change; rationales become draft requirements with origin "Flow change". Going back to the reference deletes our flow and its generated requirements, and flags hand-captured ones for review.
