# User guide

Open the app **EMPH Process Map** and choose **Process map**. The navigation rail on the left has seven pages.

## Our processes

The main page draws our processes the way Microsoft's Business Process Catalog documentation does. Totals at the top: business processes in scope, how many are confirmed, active requirements, gaps, confirmed flows and answered decisions.

Each end-to-end process in scope is a section with its progress (confirmed, on target applications). Inside it:

- its **process areas** run left to right as chevrons with arrows, in catalog order, each with its icon and how many of its processes are in scope;
- under each area, its **business processes** run top to bottom with arrows, in catalog order. In-scope processes are highlighted and show the target application, the disposition, gaps, requirements and a flow icon; the rest are dashed.

On the map you can:

- **Click a process** to open it.
- **Tick or untick the box** to put a process in or out of scope. Putting one in also brings its area and end-to-end process into scope.
- **Rename** with the pencil next to any end-to-end process, area or business process, to use your own wording. Microsoft's name stays underneath, with **use** to go back to it. The catalog ID never changes.
- Switch on **Only what's in scope** to hide the rest.
- Open an end-to-end process that isn't in scope from the list at the bottom, to pick its processes.

## Processes

The tree follows the Microsoft Business Process Catalog: end-to-end process > process area > business process. Use the search box to find a business process.

- **End-to-end process** and **process area**: name, catalog ID, summary, in scope. Add areas, or our own business processes in an area (they get X-numbered IDs).
- **Business process**:
  - In scope and review state (Not reviewed, Confirmed, Not used).
  - Disposition: what happens to how it's done today (Retain, Transition, Retire, Gap).
  - Process owner, roles involved, application today and target application.
  - **Process flow**: opens the flow studio.
  - **Configuration decisions**: answer them in place, or add new ones.
  - **Requirements** raised against this process.

## Flow studio

Two tabs: **Our process** and **Microsoft reference**.

1. With no flow of our own yet, choose **Adapt the reference** (or **Start blank** when there is no reference).
2. Drag activities from the palette onto the dots between activities. Select an activity to rename it, move it to another lane, change its shape or set where it goes next. Undo is available.
3. **Confirm** when it's right. For each real change from the reference, give a rationale or link a requirement that covers it. Rationales become draft requirements.
4. **Reopen** to change a confirmed flow. **Back to reference** deletes our flow and the requirements it generated.
5. **Play in the guide** opens a new tab and plays the flow you're looking at (our process or the Microsoft reference) step by step over the live app. The button needs the guide extension (below); without it, the button explains how to install it.

## Requirements

Capture a requirement, then open it to set MoSCoW, category, state, coverage by standard, size, owner and resolution. Filter by state, coverage or "needs review", and export to Excel. A requirement is flagged for review when what it came from changes (a flow, a configuration answer, a scope or disposition decision).

## Workshops

Start a workshop for one end-to-end process in scope (or all of them). A workshop only covers what you've picked: the agenda starts with the business processes in scope, and Prepare lists only those, by area, to tick on or off. To discuss another process, put it in scope on **Our processes** first. It runs in seven phases:

1. **Prepare**: participants and the business processes on the agenda.
2. **Scope**: in or out.
3. **Walk-through**: review, disposition, owner and applications per process.
4. **Process flow**: opens the flow studio.
5. **Configuration**: the decisions for the current process.
6. **Fit-gap**: capture requirements as people speak.
7. **Summary**: the read-back in fixed phrases, action items, minutes and time per process. Close the workshop to lock it.

### Meeting transcript

Teams doesn't give apps a live transcript, so you paste it in after the meeting (or during a break).

1. In Teams, open the meeting's **Transcript** and download it (.vtt or .docx), or select all and copy. Plain lines such as `[0:03] Ana: ...` work too.
2. In the workshop, choose **Transcript** and paste. The preview says how many lines and speakers it read. Choose **Keep this transcript**.
3. **Recording started at** places each line on the business process you were discussing at that moment, using the times you moved through the agenda. Fix the time if the recording started earlier or later. Switch on **All lines** to see everything.
4. Each line can become one thing, once:
   - **Capture**: a requirement. The capture box (Fit-gap) fills with the sentence and the speaker, and the requirement keeps the quoted line as *In their words*. **Don't keep** clears it.
   - **Licence**: the same, with category *Licensing* (who needs which licence, how many, read-only).
   - **Flow change**: opens the flow studio for the current process. Select the activity it's about and choose **Use the transcript line as the rationale**; it becomes a draft requirement when you confirm the flow.
   - **Open point**: an action item in the Summary, with the quoted line, for contradictions and things someone has to find out.

   A used line shows what it became, for example *Captured as RQ-00012*. Words that hint at variants (*usually*, *sometimes*, *meistens*), firm needs (*must*, *always*) and licences (*licence*, *read-only*) are highlighted.

**Screenshot** asks which screen, window or tab to capture and keeps one picture as a note on the workshop, named after the current business process. Recent screenshots show under the title; click one to open it.

## Sign-off

**Freeze for review** copies the scope, answered configuration decisions, confirmed flows and active requirements. Open a sign-off to approve it, discard a draft, compare it with today, or export it:

- **Excel**: everything.
- **Word** and **PDF**: requirements, decisions and flow changes, with the out-of-scope processes listed at the end.

## Applications and Settings

Keep the application list (mark target applications), the organisation name and the roles with their headcount.

## The guide

The guide is a browser extension for Microsoft Edge or Google Chrome. It plays a process flow step by step over the live Dynamics 365 pages: it points at the control for each step, says what to do and the key points to make, and can run a demo on autopilot.

### Install it (unpacked)

1. Get the `guide` folder of EMPH Process Map onto your computer.
2. Open `edge://extensions` in Edge or `chrome://extensions` in Chrome.
3. Switch on **Developer mode**.
4. Choose **Load unpacked** and select the `guide` folder.
5. Reload any open Dynamics 365 tabs. A **Guide** button appears at the bottom right.

After an update to the folder, choose **Reload** on the extension's card and reload the Dynamics 365 tabs.

### Play a flow

- **From the Process Map**: open a business process, then **Process flow**, then **Play in the guide**. A new tab opens and the guide starts that flow with a short introduction; choose **Continue**.
- **From any Dynamics 365 page**: choose **Guide**, pick an end-to-end process (shown with your own names) and a flow. Our process is listed first, then the Microsoft reference.

On each step, **Next** moves on; a decision shows one button per answer. The ⋯ menu has the mode (demo or training), how it runs (narrated or autopilot), the voice, **Edit this step** (where to go, what to point at, what to say; saved to the Process Map), **Minimize**, **Reset position**, **Exit this flow** and **Close the guide**. Moving or minimizing the guide never writes to Dataverse.
