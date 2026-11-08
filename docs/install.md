# Install

Use a Dataverse environment of your own (a trial or a sandbox is fine). The installer only adds things; it changes nothing that's already there.

## 1. Tables, forms, app and pages

1. Sign in to the environment as a System Customizer or System Administrator.
2. Open `https://<your-org>.crm.dynamics.com/api/data/v9.2/WhoAmI`. A light page keeps the browser responsive while the script runs.
3. Open the developer console (F12 > Console), paste all of [`map/schema/install.js`](../map/schema/install.js) and press Enter.
4. Wait for `published` (10 to 30 minutes on a new environment). `window.__emph` shows progress; `window.__emph.error` holds any error.

It creates:

- Publisher `emphprocessmap` (prefix `emph`, choice values from 582100000) and the unmanaged solution `EMPHProcessMap`.
- 17 tables (see [architecture](architecture.md)), each with a main form and a default view.
- Web resources `emph_/open.html` and `emph_/icon.svg`.
- The model-driven app **EMPH Process Map**.
- One workspace record, which hosts the component.

## 2. The component

1. Build it ([development](development.md)) or take `EMPHProcessMap.zip` from a release.
2. In [make.powerapps.com](https://make.powerapps.com) > Solutions > Import solution, import `EMPHProcessMap.zip`, then publish all customizations.

## 3. Put the component on the workspace form

Run `install.js` once more. With the component in the environment, it binds `emph_EMPH.ProcessMap` to the workspace's **Host column** for web, tablet and phone.

By hand instead: open the Workspace main form, select **Host column**, Components > add **EMPH Process Map**, hide the label, save and publish.

## 4. Load the Microsoft Business Process Catalog

1. Download the catalog workbook from Microsoft ([Business process catalog](https://learn.microsoft.com/dynamics365/guidance/business-processes/about)).
2. Convert it:

   ```bash
   python map/schema/import-catalog.py "<path to the catalog .xlsx>"
   ```

   This writes `map/schema/catalog.json` and `map/schema/catalog-load.js`: 16 end-to-end processes, about 100 process areas and about 700 business processes (scenarios, test cases and deprecated rows are left out). Both files hold Microsoft's text and stay out of git.
3. On the same WhoAmI page and console:
   1. Paste all of `map/schema/catalog-load.js`.
   2. Choose what to load: `window.EMPH_SAMPLE_NAME = 'catalog'` (the catalog only, nothing in scope), `'realestate'` (the default) or `'engineering'`.
   3. Paste all of [`map/schema/sample-data.js`](../map/schema/sample-data.js) and press Enter. It takes a few minutes; `window.__emphSample` shows progress.

The demos put their own processes in scope on top of the real catalog, with owners, applications, a reference flow, configuration decisions and requirements. Everything else stays out of scope. Load once per environment: it adds records each time it runs.

## 5. Open it

Open the app **EMPH Process Map** and choose **Process map**. After any new import, hard reload (Ctrl+Shift+R) so the browser doesn't keep the old component.

## Access

Give users a security role with read and write on the `emph_` tables. System Administrator isn't needed.

## Updating

Raise the version in `map/pcf/ProcessMap/ControlManifest.Input.xml` and `map/sol/solution.xml`, build, import, publish all, then hard reload the app.
