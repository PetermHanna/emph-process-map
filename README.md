# EMPH Process Map for Dynamics 365

Map how your organisation works against the Microsoft Business Process Catalog, inside a Dynamics 365 / Dataverse model-driven app.

You scope end-to-end processes, process areas and business processes, record who owns each one and in which application it runs today and tomorrow, adapt Microsoft's reference flows into your own, answer configuration decisions, and capture what standard doesn't cover. Guided workshops collect it with the business; sign-offs freeze it and export to Word, PDF and Excel.

| Folder | What it is |
|---|---|
| [map/](map) | The **process map**: a PCF code component (React 18, Fluent UI 9, React Flow), its Dataverse install script, demo data and solution package |
| [guide/](guide) | The **guide**: a Chrome extension that plays the process flows step by step over live Dynamics 365 pages |
| [docs/](docs) | Install, user guide, architecture and development notes |

## Pages

- **Overview**: scope and progress for each end-to-end process.
- **Processes**: the catalog tree. For a business process: scope, review state, disposition (retain, transition, retire, gap), owner, applications today and target, roles, configuration decisions, requirements and its flow.
- **Flow studio**: the Microsoft reference flow next to *our process*, in swimlanes by role. Changes are tracked; confirming asks for a rationale for each one and turns it into a draft requirement.
- **Requirements**: MoSCoW priority, category, coverage by standard (standard, configuration, extension, gap), size, owner and resolution.
- **Workshops**: seven phases: prepare, scope, walk-through, process flow, configuration, fit-gap, summary.
- **Sign-off**: freeze, compare with today, approve, export.
- **Applications** and **Settings** (organisation and roles).

## Microsoft catalog and demos

[map/schema/import-catalog.py](map/schema/import-catalog.py) converts Microsoft's Business Process Catalog workbook into the three levels the app uses (16 end-to-end processes, about 100 areas, about 700 business processes). [map/schema/sample-data.js](map/schema/sample-data.js) loads it, either alone or with one of two fictional organisations whose processes point at real catalog IDs:

- **Harbourview Properties**: sells and rents units (Prospect to quote, Rent to return, Order to cash) and maintains them with Dynamics 365 Field Service and Project Operations (Service to deliver, Acquire to dispose, Project to profit).
- **Lakeside Engineering**: project-based installation work.

## Getting started

1. [Install](docs/install.md)
2. [User guide](docs/user-guide.md)
3. [Architecture](docs/architecture.md)
4. [Development](docs/development.md)

## Attribution

The catalog structure and IDs come from the [Microsoft Business Process Catalog](https://learn.microsoft.com/dynamics365/guidance/business-processes/overview); its text is not stored in this repository, you convert your own download. The demo organisations, flows, decisions and requirements are fictional.

## Author

Peter Hanna. All rights reserved unless a license file says otherwise.
