# EMPH Process Map for Dynamics 365

Map how your organisation works against the Microsoft Business Process Catalog, inside a Dynamics 365 / Dataverse model-driven app.

You scope the catalog's four levels (end-to-end processes, process areas, business processes and scenarios) with Microsoft's own fields and picklists, decide fit or gap, record the systems used today and what happens to them, read the target products up from the scenarios in scope, adapt Microsoft's reference flows into your own, answer configuration decisions, and capture what standard doesn't cover. Guided workshops collect it with the business; sign-offs freeze it and export to Word, PDF and Excel.

**Try it:** [live demo](https://petermhanna.github.io/emph-process-map/) in your browser, with in-memory data (nothing is saved): [Harbourview Properties](https://petermhanna.github.io/emph-process-map/?sample=realestate), [Lakeside Engineering](https://petermhanna.github.io/emph-process-map/?sample=engineering), [catalog only](https://petermhanna.github.io/emph-process-map/?sample=catalog).

| Folder | What it is |
|---|---|
| [map/](map) | The **process map**: a PCF code component (React 18, Fluent UI 9, React Flow), its Dataverse install script, demo data and solution package |
| [guide/](guide) | The **guide**: a Chrome extension that plays the process flows step by step over live Dynamics 365 pages |
| [docs/](docs) | Install, user guide, architecture and development notes |

## Pages

- **Our processes** (main page): the catalog drawn like Microsoft's documentation. Process areas run left to right with arrows, and their business processes run top to bottom. Set Microsoft's Scope on end-to-end processes and areas (with a reason), tick business processes in or Not applicable, see the target products, and rename any of them to your own wording while Microsoft's name stays visible.
- **Processes**: the catalog tree, levels 1 to 4, with Scope per level and the history of each item. For a business process: Not applicable, Fit gap status with its gap solution approach, owner, workstream lead, subject matter expert, roles, systems today and target products, its scenarios (scope per scenario = the software, our own scenarios on other software), configuration decisions, requirements and its flow.
- **Flow studio**: the Microsoft reference flow next to *our process*, in swimlanes by role. Changes are tracked; confirming asks for a rationale for each one and turns it into a draft requirement.
- **Requirements**: Microsoft's Requirement fields: type, MoSCoW (stored as Microsoft's priority), fit or gap with the gap solution approach, business approval state, acceptance criteria, requirement mapping, source text.
- **Workshops like Microsoft's**: a scenario board, storyline design review or deep-dive made from Microsoft's workshop template (Microsoft workshop type, Success by Design phase, child tasks, key questions with their source), or EMPH's own discovery workshop, all in one order: Prepare, Run the agenda, Analyse, Conclusion, Close. The scenario board sets scope; the storyline review marks fit per step with demo links; a quick track does both in one session; Close writes what the room agreed (with history and undo) and proposes the next workshop in Microsoft's order. Open points become RAID action items.
- **RAID**: Microsoft's Risk, Assumption, Issue, Decision, Action item and Change request, each with its own fields; open questions are action items marked as a question.
- **Sign-off**: freeze, compare with today, approve, export; after approval a change becomes a change request. **Azure Boards import file**: process items, requirements and RAID as work items of Microsoft's ADO template.
- **History**: every change, old → new, how, by whom and when, with restore.
- **Systems** (used today per process area: keep, migrate or retire) and **Settings** (organisation, roles with the licence each needs, suggested from their scenarios, a summary per licence type and a dated price table you keep).

## Microsoft catalog and demos

[map/schema/flows.json](map/schema/flows.json) holds Microsoft's reference process flows for 634 catalog processes, converted by [map/schema/import-flows.py](map/schema/import-flows.py) from [microsoft/dynamics365patternspractices](https://github.com/microsoft/dynamics365patternspractices). Every loaded process gets its reference flow, ready to adapt into *our process*.

[map/schema/import-catalog.py](map/schema/import-catalog.py) converts Microsoft's Business Process Catalog workbook into the four levels the app uses (16 end-to-end processes, about 100 areas, about 700 business processes, 3,870 scenarios). [map/schema/sample-data.js](map/schema/sample-data.js) loads it, either alone or with one of two fictional organisations whose processes point at real catalog IDs:

- **Harbourview Properties**: sells and rents units (Prospect to quote, Rent to return, Order to cash) and maintains them with Dynamics 365 Field Service and Project Operations (Service to deliver, Acquire to dispose, Project to profit). Its unit-maintenance flow is Microsoft's 95.25.100 reference flow adapted with tracked changes.
- **Lakeside Engineering**: project-based installation work.

## Getting started

1. [Install](docs/install.md)
2. [User guide](docs/user-guide.md)
3. [Architecture](docs/architecture.md)
4. [Development](docs/development.md)

## Attribution

The catalog structure, IDs, names and summaries come from the [Microsoft Business Process Catalog](https://learn.microsoft.com/dynamics365/guidance/business-processes/overview) by Microsoft; `map/schema/catalog.json` is converted from Microsoft's October 2026 workbook for the demo site. To use a newer catalog, convert your own download. The reference flows in `map/schema/flows.json` come from [microsoft/dynamics365patternspractices](https://github.com/microsoft/dynamics365patternspractices) by Microsoft, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), converted to this app's format. Microsoft's workshop templates in `map/schema/workshops.json` (agendas, assumptions, roles, objectives, key questions with their source, scenario board areas and cards) are converted by [map/schema/import-workshops.mjs](map/schema/import-workshops.mjs) from the Word templates in the same repository's `workshops` folder, which is licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (LICENSE) and [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (LICENSE-ASSETS); the converted file is shared under CC BY-SA 4.0. The demo organisations, their adapted flow, decisions and requirements are fictional.

## Author

Peter Hanna. All rights reserved unless a license file says otherwise.
