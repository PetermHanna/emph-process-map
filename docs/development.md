# Development

## Build

From the repository root, in PowerShell:

```powershell
.\map\build.ps1
```

On the first run it installs packages. Then it:

1. Inlines the React Flow styles (`gen-xyflowcss.mjs`), because the PCF build doesn't load CSS files.
2. Builds the component into `map/pcf/out/controls/ProcessMap`.
3. Renames Fluent UI's tabster keys in the bundle (`isolate-tabster.mjs`), because the model-driven app runs its own copy.
4. Packages `map/out/EMPHProcessMap.zip` (`package.py`).
5. Runs the tests.

## Tests

```powershell
node --test map\harness\rules.test.mjs
```

These cover Microsoft's picklists (against Business Map's `msTemplate.ts` when that project sits next to this one, and against the copies in `install.js` and `sample-data.js`), scope through the tree and per level (decision 1), products read up from scenarios (with our own scenarios' software), fit-gap from scenarios and requirements, the gap solution approach rule, RAID statuses, fields and filters, change requests, history restore, licence suggestion, problems and summary with dated prices, flow changes, sign-off comparison, workshop sessions, transcript reading and placement, and the exports including the Azure Boards import file.

## Local test page

The page reads the catalog from `map/schema/catalog.json`, so convert Microsoft's workbook once (see [install](install.md), step 4):

```powershell
python map\schema\import-catalog.py "<path to the catalog .xlsx>"
node map\harness\local\serve.mjs
```

If port 8766 is taken, start it with another port, e.g. `$env:PORT = '8776'; node map\harness\local\serve.mjs`.

Open http://localhost:8766/main.aspx for the real-estate demo, http://localhost:8766/main.aspx?sample=engineering for the engineering one, or ?sample=catalog for the catalog alone. The component runs against in-memory data, so nothing reaches Dataverse; reload to reset.

Scripted end-to-end checks run from the console: `await __tests.all()`. They click through all pages, adapt and confirm a flow, play it in the guide (with the extension simulated), capture a requirement, set its MoSCoW and a Gap (which waits for a gap solution approach), freeze a sign-off, start a workshop, paste a made-up transcript to capture from it (an open point becomes a RAID action item) and take a screenshot (with a canvas standing in for the screen picker), take a process out (Not applicable) and back in (with its history rows) and check the scope pickers on end-to-end processes and areas, add a current system, add RAID items (a risk with its own fields, an open question, a decision that needs its maker), restore a scope change from the History page, approve the sign-off and raise a change request, apply a licence suggestion and add a price row, and write the Azure Boards import file. They are written for the default demo (Harbourview Properties) and run in order; `transcript` needs its reference flows.

## Demo site

[.github/workflows/pages.yml](../.github/workflows/pages.yml) publishes the local page to the `gh-pages` branch on every push to `main` that touches it: [map/harness/site/index.html](../map/harness/site/index.html) (the page with a bar to switch demos), `map/harness/local/mock.js`, the committed bundle in `map/sol/Controls/emph_EMPH.ProcessMap/`, `sample-data.js`, `catalog.json` and `flows.json`. The bundle is the committed one, so build and commit before pushing. It pushes the site to the `gh-pages` branch, which Pages serves (Settings > Pages > Source: Deploy from a branch, `gh-pages`, root).

## Reference flows

`map/schema/flows.json` is committed. To refresh it, download the `graphics/*process flow*.xlsx` workbooks from [microsoft/dynamics365patternspractices](https://github.com/microsoft/dynamics365patternspractices) into one folder, then:

```powershell
python map\schema\import-flows.py "<folder>"
```

Run `import-catalog.py` again afterwards so `catalog-load.js` carries the new flows.

## Guide test page

```powershell
node guide\test\serve.mjs
```

Then open http://localhost:8767/main.aspx?f=band (also `?f=busy` and `?f=list`). Dataverse is mocked in the page. In the console:

- `__g.reset()`, reload, then `await __g.run()`: opening a flow, placement, dragging, minimizing, reset position, switching flows, and that none of it writes to Dataverse.
- `await __g.launch()`: the `emph-guide-start` event leaves a launch request. Open `?f=band&emphguide=11111111-1111-4111-8111-111111111111` and run it again to check that a launched flow opens.

The Process Map starts the guide from the flow studio (`src/ui/flow/guide.ts`): it sees the extension by the `data-emph-guide` attribute the guide puts on the page, raises `emph-guide-start` with the flow id (also left in `data-emph-guide-start`), and opens a new tab with `?emphguide=<flow id>`. The local Process Map page's `guide` check covers this side.

## Conventions

- Prefix `emph`. Choice values start at 582100000 and must match between `src/domain/codes.ts` and `schema/install.js`.
- Keep rules in `src/domain` free of React and Dataverse, so they can be tested alone.
- Raise the version in `ControlManifest.Input.xml` and `sol/solution.xml` together. Dataverse ignores an import of the same control version.
