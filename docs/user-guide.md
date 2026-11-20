# User guide

Open the app **EMPH Process Map** and choose **Process map**. The navigation rail on the left has seven pages: Our processes, Processes, Requirements, Workshops, Sign-off, Systems and Settings.

## Our processes

The main page draws our processes the way Microsoft's Business Process Catalog documentation does. Totals at the top: business processes in scope, how many have their fit or gap decided, active requirements, gaps, confirmed flows and answered decisions. Below them, the **target**: the products of the scenarios in scope.

Each end-to-end process in scope is a section with its progress (fit or gap decided) and its products. Inside it:

- its **process areas** run left to right as chevrons with arrows, in catalog order, each with its icon and how many of its processes are in scope;
- under each area, its **business processes** run top to bottom with arrows, in catalog order. In-scope processes are highlighted and show their products (from their scenarios in scope), Fit or Gap, requirements and a flow icon; the rest are dashed.

On the map you can:

- **Click a process** to open it.
- **Tick or untick the box** to set Microsoft's Scope to *20 - In scope* or *30 - Out of scope*. Putting one in also brings its area and end-to-end process into scope, and its scenarios whose scope isn't decided yet. A process only counts as in scope when everything above it is too: an area out of scope greys all its processes.
- **Rename** with the pencil next to any end-to-end process, area or business process, to use your own wording. Microsoft's name stays underneath, with **use** to go back to it. The catalog ID never changes.
- Switch on **Only what's in scope** to hide the rest.
- Open an end-to-end process that isn't in scope from the list at the bottom, to pick its processes.

## Processes

The tree follows the Microsoft Business Process Catalog: end-to-end process > process area > business process > scenario (levels 1 to 4). Click a business process to open its scenarios. Use the search box to find a business process.

Fields carry Microsoft's names and values (the Azure DevOps template for Dynamics 365 projects).

- **End-to-end process**, **process area** and **scenario**: name, Process sequence ID, Scope and scope reason, description, the items below it with their scope. A scenario also has its Fit gap status and its **Products** (the software that runs it). Add our own items at any level (they get X-numbered IDs, Author *Project*, Catalog status *50 - Custom*).
- **Business process**:
  - **Scope** and scope reason; who set it, how and when.
  - **Fit gap status** and its rationale. Picking *Gap* asks for the **Gap solution approach** (Personalization, Power Platform, Java/Plug-in, X++ Extension, ISV, ISV Extension) before anything is saved: a gap without one isn't allowed.
  - Business process owner, workstream lead, subject matter expert, baseline complexity, priority, roles involved.
  - **Today and target**: the systems used today in its area (see Systems) and the products of its scenarios in scope.
  - **Scenarios**: Microsoft's level 4, usually one per product. Switch each in or out of scope and set its fit or gap; the products of those in scope are the target.
  - **Process flow**: opens the flow studio.
  - **Configuration decisions**: answer them in place, or add new ones.
  - **Requirements** raised against this process.

## Flow studio

Two tabs: **Our process** and **Microsoft reference**.

1. With no flow of our own yet, choose **Adapt the reference** (or **Start blank** when there is no reference).
2. Drag activities from the palette onto the dots between activities. Select an activity to rename it, move it to another lane, change its shape or set where it goes next. On a decision, the **+** next to each outcome adds a step on that branch (also on a branch that loops back). Undo is available.
3. **Confirm** when it's right. For each real change from the reference, give a rationale or link a requirement that covers it. Rationales become draft requirements.
4. **Reopen** to change a confirmed flow. **Back to reference** deletes our flow and the requirements it generated.
5. **Play in the guide** opens a new tab and plays the flow you're looking at (our process or the Microsoft reference) step by step over the live app. The button needs the guide extension (below); without it, the button explains how to install it.

## Requirements

Capture a requirement, then open it to set Microsoft's fields: process item (a business process or a scenario), requirement type, **MoSCoW** (stored as Microsoft's priority: Must 1, Should 2, Could 3, Won't 4), Fit gap status with its gap solution approach, estimated complexity, business approval state, author, owner, approved by and on, source text (the quoted line), acceptance criteria, requirement mapping and scope approach. A closed reason (deferred, duplicate, withdrawn) or *Rejected* takes it out of the counts. Filter by approval state, fit or gap, or "needs review", and export to Excel. A requirement is flagged for review when what it came from changes (a flow, a configuration answer, a scope or fit-gap decision).

## Workshops

Start a workshop for one end-to-end process in scope (or all of them). A workshop only covers what you've picked: the agenda starts with the business processes in scope, and Prepare lists only those, by area, to tick on or off. To discuss another process, put it in scope on **Our processes** first. It runs in seven phases:

1. **Prepare**: participants and the business processes on the agenda. The **facilitator's agenda** below gives each business process its questions (who does it, which system today and after migration, each decision in the flow, open setup questions, what standard can't do) and its minutes, with **Print / PDF** and **.doc**.
2. **Scope**: in or out.
3. **Walk-through**: business process owner, fit or gap, and per system used today: keep, migrate or retire. Changes made here are recorded as set in this workshop.
4. **Process flow**: walk our process step by step (or **Adapt the reference** first). The step you click is where what's said lands: transcript lines show "› step", and requirements and comments made there are linked to the step. **Back to the whole process** returns to the process. **Open the flow studio** to change the flow.
5. **Configuration**: the decisions for the current process.
6. **Fit-gap**: capture requirements as people speak.
7. **Summary**: the read-back in fixed phrases, action items (RAID), minutes and time per process. Close the workshop to lock it.

### Meeting transcript

Teams doesn't give apps a live transcript, so you paste it in after the meeting (or during a break).

1. In Teams, open the meeting's **Transcript** and download it (.vtt or .docx), or select all and copy. Plain lines such as `[0:03] Ana: ...` work too.
2. In the workshop, choose **Transcript** and paste. The preview says how many lines and speakers it read. Choose **Keep this transcript**.
3. **Recording started at** places each line on the business process you were discussing at that moment, using the times you moved through the agenda. Fix the time if the recording started earlier or later. Switch on **All lines** to see everything.
4. Each line can become one thing, once:
   - **Capture**: a requirement. The capture box (Fit-gap) fills with the sentence and the speaker, and the requirement keeps the quoted line as *In their words*. A line said on a flow step links to that step (**Whole process instead** undoes it). **Don't keep** clears it.
   - **Comment**: a remark on the business process, or on the flow step it was said on. Comments show in the flow walk and in the flow studio's activity panel, where they can be deleted.
   - **Open point**: a RAID **Action item** of the workshop (marked as a question when the line asks one), with the quoted line, for contradictions and things someone has to find out. It shows in the Summary.
   - **Flow**: opens the flow studio for the current process. Select the activity it's about and choose **Use as this step's reason**; it becomes a draft requirement when you confirm the flow.
   - **Licence**: pick the role, the licence type (Full, Team Members, Operations - Activity, Device, None) and how many people. It's saved on the role (headcount) with the quoted line; **Settings** shows the licence per role and the totals per type and base product.

   A used line shows what it became, for example *Captured as RQ-00012*. Hedging words that hint at a variant or exception (*usually*, *sometimes*, *it depends*, *meistens*, *eigentlich*) are highlighted; lines with a firm need or about licences get a *must* or *licence* tag.

**Screenshot** asks which screen, window or tab to capture and keeps one picture as a note on the workshop, named after the current business process. Recent screenshots show under the title; click one to open it.

## Sign-off

**Freeze for review** copies the scope, answered configuration decisions, confirmed flows and active requirements. Open a sign-off to approve it, discard a draft, compare it with today, or export it:

- **Excel**: everything.
- **Word** and **PDF**: requirements, decisions and flow changes, with the out-of-scope processes listed at the end.

## Systems

The software used today, per process area in scope (or on one business process in it), with vendor, users and the decision: **Keep**, **Migrate** or **Retire** (with a retire date). There is no list of target applications: the target is the products of the scenarios in scope, shown per area and at the top.

## Settings

The organisation name and the roles: Microsoft's responsible role, headcount, licence type, base product and attach products. The totals add up the headcount per licence type and base product.

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
