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

## Requirements

Capture a requirement, then open it to set MoSCoW, category, state, coverage by standard, size, owner and resolution. Filter by state, coverage or "needs review", and export to Excel. A requirement is flagged for review when what it came from changes (a flow, a configuration answer, a scope or disposition decision).

## Workshops

Start a workshop for one end-to-end process (or all). It runs in seven phases:

1. **Prepare**: participants and the business processes on the agenda.
2. **Scope**: in or out.
3. **Walk-through**: review, disposition, owner and applications per process.
4. **Process flow**: opens the flow studio.
5. **Configuration**: the decisions for the current process.
6. **Fit-gap**: capture requirements as people speak.
7. **Summary**: the read-back in fixed phrases, action items, minutes and time per process. Close the workshop to lock it.

## Sign-off

**Freeze for review** copies the scope, answered configuration decisions, confirmed flows and active requirements. Open a sign-off to approve it, discard a draft, compare it with today, or export it:

- **Excel**: everything.
- **Word** and **PDF**: requirements, decisions and flow changes, with the out-of-scope processes listed at the end.

## Applications and Settings

Keep the application list (mark target applications), the organisation name and the roles with their headcount.

## The guide

Load the `guide` folder as an unpacked extension in Chrome (Extensions > Developer mode > Load unpacked). On a Dynamics 365 page, open the guide, pick a flow and follow it step by step.
