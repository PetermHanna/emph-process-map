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
node --test map\harness\rules.test.mjs map\harness\ai.test.mjs
```

`ai.test.mjs` covers the AI analysis with made-up answers only (no model runs): the timeline and request, the change-set parser, the guard (quotes, targets, parents, numbers, a Gap's approach, Microsoft's rules for own items), suggestions and "already so", the review segments, accept / edit / reject / Clear this run through the repository with How *AI accepted* and history, flow steps, the "same" merge of a later call, the question generator's checks, the Predict caller, the estimate, the prompt files' inputs and output example, and the files (blank PNG, PDF writer, a Word file's text).

These cover Microsoft's picklists (against Business Map's `msTemplate.ts` when that project sits next to this one, and against the copies in `install.js` and `sample-data.js`), scope through the tree and per level (decision 1), products read up from scenarios (with our own scenarios' software), fit-gap from scenarios and requirements, the gap solution approach rule, RAID statuses, fields and filters, change requests, history restore, licence suggestion, problems and summary with dated prices, flow changes, sign-off comparison, workshop sessions, Microsoft's workshop templates (128, a source for every question), workshop kinds with Microsoft's type, phase and child tasks, the five steps and agenda Previous/Next, the scenario board (area matching by name, card links, catalog fallback), Close (only what was agreed, struck cards, a gap's approach), the storyline review, the quick track and the next workshop in Microsoft's order, transcript reading (each Teams shape a to f), sentences, negated needs, suggested types and the line review, the read-back answers and close checks, the meeting link and prep pack, screenshot marks and flow drawings, the requirement's flow link, placement, and the exports including the Azure Boards import file.

## Local test page

The page reads the catalog from `map/schema/catalog.json`, so convert Microsoft's workbook once (see [install](install.md), step 4):

```powershell
python map\schema\import-catalog.py "<path to the catalog .xlsx>"
node map\harness\local\serve.mjs
```

If port 8766 is taken, start it with another port, e.g. `$env:PORT = '8776'; node map\harness\local\serve.mjs`.

Open http://localhost:8766/main.aspx for the real-estate demo, http://localhost:8766/main.aspx?sample=engineering for the engineering one, or ?sample=catalog for the catalog alone. The component runs against in-memory data, so nothing reaches Dataverse; reload to reset.

Scripted end-to-end checks run from the console: `await __tests.all()`. They click through all pages, adapt and confirm a flow, play it in the guide (with the extension simulated), capture a requirement, set its MoSCoW and a Gap (which waits for a gap solution approach), freeze a sign-off, start a workshop, paste a made-up transcript to capture from it (an open point becomes a RAID action item) and take a screenshot (with a canvas standing in for the screen picker), take a process out (Not applicable) and back in (with its history rows) and check the scope pickers on end-to-end processes and areas, add a current system, add RAID items (a risk with its own fields, an open question, a decision that needs its maker), restore a scope change from the History page, approve the sign-off and raise a change request, apply a licence suggestion and add a price row, write the Azure Boards import file, run a scenario board workshop from Microsoft's template (type, phase, child tasks, overview without cards, a struck card, an area proposed Not applicable and greyed but not written), a storyline review (a step that differs makes the process a gap, main path, a demo link), the quick track (five lines, Microsoft's agenda back, scope proposed from today), and Close (agreed items written with How Workshop and the workshop's name, history, a child task ticked, the next workshop, undo). `review` (after `transcript`) sets a line aside and back, keeps an edited line as a business rule and undoes it, answers two read-back lines and names who confirmed, checks the close checks, opens the Teams meeting link (window.open stubbed) and draws a line on the flow, kept with the workshop. The screenshot in `transcript` is marked up with a line and a comment. The `ai…` checks run against a **fake AI Builder** in `mock.js` (it answers `fetch` to `msdyn_aimodels` with made-up answers built from the request's own lines, plus items the checks must drop): Analyse with the checks and the review (accept with history, edit, reject, Clear this run), Accept all with a Gap and its approach, the question generator, Draft from documents with a text file, and the prompt check in Settings. The demo site gets the same fake. They are written for the default demo (Harbourview Properties) and run in order; `transcript` needs its reference flows.

## Microsoft's workshop templates

`map/schema/workshops.json` is converted from Microsoft's Word workshop templates ([microsoft/dynamics365patternspractices](https://github.com/microsoft/dynamics365patternspractices/tree/main/workshops), CC BY 4.0 / CC BY-SA 4.0). To refresh it from a newer download (one `<end-to-end> workshops.docx` per process, optionally with a `urls.txt` of their sources):

```powershell
node map\schema\import-workshops.mjs "<folder with the .docx files>"
```

It reads the catalog's end-to-end processes and areas from `catalog.json`, then rebuild: the file is bundled with the component.

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
- `await __g.modes()`, reload, then `await __g.modes2()`: an old saved setting starts on Guide only with the voice off; Next at once and nothing clicked; Mode has the two training runs; Play, Pause (nothing typed while paused), Next while paused, Stop.
- Open `?f=band&emphguide=11111111-1111-4111-8111-111111111111&emphstep=P300` and run `await __g.step()`: the flow opens at that step.


The Process Map starts the guide from the flow studio (`src/ui/flow/guide.ts`): it sees the extension by the `data-emph-guide` attribute the guide puts on the page, raises `emph-guide-start` with the flow id (also left in `data-emph-guide-start`), and opens a new tab with `?emphguide=<flow id>`. The local Process Map page's `guide` check covers this side.

## Conventions

- Prefix `emph`. Choice values start at 582100000 and must match between `src/domain/codes.ts` and `schema/install.js`.
- Keep rules in `src/domain` free of React and Dataverse, so they can be tested alone.
- Raise the version in `ControlManifest.Input.xml` and `sol/solution.xml` together. Dataverse ignores an import of the same control version.
