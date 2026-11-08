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

These cover coverage, flow changes, sign-off comparison, workshop sessions and the exports.

## Local test page

```powershell
node map\harness\local\serve.mjs
```

Open http://localhost:8766/main.aspx for the real-estate demo, or http://localhost:8766/main.aspx?sample=engineering. The component runs against an in-memory copy of the demo data, so nothing reaches Dataverse; reload to reset.

Scripted end-to-end checks run from the console: `await __tests.all()`. They click through all pages, adapt and confirm a flow, capture a requirement, freeze a sign-off and start a workshop. `processAndFlow` uses the engineering demo.

## Guide test page

```powershell
node guide\test\serve.mjs
```

Then open http://localhost:8767/main.aspx?f=band.

## Conventions

- Prefix `emph`. Choice values start at 582100000 and must match between `src/domain/codes.ts` and `schema/install.js`.
- Keep rules in `src/domain` free of React and Dataverse, so they can be tested alone.
- Raise the version in `ControlManifest.Input.xml` and `sol/solution.xml` together. Dataverse ignores an import of the same control version.
