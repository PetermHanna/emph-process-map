# User guide

Open the app **EMPH Process Map** and choose **Process map**. The navigation rail on the left has seven pages.

## Our processes

The main page. Totals at the top: business processes in scope, how many are confirmed, active requirements, gaps, confirmed flows and answered decisions.

Below, each end-to-end process in scope is a section with its progress (confirmed, on target applications). Each process area is a row with its icon, and its business processes follow as numbered cards: application today → target, disposition, gaps, requirements, and a flow icon when there's a reference flow or our own. Click a card to open the process. End-to-end processes not in scope are listed at the bottom.

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
