# EMPH Process Map: working notes

Peter Hanna's own product. Repository: https://github.com/PetermHanna/emph-process-map (private), branch `main`.

## What it is

A single-organisation process map for Dynamics 365 / Dataverse, based on the Microsoft Business Process Catalog:
end-to-end process > process area > business process. A PCF component (React 18, Fluent UI 9, React Flow) in a
model-driven app, plus a Chrome extension (the guide) that plays process flows over live Dynamics 365 pages.
See README.md and docs/ (install, user guide, architecture, development).

## Ground rules

- Work only inside this folder. Don't read, copy from or compare with other projects on this machine.
- Don't install, import or load anything into any Dataverse or Dynamics 365 environment unless Peter names the
  environment for this product in this session. Test on the local page (below).
- Peter signs in himself; never type passwords. Confirm before permanent deletes and before pushing.
- Run builds and servers in the visible Terminal panel.
- Microsoft's catalog text (catalog.json, catalog-load.js) stays out of git. The reference flows (flows.json) are
  CC BY 4.0 from microsoft/dynamics365patternspractices and are committed with attribution.
- Demo organisations are fictional (Harbourview Properties: real estate; Lakeside Engineering).

## Layout

- `map/pcf/ProcessMap/` component: `index.ts`; `src/data/api.ts` (Gateway, entity sets); `src/domain/`
  (codes.ts choice values from 582100000, types.ts, rules.ts, session.ts workshops, documents.ts exports,
  repository.ts load and all writes); `src/ui/` (Shell.tsx rail, look.ts theme, kit.tsx incl. Rename, icons.tsx,
  pages/*, flow/* = FlowStudio + Canvas engine with shape.ts adapters).
- `map/schema/install.js` creates 17 `emph_` tables, forms, views, app, web resources; run twice (before and after
  importing the solution, the second run binds the component to the workspace form).
- `map/schema/import-catalog.py <Microsoft catalog .xlsx>` writes catalog.json and catalog-load.js.
  `map/schema/import-flows.py <folder of Microsoft flow .xlsx>` writes flows.json (668 flows, 634 match the catalog).
- `map/schema/sample-data.js`: EMPH_LOAD loads catalog + flows + a demo (`realestate`, `engineering`, `catalog`).
- `map/sol/` hand-built solution EMPHProcessMap, publisher `emphprocessmap`, prefix `emph`, option prefix 58210,
  control `emph_EMPH.ProcessMap`.
- `guide/` Chrome extension (manifest v3); reads emph_processflow / emph_flowactivity.

## Build and test

- Build: `.\map\build.ps1` (npm install first time, gen-xyflowcss, build:prod, isolate-tabster, package.py → map/out/EMPHProcessMap.zip, unit tests).
- Unit tests: `node --test map\harness\rules.test.mjs` (21 tests).
- Local page: `node map\harness\local\serve.mjs` → http://localhost:8766/main.aspx (real estate), `?sample=engineering`, `?sample=catalog`.
  Needs map/schema/catalog.json (run import-catalog.py on the catalog workbook, e.g. "Business Process Catalog OCT 2026.xlsx"
  in Peter's Downloads). In the console: `await __tests.all()` runs 7 end-to-end checks (pages, mainMap, processAndFlow, guide, capture, signOff, workshop).
- Guide test page: `node guide\test\serve.mjs` → http://localhost:8767/main.aspx?f=band | busy | list; `__g.reset()`, reload, `await __g.run()`; `await __g.launch()`.
- Restart the local server after changing serve.mjs routes. A hard reload picks up a new bundle.
- Shell heredocs with mixed quotes fail here: write Python edit scripts to a file and run them.

## State (8 Nov 2026)

- Main page "Our processes" draws each end-to-end process like Microsoft's documentation: areas left to right with
  arrows, business processes top to bottom; tick scope on the map; rename any level (Microsoft's name kept in
  CatalogName, "use" restores it).
- Flow studio: Microsoft reference vs our process, tracked changes, confirm with rationale → draft requirements.
- Requirements, workshops (7 phases), sign-off (freeze, compare, approve, Excel/Word/PDF), applications, settings.
- Guide: flow studio has "Play in the guide" (new tab with ?emphguide=<id>; hint to install unpacked in Edge/Chrome when the extension isn't detected). The guide lists our process first and takes end-to-end names from emph_endtoendprocess.
- Not yet tested in a real Dataverse environment (install.js, solution import, guide against the new tables).
- GitHub may block from Chrome on this machine (504/503); Edge works. `git push` works from the terminal.
