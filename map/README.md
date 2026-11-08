# Process map component (PCF, Dataverse)

- `pcf/ProcessMap/`: the component. `index.ts` is the entry; the code is in `src/` (see [architecture](../docs/architecture.md)).
- `schema/install.js`: creates the tables, forms, views, app and pages. `schema/sample-data.js`: the two demos.
- `sol/`: unmanaged solution `EMPHProcessMap` holding the component.
- `harness/`: unit tests and the local test page.
- `build.ps1`, `package.py`: build and package.

See [install](../docs/install.md) and [development](../docs/development.md).
