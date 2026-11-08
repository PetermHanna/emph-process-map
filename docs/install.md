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

## 4. Open it, and load a demo if you like

Open the app **EMPH Process Map** and choose **Process map**. After any new import, hard reload (Ctrl+Shift+R) so the browser doesn't keep the old component.

To load a demo, on the same WhoAmI page and console:

1. Choose one: `window.EMPH_SAMPLE_NAME = 'realestate'` (the default) or `'engineering'`.
2. Paste all of [`map/schema/sample-data.js`](../map/schema/sample-data.js) and press Enter.

Load one demo into an environment, once: it adds records each time it runs.

## Access

Give users a security role with read and write on the `emph_` tables. System Administrator isn't needed.

## Updating

Raise the version in `map/pcf/ProcessMap/ControlManifest.Input.xml` and `map/sol/solution.xml`, build, import, publish all, then hard reload the app.
